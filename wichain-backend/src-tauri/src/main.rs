#![cfg_attr(all(not(debug_assertions), target_os = "windows"), windows_subsystem = "windows")]

//! WiChain Tauri backend – *direct LAN chat edition*.
//!
//! ### Key points
//! - **Direct peer messaging** over UDP (no full-chain broadcast).
//! - Messages serialized as `ChatPayloadV1` JSON and appended to local blockchain
//!   so you retain a tamper-evident chat log.
//! - **Alias hot‑update**: renaming device updates the network announce name
//!   immediately (no restart required).
//! - **Reset Data**: wipe local identity + blockchain; UI reload recommended.
//!
//! ### Events emitted to UI
//! - `"peer_update"`   – peer table changed (discovery/ping/pong).
//! - `"chat_update"`   – new chat data appended (local send or inbound).
//! - `"alias_update"`  – alias changed locally.
//! - `"reset_done"`    – local data removed.
//!
//! ### Commands exported to UI
//! - `get_identity()`
//! - `set_alias(new_alias: String)`
//! - `get_peers()`
//! - `add_chat_message(content: String, to_peer: Option<String>)`
//! - `get_chat_history()`
//! - `reset_data()`

use std::{
    fs,
    path::{Path, PathBuf},
    sync::Arc,
};

use base64::Engine;
use ed25519_dalek::SigningKey;
use log::{info, warn};
use rand::rngs::OsRng;
use serde::{Deserialize, Serialize};
use tokio::sync::Mutex;

use tauri::{AppHandle, Emitter, Manager};

use wichain_blockchain::Blockchain;
use wichain_network::{NetworkMessage, NetworkNode, PeerInfo};

/// ---- config ----------------------------------------------------------------
const WICHAIN_PORT: u16 = 60000;
const BLOCKCHAIN_FILE: &str = "blockchain.json";
const IDENTITY_FILE: &str = "identity.json";

/// ---- stored identity -------------------------------------------------------
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoredIdentity {
    pub alias: String,
    pub private_key_b64: String,
    pub public_key_b64: String,
}

/// Chat payload serialized in blockchain + network.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatPayloadV1 {
    pub from: String,        // sender pubkey b64
    pub to: Option<String>,  // receiver pubkey b64; None => group/all
    pub text: String,        // UTF‑8
    pub ts_ms: u128,         // unix ms
}

/// ---- application state -----------------------------------------------------
pub struct AppState {
    pub app: AppHandle,
    pub identity: Arc<Mutex<StoredIdentity>>,
    pub signing_key: SigningKey,
    pub blockchain: Arc<Mutex<Blockchain>>,
    pub node: Arc<NetworkNode>,
    pub blockchain_path: PathBuf,
    pub identity_path: PathBuf,
}

fn main() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_log::Builder::default()
                .level(log::LevelFilter::Debug)
                .build(),
        )
        .setup(|app| {
            // --- Data directory ----------------------------------------------------------
            let mut data_dir = app.path().app_data_dir().unwrap_or_else(|_| PathBuf::from("."));
            data_dir.push("WiChain");
            if let Err(e) = fs::create_dir_all(&data_dir) {
                warn!("Failed to create data dir {:?}: {e}", data_dir);
            }
            info!("✅ App data dir: {:?}", data_dir);

            let identity_path = data_dir.join(IDENTITY_FILE);
            let blockchain_path = data_dir.join(BLOCKCHAIN_FILE);

            // --- Identity ---------------------------------------------------------------
            let identity_loaded = load_or_create_identity(&identity_path);
            let signing_key = decode_signing_key(&identity_loaded).unwrap_or_else(|e| {
                warn!("Identity decode error ({e}); regenerating.");
                let regenerated = regenerate_identity(&identity_path);
                decode_signing_key(&regenerated).expect("fresh identity must decode")
            });
            info!(
                "✅ Identity alias: {}  (pubkey {} chars)",
                identity_loaded.alias,
                identity_loaded.public_key_b64.len()
            );
            let identity = Arc::new(Mutex::new(identity_loaded));

            // --- Blockchain -------------------------------------------------------------
            let blockchain = if blockchain_path.exists() {
                match Blockchain::load_from_file(&blockchain_path) {
                    Ok(bc) => {
                        info!("✅ Loaded blockchain from disk ({} blocks).", bc.chain.len());
                        bc
                    }
                    Err(e) => {
                        warn!("⚠ Failed to load blockchain ({e}); creating new.");
                        Blockchain::new()
                    }
                }
            } else {
                info!("ℹ No blockchain found; creating new.");
                Blockchain::new()
            };
            let blockchain = Arc::new(Mutex::new(blockchain));

            // --- Network Node -----------------------------------------------------------
            let node_id = {
                let id_guard = identity.blocking_lock();
                id_guard.public_key_b64.clone()
            };
            let node_alias = {
                let id_guard = identity.blocking_lock();
                id_guard.alias.clone()
            };
            let node_pubkey = node_id.clone();
            let node = Arc::new(NetworkNode::new(
                WICHAIN_PORT,
                node_id.clone(),
                node_alias.clone(),
                node_pubkey,
            ));

            let (tx, mut rx) = tokio::sync::mpsc::channel::<NetworkMessage>(64);

            {
                let node = node.clone();
                tauri::async_runtime::spawn(async move {
                    node.start(tx).await;
                });
            }
            info!(
                "✅ Node started: alias={} id={} port={}",
                node_alias, node_id, WICHAIN_PORT
            );

            // --- Background network->state bridge --------------------------------------
            {
                let blockchain = Arc::clone(&blockchain);
                let blockchain_path = blockchain_path.clone();
                let app_handle_for_task = app.handle().clone();
                tauri::async_runtime::spawn(async move {
                    while let Some(msg) = rx.recv().await {
                        match msg {
                            NetworkMessage::DirectBlock { from, to, payload_json } => {
                                handle_incoming_chat_payload(
                                    &app_handle_for_task,
                                    &blockchain,
                                    &blockchain_path,
                                    from,
                                    Some(to),
                                    payload_json,
                                )
                                .await;
                            }
                            NetworkMessage::Block { .. } => {
                                // Legacy full-chain broadcast ignored in new direct-chat flow.
                            }
                            NetworkMessage::Peer { .. }
                            | NetworkMessage::Ping { .. }
                            | NetworkMessage::Pong { .. } => {
                                info!("🔔 Peer update event triggered");
                                let _ = app_handle_for_task.emit("peer_update", ());
                            }
                        }
                    }
                });
            }

            // --- Install state so commands can access it --------------------------------
            let state = AppState {
                app: app.handle().clone(),
                identity,
                signing_key,
                blockchain,
                node,
                blockchain_path,
                identity_path,
            };
            app.manage(state);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_identity,
            set_alias,
            get_peers,
            add_chat_message,
            get_chat_history,
            reset_data
        ])
        .run(tauri::generate_context!())
        .expect("Error running WiChain");
}

// -----------------------------------------------------------------------------
// helpers: identity load / save
// -----------------------------------------------------------------------------
fn load_or_create_identity(path: &Path) -> StoredIdentity {
    if let Ok(data) = fs::read_to_string(path) {
        if let Ok(id) = serde_json::from_str::<StoredIdentity>(&data) {
            return id;
        }
        warn!("Failed to parse identity.json; regenerating.");
    }
    regenerate_identity(path)
}

fn regenerate_identity(path: &Path) -> StoredIdentity {
    let signing_key = SigningKey::generate(&mut OsRng);
    let alias = format!("Anon-{}", rand::random::<u16>());
    let public_key_b64 =
        base64::engine::general_purpose::STANDARD.encode(signing_key.verifying_key().to_bytes());
    let private_key_b64 =
        base64::engine::general_purpose::STANDARD.encode(signing_key.to_bytes());

    let id = StoredIdentity {
        alias,
        public_key_b64,
        private_key_b64,
    };
    if let Err(e) = fs::write(path, serde_json::to_string_pretty(&id).unwrap()) {
        warn!("Failed to write identity.json: {e}");
    }
    id
}

fn decode_signing_key(id: &StoredIdentity) -> Result<SigningKey, String> {
    let priv_bytes = base64::engine::general_purpose::STANDARD
        .decode(id.private_key_b64.as_bytes())
        .map_err(|e| format!("decode private key: {e}"))?;
    if priv_bytes.len() != 32 {
        return Err(format!("private key wrong length {}", priv_bytes.len()));
    }
    let mut arr = [0u8; 32];
    arr.copy_from_slice(&priv_bytes);
    Ok(SigningKey::from_bytes(&arr))
}

// -----------------------------------------------------------------------------
// helpers: chat payload append / persist
// -----------------------------------------------------------------------------

fn now_ms() -> u128 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or_default()
}

/// Append inbound or outbound chat payload into local blockchain + persist.
/// Emits `chat_update` after saving.
async fn handle_incoming_chat_payload(
    app: &AppHandle,
    blockchain: &Arc<Mutex<Blockchain>>,
    blockchain_path: &Path,
    from: String,
    to: Option<String>,
    payload_json: String,
) {
    // If payload_json isn't our canonical format, wrap into canonical.
    let payload = match serde_json::from_str::<ChatPayloadV1>(&payload_json) {
        Ok(p) => p,
        Err(_) => ChatPayloadV1 {
            from,
            to,
            text: payload_json,
            ts_ms: now_ms(),
        },
    };
    let mut chain = blockchain.lock().await;
    chain.add_text_block(serde_json::to_string(&payload).unwrap());
    if let Err(e) = chain.save_to_file(blockchain_path) {
        warn!("Failed saving chain after incoming chat: {e}");
    }
    let _ = app.emit("chat_update", ());
}

// -----------------------------------------------------------------------------
// Tauri commands
// -----------------------------------------------------------------------------

/// Return identity to UI.
#[tauri::command]
async fn get_identity(state: tauri::State<'_, AppState>) -> Result<StoredIdentity, String> {
    let id = state.identity.lock().await;
    Ok(id.clone())
}

/// Update alias (hot). Persists to disk, updates in-memory identity, updates
/// running network node (so future announces use new alias), emits events.
#[tauri::command]
async fn set_alias(
    state: tauri::State<'_, AppState>,
    new_alias: String,
) -> Result<(), String> {
    let alias = new_alias.trim();
    if alias.is_empty() {
        return Err("alias empty".into());
    }

    // Update identity in memory
    {
        let mut id = state.identity.lock().await;
        id.alias = alias.to_string();
        if let Err(e) =
            fs::write(&state.identity_path, serde_json::to_string_pretty(&*id).unwrap())
        {
            return Err(format!("write identity: {e}"));
        }
    }

    // Update network alias + announce
    state.node.set_alias(alias.to_string()).await;

    // Notify UI
    let _ = state.app.emit("alias_update", ());
    info!("Alias changed to '{alias}' and network announce updated.");
    Ok(())
}

/// Return current peer list (self filtered out).
#[tauri::command]
async fn get_peers(state: tauri::State<'_, AppState>) -> Result<Vec<PeerInfo>, String> {
    let peers = state.node.list_peers().await;
    let my_id = {
        let id = state.identity.lock().await;
        id.public_key_b64.clone()
    };
    Ok(peers.into_iter().filter(|p| p.id != my_id).collect())
}

/// Add chat message (to one peer or all peers).
#[tauri::command]
async fn add_chat_message(
    state: tauri::State<'_, AppState>,
    content: String,
    to_peer: Option<String>,
) -> Result<(), String> {
    let my_id = {
        let id = state.identity.lock().await;
        id.public_key_b64.clone()
    };
    let payload = ChatPayloadV1 {
        from: my_id.clone(),
        to: to_peer.clone(),
        text: content.clone(),
        ts_ms: now_ms(),
    };
    let payload_json = serde_json::to_string(&payload).map_err(|e| e.to_string())?;

    // append locally
    {
        let mut chain = state.blockchain.lock().await;
        chain.add_text_block(payload_json.clone());
        if let Err(e) = chain.save_to_file(&state.blockchain_path) {
            return Err(format!("save error: {e}"));
        }
    }
    let _ = state.app.emit("chat_update", ());

    // send
    match to_peer {
        Some(peer_id) => {
            if let Err(e) = state
                .node
                .send_direct_block(&peer_id, payload_json.clone())
                .await
            {
                warn!("send_direct_block error: {e}");
            }
        }
        None => {
            // group = send to everyone separately (no re-broadcast)
            let peers = state.node.list_peers().await;
            for p in peers {
                if p.id == my_id {
                    continue;
                }
                if let Err(e) = state
                    .node
                    .send_direct_block(&p.id, payload_json.clone())
                    .await
                {
                    warn!("group send error -> {}: {e}", p.id);
                }
            }
        }
    }
    Ok(())
}

/// Fetch all chat payloads (parsed) for UI.
/// (UI normally reads the blockchain, but this is handy for debugging.)
#[tauri::command]
async fn get_chat_history(state: tauri::State<'_, AppState>) -> Result<Vec<ChatPayloadV1>, String> {
    let chain = state.blockchain.lock().await;
    let mut out = Vec::new();
    for b in &chain.chain {
        if let Ok(p) = serde_json::from_str::<ChatPayloadV1>(&b.data) {
            out.push(p);
        }
    }
    Ok(out)
}

/// Reset data: delete blockchain + identity from disk. Advise UI to restart.
#[tauri::command]
async fn reset_data(state: tauri::State<'_, AppState>) -> Result<(), String> {
    // Remove files
    let _ = fs::remove_file(&state.blockchain_path);
    let _ = fs::remove_file(&state.identity_path);

    // Reset blockchain in memory
    {
        let mut chain = state.blockchain.lock().await;
        *chain = Blockchain::new();
        if let Err(e) = chain.save_to_file(&state.blockchain_path) {
            warn!("Failed to save new blockchain: {e}");
        }
    }

    // Generate a new identity
    let new_id = regenerate_identity(&state.identity_path);
    let _new_signing_key = decode_signing_key(&new_id)
        .map_err(|e| format!("failed to decode new key: {e}"))?;
    {
        let mut id = state.identity.lock().await;
        *id = new_id.clone();
    }

    // Update node alias + identity (no restart needed)
    state.node.set_alias(new_id.alias.clone()).await;

    warn!("Local WiChain data reset live (new alias: {}).", new_id.alias);
    let _ = state.app.emit("reset_done", new_id);
    Ok(())
}

