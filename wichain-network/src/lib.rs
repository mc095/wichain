//! WiChain LAN networking: UDP peer discovery + direct peer messages.
//!
//! *UDP broadcast* is used only for discovery (Peer + Ping/Pong). Actual chat
//! data travels in `DirectBlock` datagrams (unicast).
//!
//! Alias is mutable at runtime so the backend can hot‑update after a rename.

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

const BROADCAST_INTERVAL: Duration = Duration::from_secs(5);
const PEER_STALE_SECS: u64 = 30;
const MAX_DGRAM: usize = 8 * 1024;

/// Info exposed to UI.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PeerInfo {
    pub id: String,
    pub alias: String,
    pub pubkey: String,
    pub last_seen_ms: u64,
}

/// Network datagrams.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum NetworkMessage {
    Peer { id: String, alias: String, pubkey: String },
    Ping { id: String, alias: String },
    Pong { id: String, alias: String },

    /// Legacy full chain broadcast (ignored in current flow; retained for compat).
    Block { block_json: String },

    /// Direct peer message (chat payload JSON).
    DirectBlock {
        from: String,
        to: String,
        payload_json: String,
    },
}

#[derive(Debug, Clone)]
struct PeerEntry {
    info: PeerInfo,
    last_seen: Instant,
    last_addr: SocketAddr,
}

pub struct NetworkNode {
    port: u16,
    pub id: String,
    alias: Arc<Mutex<String>>, // mutable at runtime
    pubkey: String,
    peers: Arc<Mutex<HashMap<String, PeerEntry>>>,
}

impl NetworkNode {
    pub fn new(port: u16, id: String, alias: String, pubkey: String) -> Self {
        Self {
            port,
            id,
            alias: Arc::new(Mutex::new(alias)),
            pubkey,
            peers: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Update alias hot (called by backend on rename).
    pub async fn set_alias(&self, new_alias: String) {
        {
            let mut a = self.alias.lock().await;
            *a = new_alias.clone();
        }
        // proactively announce
        if let Err(e) = self.ping_now().await {
            warn!("alias announce failed: {e:?}");
        }
    }

    /// Start receiver + periodic broadcaster.
    pub async fn start(&self, tx: mpsc::Sender<NetworkMessage>) {
        // Try multiple binding addresses for cross-platform compatibility
        let bind_addresses = vec![
            format!("0.0.0.0:{}", self.port),
            format!("127.0.0.1:{}", self.port),
        ];
        
        let mut socket = None;
        for bind_addr in &bind_addresses {
            match UdpSocket::bind(bind_addr).await {
                Ok(s) => {
                    let _ = s.set_broadcast(true);
                    // Set socket options for better cross-platform compatibility
                    if let Err(e) = s.set_send_buffer_size(65536) {
                        warn!("Failed to set send buffer size: {}", e);
                    }
                    if let Err(e) = s.set_recv_buffer_size(65536) {
                        warn!("Failed to set recv buffer size: {}", e);
                    }
                    info!("✅ Listening on {}", bind_addr);
                    socket = Some(s);
                    break;
                }
                Err(e) => {
                    warn!("Failed to bind on {}: {}", bind_addr, e);
                }
            }
        }
        
        let socket = match socket {
            Some(s) => s,
            None => {
                error!("❌ Failed to bind UDP socket on any address");
                return;
            }
        };

        // Receive loop
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

        // Periodic broadcast (announce + ping)
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

    /// Send a direct block payload to a peer we have an address for.
    pub async fn send_direct_block(
        &self,
        peer_id: &str,
        payload_json: String,
    ) -> anyhow::Result<()> {
        let peers = self.peers.lock().await;
        if let Some(entry) = peers.get(peer_id) {
            let addr = entry.last_addr;
            let from_alias = { self.alias.lock().await.clone() };
            let msg = NetworkMessage::DirectBlock {
                from: self.id.clone(),
                to: peer_id.to_string(),
                payload_json,
            };
            let bind_addr = "0.0.0.0:0";
            let socket = UdpSocket::bind(bind_addr).await?;
            // we don't need from_alias in payload; SALVAGE if needed in future
            socket.send_to(&serde_json::to_vec(&msg)?, addr).await?;
            info!("➡️  direct {} -> {} ({})", self.id, peer_id, from_alias);
            Ok(())
        } else {
            Err(anyhow::anyhow!("Peer not found: {}", peer_id))
        }
    }

    /// Force an immediate announce + ping (used by Find Peers button).
    pub async fn ping_now(&self) -> anyhow::Result<()> {
        let bind_addr = "0.0.0.0:0";
        let socket = UdpSocket::bind(bind_addr).await?;
        socket.set_broadcast(true)?;
        let broadcast_addr = SocketAddr::new(IpAddr::V4(Ipv4Addr::BROADCAST), self.port);

        let alias_now = { self.alias.lock().await.clone() };

        let announce = NetworkMessage::Peer {
            id: self.id.clone(),
            alias: alias_now.clone(),
            pubkey: self.pubkey.clone(),
        };
        socket
            .send_to(&serde_json::to_vec(&announce)?, broadcast_addr)
            .await?;

        let ping = NetworkMessage::Ping {
            id: self.id.clone(),
            alias: alias_now,
        };
        socket
            .send_to(&serde_json::to_vec(&ping)?, broadcast_addr)
            .await?;

        Ok(())
    }

    pub async fn list_peers(&self) -> Vec<PeerInfo> {
        let map = self.peers.lock().await;
        map.values().map(|p| p.info.clone()).collect()
    }
}

async fn recv_loop(
    socket: Arc<UdpSocket>,
    tx: mpsc::Sender<NetworkMessage>,
    peers: Arc<Mutex<HashMap<String, PeerEntry>>>,
    my_id: String,
    my_alias: Arc<Mutex<String>>,
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
                let pong = NetworkMessage::Pong {
                    id: my_id.clone(),
                    alias: { my_alias.lock().await.clone() },
                };
                let _ = send_to(&socket, &pong, src).await;
            }
            NetworkMessage::Pong { id, alias } => {
                update_peer(&peers, id, alias, id, src).await;
            }
            NetworkMessage::DirectBlock { from, .. } => {
                update_peer(&peers, from, from, from, src).await;
            }
            NetworkMessage::Block { .. } => {
                // legacy ignore
            }
        }

        let _ = tx.send(msg.clone()).await;
        maybe_gc_stale(&peers).await;
    }
}

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

async fn maybe_gc_stale(peers: &Arc<Mutex<HashMap<String, PeerEntry>>>) {
    let mut map = peers.lock().await;
    let cutoff = Instant::now() - Duration::from_secs(PEER_STALE_SECS);
    map.retain(|_, p| p.last_seen >= cutoff);
}

async fn send_to(socket: &UdpSocket, msg: &NetworkMessage, addr: SocketAddr) -> std::io::Result<()> {
    let bytes = serde_json::to_vec(msg).unwrap();
    socket.send_to(&bytes, addr).await?;
    Ok(())
}

async fn periodic_broadcast(
    socket: Arc<UdpSocket>,
    id: String,
    alias: Arc<Mutex<String>>,
    pubkey: String,
    port: u16,
) {
    let broadcast_addr = SocketAddr::new(IpAddr::V4(Ipv4Addr::BROADCAST), port);
    loop {
        let alias_now = { alias.lock().await.clone() };

        let announce = NetworkMessage::Peer {
            id: id.clone(),
            alias: alias_now.clone(),
            pubkey: pubkey.clone(),
        };
        let _ = send_to(&socket, &announce, broadcast_addr).await;

        let ping = NetworkMessage::Ping {
            id: id.clone(),
            alias: alias_now,
        };
        let _ = send_to(&socket, &ping, broadcast_addr).await;

        tokio::time::sleep(BROADCAST_INTERVAL).await;
    }
}
