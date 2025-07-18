//! WiChain LAN networking (UDP broadcast discovery + lightweight sync).
//!
//! - Broadcast own presence (Peer message) on an interval.
//! - Broadcast Ping; respond with Pong (unicast back to sender).
//! - Track peers in memory (id -> PeerInfo, with last_seen).
//! - Forward **all** network messages up to caller via mpsc channel.
//! - Broadcast blockchain updates (compat mode: full-chain JSON).
//!
//! Tested on Windows LAN; requires firewall allowance for UDP 60000.

use std::{
    collections::HashMap,
    net::{IpAddr, Ipv4Addr, SocketAddr},
    sync::Arc,
    time::{Duration, Instant},
};

use serde::{Deserialize, Serialize};
use tokio::{
    net::UdpSocket,
    sync::{mpsc, Mutex},
};
use tracing::{error, info, warn};

/// UDP broadcast + ping frequency.
const BROADCAST_INTERVAL: Duration = Duration::from_secs(5);
/// Drop peers we haven't heard from in this many seconds.
const PEER_STALE_SECS: u64 = 30;
/// Max datagram we'll parse.
const MAX_DGRAM: usize = 8 * 1024;

/// Info we expose to the UI for a discovered peer.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PeerInfo {
    pub id: String,     // base64 pubkey (node id)
    pub alias: String,  // human alias
    pub pubkey: String, // base64 pubkey (redundant but explicit)
    pub last_seen_ms: u64,
}

/// Messages sent on the LAN.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum NetworkMessage {
    /// Legacy presence announce; still used for compat.
    Peer {
        id: String,
        alias: String,
        pubkey: String,
    },
    /// Full‑chain broadcast (compat mode).
    Block {
        block_json: String,
    },
    /// Ping broadcast (discovery).
    Ping {
        id: String,
        alias: String,
    },
    /// Pong unicast reply to Ping.
    Pong {
        id: String,
        alias: String,
    },
}

/// Internal peer entry with Instant.
#[derive(Debug, Clone)]
struct PeerEntry {
    info: PeerInfo,
    last_seen: Instant,
}

/// Network node object.
pub struct NetworkNode {
    port: u16,
    pub id: String,
    pub alias: String,
    pub pubkey: String,
    peers: Arc<Mutex<HashMap<String, PeerEntry>>>,
}

impl NetworkNode {
    pub fn new(port: u16, id: String, alias: String, pubkey: String) -> Self {
        Self {
            port,
            id,
            alias,
            pubkey,
            peers: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Start all network tasks. Caller supplies mpsc sender to receive *all* network messages.
    pub async fn start(&self, tx: mpsc::Sender<NetworkMessage>) {
        // Bind UDP listener.
        let bind_addr = format!("0.0.0.0:{}", self.port);
        let socket = match UdpSocket::bind(&bind_addr).await {
            Ok(s) => {
                if let Err(e) = s.set_broadcast(true) {
                    warn!("Failed to enable UDP broadcast: {e:?}");
                }
                info!("✅ Listening on {}", bind_addr);
                s
            }
            Err(e) => {
                error!("❌ Failed to bind UDP socket on {}: {e:?}", bind_addr);
                return;
            }
        };
        let socket = Arc::new(socket);

        // Spawn receive loop
        {
            let socket = socket.clone();
            let tx = tx.clone();
            let peers = self.peers.clone();
            let my_id = self.id.clone();
            let my_alias = self.alias.clone();
            let port = self.port;
            tokio::spawn(async move {
                recv_loop(socket, tx, peers, my_id, my_alias, port).await;
            });
        }

        // Spawn periodic broadcast (Peer + Ping)
        {
            let socket = socket.clone();
            let id = self.id.clone();
            let alias = self.alias.clone();
            let pubkey = self.pubkey.clone();
            let port = self.port;
            tokio::spawn(async move {
                periodic_broadcast(socket, id, alias, pubkey, port).await;
            });
        }
    }

    /// Broadcast a *Block* network message (compat: full-chain JSON).
    pub async fn broadcast_block(&self, block_json: String) {
        let bind_addr = "0.0.0.0:0";
        let socket = match UdpSocket::bind(bind_addr).await {
            Ok(s) => {
                let _ = s.set_broadcast(true);
                s
            }
            Err(e) => {
                error!("broadcast_block bind error: {e:?}");
                return;
            }
        };
        let broadcast_addr = SocketAddr::new(IpAddr::V4(Ipv4Addr::BROADCAST), self.port);
        let msg = NetworkMessage::Block { block_json };
        if let Err(e) = send_to(&socket, &msg, broadcast_addr).await {
            warn!("Block broadcast failed: {e:?}");
        }
    }

    /// Async snapshot of current peers for UI.
    pub async fn list_peers(&self) -> Vec<PeerInfo> {
        let map = self.peers.lock().await;
        map.values()
            .map(|p| p.info.clone())
            .collect::<Vec<PeerInfo>>()
    }
}

/// Receive loop task.
async fn recv_loop(
    socket: Arc<UdpSocket>,
    tx: mpsc::Sender<NetworkMessage>,
    peers: Arc<Mutex<HashMap<String, PeerEntry>>>,
    my_id: String,
    my_alias: String,
    _port: u16,
) {
    let mut buf = vec![0u8; MAX_DGRAM];
    loop {
        let (len, src) = match socket.recv_from(&mut buf).await {
            Ok(v) => v,
            Err(e) => {
                warn!("UDP recv error: {e:?}");
                continue;
            }
        };
        let slice = &buf[..len];
        let msg: NetworkMessage = match serde_json::from_slice(slice) {
            Ok(m) => m,
            Err(_) => continue,
        };

        // Update peers based on message.
        match &msg {
            NetworkMessage::Peer { id, alias, pubkey } => {
                update_peer(&peers, id, alias, pubkey).await;
            }
            NetworkMessage::Ping { id, alias } => {
                // record sender
                update_peer(&peers, id, alias, id).await;
                // reply Pong unicast
                let pong = NetworkMessage::Pong {
                    id: my_id.clone(),
                    alias: my_alias.clone(),
                };
                if let Err(e) = send_to(&socket, &pong, src).await {
                    warn!("Failed sending Pong to {src}: {e:?}");
                }
            }
            NetworkMessage::Pong { id, alias } => {
                update_peer(&peers, id, alias, id).await;
            }
            NetworkMessage::Block { .. } => {
                // nothing to update in peer table
            }
        }

        // Forward to caller (best effort)
        if tx.send(msg.clone()).await.is_err() {
            warn!("network -> backend channel closed");
        }

        // opportunistic GC
        maybe_gc_stale(&peers).await;
    }
}

/// Broadcast My Peer + Ping periodically.
async fn periodic_broadcast(
    socket: Arc<UdpSocket>,
    id: String,
    alias: String,
    pubkey: String,
    port: u16,
) {
    let broadcast_addr = SocketAddr::new(IpAddr::V4(Ipv4Addr::BROADCAST), port);
    loop {
        // Announce presence (legacy)
        let announce = NetworkMessage::Peer {
            id: id.clone(),
            alias: alias.clone(),
            pubkey: pubkey.clone(),
        };
        let _ = send_to(&socket, &announce, broadcast_addr).await;

        // Ping
        let ping = NetworkMessage::Ping {
            id: id.clone(),
            alias: alias.clone(),
        };
        let _ = send_to(&socket, &ping, broadcast_addr).await;

        tokio::time::sleep(BROADCAST_INTERVAL).await;
    }
}

/// Update (or insert) a peer entry.
async fn update_peer(
    peers: &Arc<Mutex<HashMap<String, PeerEntry>>>,
    id: &str,
    alias: &str,
    pubkey: &str,
) {
    let mut map = peers.lock().await;
    let now = Instant::now();
    let entry = map.entry(id.to_string()).or_insert_with(|| PeerEntry {
        info: PeerInfo {
            id: id.to_string(),
            alias: alias.to_string(),
            pubkey: pubkey.to_string(),
            last_seen_ms: 0,
        },
        last_seen: now,
    });
    entry.info.alias = alias.to_string();
    entry.info.pubkey = pubkey.to_string();
    entry.last_seen = now;
    entry.info.last_seen_ms = 0; // we show 0.. updated lazily
}

/// Drop stale peers (older than PEER_STALE_SECS).
async fn maybe_gc_stale(peers: &Arc<Mutex<HashMap<String, PeerEntry>>>) {
    let mut map = peers.lock().await;
    let cutoff = Instant::now() - Duration::from_secs(PEER_STALE_SECS);
    map.retain(|_, p| p.last_seen >= cutoff);
}

/// Send a serialized message to `addr`.
async fn send_to(socket: &UdpSocket, msg: &NetworkMessage, addr: SocketAddr) -> std::io::Result<()> {
    let bytes = serde_json::to_vec(msg).unwrap();
    socket.send_to(&bytes, addr).await?;
    Ok(())
}
