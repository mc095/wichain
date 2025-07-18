//! WiChain LAN networking (UDP broadcast discovery + lightweight direct send).
//!
//! Responsibilities
//! ----------------
//! • Periodically broadcast presence (Peer) + Ping via UDP broadcast.
//! • Reply to incoming Ping with unicast Pong.
//! • Track peers (id -> last SocketAddr + metadata).
//! • Expose async snapshot of peers to callers.
//! • Forward *all* decoded `NetworkMessage`s to caller over mpsc channel.
//! • Provide `send_direct_block()` to unicast JSON payloads to a specific peer.
//! • (Legacy) Provide `broadcast_block()` to broadcast a whole‑chain JSON blob.
//!
//! Notes
//! -----
//! • `id` == base64(pubkey) across crates.
//! • We record the last source socket address seen for each peer; directs use it.
//! • Windows firewall must allow UDP on the configured port (default 60000).

use std::{
    collections::HashMap,
    net::{IpAddr, Ipv4Addr, SocketAddr},
    sync::Arc,
    time::{Duration, Instant},
};

use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use tokio::{
    net::UdpSocket,
    sync::{mpsc, Mutex},
};
use tracing::{error, info, warn};

/// Interval for presence + ping broadcast.
const BROADCAST_INTERVAL: Duration = Duration::from_secs(5);
/// Drop peers after this many seconds without traffic.
const PEER_STALE_SECS: u64 = 30;
/// Max inbound datagram we’ll accept.
const MAX_DGRAM: usize = 8 * 1024;

/// Info exposed to UI.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PeerInfo {
    pub id: String,     // base64 pubkey (node id)
    pub alias: String,  // human alias
    pub pubkey: String, // base64 pubkey (redundant but explicit)
    pub last_seen_ms: u64,
}

/// Messages sent on LAN.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum NetworkMessage {
    Peer {
        id: String,
        alias: String,
        pubkey: String,
    },
    Ping {
        id: String,
        alias: String,
    },
    Pong {
        id: String,
        alias: String,
    },

    /// Legacy: full chain broadcast.
    Block {
        block_json: String,
    },

    /// Direct peer‑to‑peer payload (typically a single block or chat batch).
    /// `payload_json` is opaque to the network layer.
    DirectBlock {
        from: String,
        to: String,
        payload_json: String,
    },
}

/// Internal peer entry with Instant + last source address.
#[derive(Debug, Clone)]
struct PeerEntry {
    info: PeerInfo,
    last_seen: Instant,
    last_addr: SocketAddr,
}

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
        let bind_addr = format!("0.0.0.0:{}", self.port);
        let socket = match UdpSocket::bind(&bind_addr).await {
            Ok(s) => {
                let _ = s.set_broadcast(true);
                info!("✅ Listening on {}", bind_addr);
                s
            }
            Err(e) => {
                error!("❌ Failed to bind UDP socket: {e:?}");
                return;
            }
        };
        let socket = Arc::new(socket);

        // Receiver loop.
        {
            let socket = Arc::clone(&socket);
            let tx = tx.clone();
            let peers = Arc::clone(&self.peers);
            let my_id = self.id.clone();
            let my_alias = self.alias.clone();
            let port = self.port;
            tokio::spawn(async move {
                recv_loop(socket, tx, peers, my_id, my_alias, port).await;
            });
        }

        // Periodic broadcast loop.
        {
            let socket = Arc::clone(&socket);
            let id = self.id.clone();
            let alias = self.alias.clone();
            let pubkey = self.pubkey.clone();
            let port = self.port;
            tokio::spawn(async move {
                periodic_broadcast(socket, id, alias, pubkey, port).await;
            });
        }
    }

    /// Broadcast full‑chain JSON (legacy compat; safe to remove if not needed).
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

    /// Send a direct payload to a known peer by *peer_id* (base64 pubkey).
    pub async fn send_direct_block(&self, peer_id: &str, payload_json: String) -> Result<()> {
        let addr = {
            let peers = self.peers.lock().await;
            peers
                .get(peer_id)
                .map(|p| p.last_addr)
                .ok_or_else(|| anyhow!("Peer not found: {peer_id}"))?
        };

        // Build message.
        let msg = NetworkMessage::DirectBlock {
            from: self.id.clone(),
            to: peer_id.to_string(),
            payload_json,
        };

        // Bind ephemeral socket + send.
        let bind_addr = "0.0.0.0:0";
        let socket = UdpSocket::bind(bind_addr).await?;
        socket.send_to(&serde_json::to_vec(&msg)?, addr).await?;
        Ok(())
    }

    /// Async snapshot of current peers for UI.
    pub async fn list_peers(&self) -> Vec<PeerInfo> {
        let map = self.peers.lock().await;
        map.values().map(|p| p.info.clone()).collect()
    }
}

/// Receiver loop.
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
        let msg: NetworkMessage = match serde_json::from_slice(&buf[..len]) {
            Ok(m) => m,
            Err(_) => continue,
        };

        match &msg {
            NetworkMessage::Peer { id, alias, pubkey } => {
                update_peer(&peers, id, alias, pubkey, src).await;
            }
            NetworkMessage::Ping { id, alias } => {
                update_peer(&peers, id, alias, id, src).await;
                // reply Pong unicast
                let pong = NetworkMessage::Pong {
                    id: my_id.clone(),
                    alias: my_alias.clone(),
                };
                let _ = send_to(&socket, &pong, src).await;
            }
            NetworkMessage::Pong { id, alias } => {
                update_peer(&peers, id, alias, id, src).await;
            }
            NetworkMessage::Block { .. } => {
                // no peer table data
            }
            NetworkMessage::DirectBlock { from, .. } => {
                // we don't know remote alias/pubkey from this msg form,
                // so we record minimal identity = from for all 3 fields.
                update_peer(&peers, from, from, from, src).await;
            }
        }

        let _ = tx.send(msg.clone()).await;
        maybe_gc_stale(&peers).await;
    }
}

/// Update (or insert) peer entry.
async fn update_peer(
    peers: &Arc<Mutex<HashMap<String, PeerEntry>>>,
    id: &str,
    alias: &str,
    pubkey: &str,
    addr: SocketAddr,
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
        last_addr: addr,
    });
    entry.info.alias = alias.to_string();
    entry.info.pubkey = pubkey.to_string();
    entry.last_seen = now;
    entry.last_addr = addr;
    entry.info.last_seen_ms = 0;
}

/// Drop stale peers (older than PEER_STALE_SECS).
async fn maybe_gc_stale(peers: &Arc<Mutex<HashMap<String, PeerEntry>>>) {
    let mut map = peers.lock().await;
    let cutoff = Instant::now() - Duration::from_secs(PEER_STALE_SECS);
    map.retain(|_, p| p.last_seen >= cutoff);
}

/// Serialize + send.
async fn send_to(socket: &UdpSocket, msg: &NetworkMessage, addr: SocketAddr) -> std::io::Result<()> {
    let bytes = serde_json::to_vec(msg).unwrap();
    socket.send_to(&bytes, addr).await?;
    Ok(())
}

/// Periodic broadcast of (Peer, Ping).
async fn periodic_broadcast(
    socket: Arc<UdpSocket>,
    id: String,
    alias: String,
    pubkey: String,
    port: u16,
) {
    let broadcast_addr = SocketAddr::new(IpAddr::V4(Ipv4Addr::BROADCAST), port);
    loop {
        let announce = NetworkMessage::Peer {
            id: id.clone(),
            alias: alias.clone(),
            pubkey: pubkey.clone(),
        };
        let _ = send_to(&socket, &announce, broadcast_addr).await;

        let ping = NetworkMessage::Ping {
            id: id.clone(),
            alias: alias.clone(),
        };
        let _ = send_to(&socket, &ping, broadcast_addr).await;

        tokio::time::sleep(BROADCAST_INTERVAL).await;
    }
}
