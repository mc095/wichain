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
    io::AsyncWriteExt,
    net::{UdpSocket, TcpListener as TokioTcpListener, TcpStream as TokioTcpStream},
    sync::{mpsc, Mutex, RwLock},
    time::{timeout, Duration as TokioDuration},
};
use tracing::{error, info, warn, debug};

const BROADCAST_INTERVAL: Duration = Duration::from_secs(5);
const PEER_STALE_SECS: u64 = 30;
const MAX_DGRAM: usize = 8 * 1024;
const TCP_PORT_OFFSET: u16 = 1000; // TCP port = UDP port + offset
// const TCP_CONNECTION_TIMEOUT: Duration = Duration::from_secs(10);
// const TCP_KEEPALIVE_INTERVAL: Duration = Duration::from_secs(30);
const TCP_MESSAGE_TIMEOUT: Duration = Duration::from_secs(5);

/// Info exposed to UI.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PeerInfo {
    pub id: String,
    pub alias: String,
    pub pubkey: String,
    pub last_seen_ms: u64,
    pub connection_type: String, // "UDP", "TCP", or "Unknown"
    pub tcp_port: Option<u16>,
}

/// Connection statistics for monitoring.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionStats {
    pub peer_id: String,
    pub is_connected: bool,
    pub message_count: u64,
    pub last_activity_ms: u64,
    pub last_test_time_ms: Option<u64>,
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

    /// TCP connection request (sent via UDP to initiate TCP connection).
    TcpConnectionRequest {
        from: String,
        from_alias: String,
        tcp_port: u16,
    },

    /// TCP connection response (sent via UDP to accept/reject TCP connection).
    TcpConnectionResponse {
        from: String,
        to: String,
        accepted: bool,
        tcp_port: u16,
    },

    /// TCP keepalive message.
    TcpKeepalive {
        from: String,
    },

    /// TCP connection test message.
    TcpConnectionTest {
        from: String,
        timestamp: u64,
    },

    /// TCP connection test response.
    TcpConnectionTestResponse {
        from: String,
        to: String,
        timestamp: u64,
        response_time_ms: u64,
    },
}

#[derive(Debug, Clone)]
struct PeerEntry {
    info: PeerInfo,
    last_seen: Instant,
    last_addr: SocketAddr,
    tcp_port: Option<u16>,
}

/// TCP connection state for a peer.
#[derive(Debug)]
struct TcpConnection {
    stream: Arc<Mutex<TokioTcpStream>>,
    peer_id: String,
    last_activity: Instant,
    is_connected: bool,
    message_count: u64,
    last_test_time: Option<Instant>,
}

/// TCP connection manager.
#[derive(Debug)]
struct TcpConnectionManager {
    connections: Arc<RwLock<HashMap<String, TcpConnection>>>,
    tcp_listener: Option<TokioTcpListener>,
    tcp_port: u16,
}

pub struct NetworkNode {
    port: u16,
    pub id: String,
    alias: Arc<Mutex<String>>, // mutable at runtime
    pubkey: String,
    peers: Arc<Mutex<HashMap<String, PeerEntry>>>,
    tcp_manager: Arc<TcpConnectionManager>,
}

impl NetworkNode {
    pub fn new(port: u16, id: String, alias: String, pubkey: String) -> Self {
        let tcp_port = port + TCP_PORT_OFFSET;
        let tcp_manager = Arc::new(TcpConnectionManager {
            connections: Arc::new(RwLock::new(HashMap::new())),
            tcp_listener: None,
            tcp_port,
        });

        Self {
            port,
            id,
            alias: Arc::new(Mutex::new(alias)),
            pubkey,
            peers: Arc::new(Mutex::new(HashMap::new())),
            tcp_manager,
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

    /// Start receiver + periodic broadcaster + TCP listener.
    pub async fn start(&self, tx: mpsc::Sender<NetworkMessage>) {
        // Try primary binding first
        let bind_addr = format!("0.0.0.0:{}", self.port);
        let socket = match UdpSocket::bind(&bind_addr).await {
            Ok(s) => {
                let _ = s.set_broadcast(true);
                info!("✅ Listening on {}", bind_addr);
                s
            }
            Err(e) => {
                warn!("Primary binding failed: {}, trying fallback", e);
                // Fallback for macOS/Windows compatibility issues
                let fallback_addr = format!("127.0.0.1:{}", self.port);
                match UdpSocket::bind(&fallback_addr).await {
                    Ok(s) => {
                        let _ = s.set_broadcast(true);
                        info!("✅ Listening on fallback {}", fallback_addr);
                        s
                    }
                    Err(e2) => {
                        error!("❌ Failed to bind UDP socket on both addresses: {e:?}, {e2:?}");
                        return;
                    }
                }
            }
        };
        let socket = Arc::new(socket);

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

        // Start TCP listener
        {
            let tcp_manager = self.tcp_manager.clone();
            let node_id = self.id.clone();
            let alias = self.alias.clone();
            tokio::spawn(async move {
                if let Err(e) = TcpConnectionManager::start_tcp_listener_static(tcp_manager, node_id, alias).await {
                    error!("Failed to start TCP listener: {e:?}");
                }
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

    /// Send a message via TCP if connection exists, otherwise fallback to UDP.
    pub async fn send_message(
        &self,
        peer_id: &str,
        payload_json: String,
    ) -> anyhow::Result<()> {
        // First, try to establish TCP connection if we don't have one
        if !self.has_tcp_connection(peer_id).await {
            // Try to request TCP connection
            if let Err(e) = self.request_tcp_connection(peer_id).await {
                debug!("Failed to request TCP connection to {}: {}, using UDP", peer_id, e);
            } else {
                // Wait a bit for TCP connection to be established
                tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
            }
        }

        // Try TCP first if we have a connection
        if self.has_tcp_connection(peer_id).await {
            if let Ok(()) = self.send_via_tcp(peer_id, &payload_json).await {
                info!("✅ Message sent via TCP to {}", peer_id);
                return Ok(());
            }
        }

        // Fallback to UDP
        debug!("TCP failed, falling back to UDP for {}", peer_id);
        self.send_direct_block(peer_id, payload_json).await
    }

    /// Send message via TCP connection.
    async fn send_via_tcp(&self, peer_id: &str, payload: &str) -> anyhow::Result<()> {
        let connections = self.tcp_manager.connections.read().await;
        if let Some(conn) = connections.get(peer_id) {
            if conn.is_connected {
                let mut stream = conn.stream.lock().await;
                let message = format!("{}\n", payload);
                
                // Use timeout for TCP operations
                let result = timeout(
                    TokioDuration::from_secs(TCP_MESSAGE_TIMEOUT.as_secs()),
                    stream.write_all(message.as_bytes())
                ).await;
                
                match result {
                    Ok(Ok(())) => {
                        stream.flush().await?;
                        debug!("Message sent via TCP to {} ({} bytes)", peer_id, message.len());
                        return Ok(());
                    }
                    Ok(Err(e)) => {
                        warn!("TCP write error to {}: {}", peer_id, e);
                        return Err(anyhow::anyhow!("TCP write error: {}", e));
                    }
                    Err(_) => {
                        warn!("TCP write timeout to {}", peer_id);
                        return Err(anyhow::anyhow!("TCP write timeout"));
                    }
                }
            }
        }
        Err(anyhow::anyhow!("No TCP connection to peer {}", peer_id))
    }

    /// Request TCP connection to a peer.
    pub async fn request_tcp_connection(&self, peer_id: &str) -> anyhow::Result<()> {
        let peers = self.peers.lock().await;
        if let Some(peer) = peers.get(peer_id) {
            let alias = { self.alias.lock().await.clone() };
            let tcp_port = self.tcp_manager.tcp_port;
            
            let request = NetworkMessage::TcpConnectionRequest {
                from: self.id.clone(),
                from_alias: alias,
                tcp_port,
            };

            // Send via UDP
            let bind_addr = "0.0.0.0:0";
            let socket = UdpSocket::bind(bind_addr).await?;
            socket.send_to(&serde_json::to_vec(&request)?, peer.last_addr).await?;
            
            info!("TCP connection request sent to {} ({})", peer_id, peer.info.alias);
            
            // Try to establish TCP connection directly
            if let Some(peer_tcp_port) = peer.tcp_port {
                let peer_addr = format!("{}:{}", peer.last_addr.ip(), peer_tcp_port);
                match TokioTcpStream::connect(&peer_addr).await {
                    Ok(stream) => {
                        let conn = TcpConnection {
                            stream: Arc::new(Mutex::new(stream)),
                            peer_id: peer_id.to_string(),
                            last_activity: Instant::now(),
                            is_connected: true,
                            message_count: 0,
                            last_test_time: None,
                        };
                        
                        let mut connections = self.tcp_manager.connections.write().await;
                        connections.insert(peer_id.to_string(), conn);
                        
                        info!("✅ TCP connection established to {} ({})", peer_id, peer.info.alias);
                    }
                    Err(e) => {
                        warn!("Failed to establish TCP connection to {}: {}", peer_id, e);
                    }
                }
            }
            
            Ok(())
        } else {
            Err(anyhow::anyhow!("Peer not found: {}", peer_id))
        }
    }

    /// Get TCP port for this node.
    pub fn get_tcp_port(&self) -> u16 {
        self.tcp_manager.tcp_port
    }

    /// Check if we have a TCP connection to a peer.
    pub async fn has_tcp_connection(&self, peer_id: &str) -> bool {
        let connections = self.tcp_manager.connections.read().await;
        connections.get(peer_id).map_or(false, |conn| conn.is_connected)
    }

    /// Test TCP connection to a peer and measure response time.
    pub async fn test_tcp_connection(&self, peer_id: &str) -> anyhow::Result<u64> {
        let start_time = std::time::Instant::now();
        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64;

        let test_message = NetworkMessage::TcpConnectionTest {
            from: self.id.clone(),
            timestamp,
        };

        // Send test message via TCP
        self.send_via_tcp(peer_id, &serde_json::to_string(&test_message)?).await?;

        // Wait for response (simplified - in real implementation, you'd need to handle responses)
        let response_time = start_time.elapsed().as_millis() as u64;
        
        info!("TCP connection test to {} completed in {}ms", peer_id, response_time);
        Ok(response_time)
    }

    /// Get detailed connection statistics for a peer.
    pub async fn get_connection_stats(&self, peer_id: &str) -> Option<ConnectionStats> {
        let connections = self.tcp_manager.connections.read().await;
        if let Some(conn) = connections.get(peer_id) {
            Some(ConnectionStats {
                peer_id: peer_id.to_string(),
                is_connected: conn.is_connected,
                message_count: conn.message_count,
                last_activity_ms: conn.last_activity.elapsed().as_millis() as u64,
                last_test_time_ms: conn.last_test_time.map(|t| t.elapsed().as_millis() as u64),
            })
        } else {
            None
        }
    }

    /// Update peer connection type based on actual connection status.
    pub async fn update_peer_connection_type(&self, peer_id: &str) {
        let has_tcp = self.has_tcp_connection(peer_id).await;
        let mut peers = self.peers.lock().await;
        if let Some(peer) = peers.get_mut(peer_id) {
            peer.info.connection_type = if has_tcp { "TCP".to_string() } else { "UDP".to_string() };
        }
    }
}

impl TcpConnectionManager {
    /// Start TCP listener for incoming connections (static method).
    async fn start_tcp_listener_static(
        tcp_manager: Arc<TcpConnectionManager>,
        node_id: String,
        alias: Arc<Mutex<String>>,
    ) -> anyhow::Result<()> {
        let bind_addr = format!("0.0.0.0:{}", tcp_manager.tcp_port);
        let listener = TokioTcpListener::bind(&bind_addr).await?;
        info!("✅ TCP listener started on {}", bind_addr);
        
        // Start accepting connections
        loop {
            match listener.accept().await {
                Ok((stream, addr)) => {
                    info!("New TCP connection from {}", addr);
                    
                    // Create a connection entry
                    let conn = TcpConnection {
                        stream: Arc::new(Mutex::new(stream)),
                        peer_id: format!("peer_{}", addr.port()), // Temporary ID based on port
                        last_activity: Instant::now(),
                        is_connected: true,
                        message_count: 0,
                        last_test_time: None,
                    };
                    
                    // Add to connections
                    {
                        let mut connections = tcp_manager.connections.write().await;
                        connections.insert(conn.peer_id.clone(), conn);
                    }
                    
                    info!("✅ TCP connection established with peer from {}", addr);
                }
                Err(e) => {
                    error!("TCP accept error: {e:?}");
                }
            }
        }
    }

    /// Handle incoming TCP connection.
    async fn handle_incoming_tcp_connection(
        &self,
        stream: TokioTcpStream,
        peer_id: String,
    ) -> anyhow::Result<()> {
        let conn = TcpConnection {
            stream: Arc::new(Mutex::new(stream)),
            peer_id: peer_id.clone(),
            last_activity: Instant::now(),
            is_connected: true,
            message_count: 0,
            last_test_time: None,
        };

        // Add to connections
        {
            let mut connections = self.connections.write().await;
            connections.insert(peer_id.clone(), conn);
        }

        info!("TCP connection established with {}", peer_id);
        Ok(())
    }

    /// Clean up stale TCP connections.
    async fn cleanup_stale_connections(&self) {
        let mut connections = self.connections.write().await;
        let now = Instant::now();
        connections.retain(|peer_id, conn| {
            if now.duration_since(conn.last_activity) > Duration::from_secs(300) {
                info!("Removing stale TCP connection to {}", peer_id);
                false
            } else {
                true
            }
        });
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
            NetworkMessage::TcpConnectionRequest { from, from_alias, tcp_port } => {
                update_peer_with_tcp_port(&peers, from, from_alias, from, src, Some(*tcp_port)).await;
                info!("TCP connection request from {} ({}) on port {}", from, from_alias, tcp_port);
                
                // Accept the TCP connection request by sending a response
                let response = NetworkMessage::TcpConnectionResponse {
                    from: my_id.clone(),
                    to: from.clone(),
                    accepted: true,
                    tcp_port: 60000 + TCP_PORT_OFFSET, // Our TCP port (60000 + 1000 = 61000)
                };
                
                let bind_addr = "0.0.0.0:0";
                if let Ok(socket) = UdpSocket::bind(bind_addr).await {
                    let _ = socket.send_to(&serde_json::to_vec(&response).unwrap(), src).await;
                    info!("✅ TCP connection response sent to {}", from);
                }
            }
            NetworkMessage::TcpConnectionResponse { from, to: _to, accepted, tcp_port } => {
                update_peer_with_tcp_port(&peers, from, from, from, src, Some(*tcp_port)).await;
                info!("TCP connection response from {}: {} (port {})", from, if *accepted { "accepted" } else { "rejected" }, tcp_port);
            }
            NetworkMessage::TcpKeepalive { from } => {
                update_peer(&peers, from, from, from, src).await;
            }
            NetworkMessage::TcpConnectionTest { from, timestamp: _timestamp } => {
                update_peer(&peers, from, from, from, src).await;
                info!("TCP connection test received from {}", from);
            }
            NetworkMessage::TcpConnectionTestResponse { from, to, timestamp, response_time_ms } => {
                update_peer(&peers, from, from, from, src).await;
                info!("TCP connection test response from {} to {}: {}ms", from, to, response_time_ms);
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
    update_peer_with_tcp_port(peers, id, alias, pubkey, addr, None).await;
}

async fn update_peer_with_tcp_port(
    peers: &Arc<Mutex<HashMap<String, PeerEntry>>>,
    id: &str,
    alias: &str,
    pubkey: &str,
    addr: SocketAddr,
    tcp_port: Option<u16>,
) {
    let mut map = peers.lock().await;
    let now = Instant::now();
    let entry = map.entry(id.to_string()).or_insert_with(|| PeerEntry {
        info: PeerInfo {
            id: id.to_string(),
            alias: alias.to_string(),
            pubkey: pubkey.to_string(),
            last_seen_ms: 0,
            connection_type: "UDP".to_string(),
            tcp_port: None,
        },
        last_seen: now,
        last_addr: addr,
        tcp_port: None,
    });
    entry.info.alias = alias.to_string();
    entry.info.pubkey = pubkey.to_string();
    entry.last_seen = now;
    entry.last_addr = addr;
    entry.info.last_seen_ms = 0;
    if let Some(port) = tcp_port {
        entry.tcp_port = Some(port);
        entry.info.tcp_port = Some(port);
    }
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
