#![cfg_attr(all(not(debug_assertions), target_os = "windows"), windows_subsystem = "windows")]

//! WiChain Tauri backend – *direct LAN chat edition*.
//!
//! ### What changed vs earlier prototypes
//! - **No full-chain broadcast sync.** We now send *per-message* payloads
//!   directly to selected peers (or to all known peers if you choose "Group").
//! - **Chat payload JSON** recorded in the blockchain `data` field so local
//!   history (and message direction) can be reconstructed.
//! - **Alias update & Reset Data commands** so users can rename devices or
//!   wipe local state (identity + ledger) and restart.
//! - **Frontend events**: `peer_update`, `chat_update`, `alias_update`.
//!
//! ### Message Flow
//! 1. UI calls `add_chat_message(text, to_peer)`.
//! 2. Backend creates a `ChatPayloadV1 { from, to, text, ts_ms }`, appends to the
//!    local blockchain, saves to disk, emits `chat_update`.
//! 3. Backend sends a `NetworkMessage::DirectBlock` to the target peer (or all
//!    peers for group chat). The payload is JSON of the `ChatPayloadV1`.
//! 4. Receiving node does *not* re-broadcast. It appends same JSON to local
//!    blockchain and emits `chat_update`.
//!
//! Result: per-peer messaging recorded locally (append-only), no central server.

use std::{
    fs,
    path::{Path, PathBuf},
    sync::Arc,
};

use base64::Engine;
use ed25519_dalek::SigningKey;
use log::{error, info, warn};
use rand::rngs::OsRng;
use serde::{Deserialize, Serialize};
use tokio::sync::{mpsc, Mutex};

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

/// Chat payload we serialize into `Blockchain` blocks and send over the wire.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatPayloadV1 {
    pub from: String,
    pub to: Option<String>, // None => group/all
    pub text: String,
    pub ts_ms: u128,
}

/// ---- application state -----------------------------------------------------
pub struct AppState {
    pub app: AppHandle,
    pub identity: StoredIdentity,
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
            let mut identity = load_or_create_identity(&identity_path);
            let signing_key = decode_signing_key(&identity).unwrap_or_else(|e| {
                warn!("Identity decode error ({e}); regenerating.");
                identity = regenerate_identity(&identity_path);
                decode_signing_key(&identity).expect("fresh identity must decode")
            });
            info!(
                "✅ Identity alias: {}  (pubkey {} chars)",
                identity.alias,
                identity.public_key_b64.len()
            );

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
            let node_id = identity.public_key_b64.clone();
            let node = Arc::new(NetworkNode::new(
                WICHAIN_PORT,
                node_id.clone(),
                identity.alias.clone(),
                identity.public_key_b64.clone(),
            ));

            let (tx, mut rx) = mpsc::channel::<NetworkMessage>(64);

            {
                let node = node.clone();
                tauri::async_runtime::spawn(async move {
                    node.start(tx).await;
                });
            }
            info!(
                "✅ Node started: alias={} id={} port={}",
                identity.alias, node_id, WICHAIN_PORT
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
                            NetworkMessage::Block { block_json } => {
                                // Legacy: if some node still sends full chain, accept only if newer.
                                match serde_json::from_str::<Blockchain>(&block_json) {
                                    Ok(incoming_chain) => {
                                        let mut chain_guard = blockchain.lock().await;
                                        let local_len = chain_guard.chain.len();
                                        let incoming_len = incoming_chain.chain.len();
                                        if incoming_chain.is_valid() && incoming_len > local_len {
                                            *chain_guard = incoming_chain;
                                            if let Err(e) = chain_guard.save_to_file(&blockchain_path) {
                                                error!("Failed saving updated chain: {e}");
                                            } else {
                                                info!(
                                                    "✅ Chain updated from legacy broadcast ({} -> {} blocks)",
                                                    local_len, incoming_len
                                                );
                                                let _ = app_handle_for_task.emit("chat_update", ());
                                            }
                                        }
                                    }
                                    Err(e) => warn!("⚠ Legacy chain parse fail: {e}"),
                                }
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
        .expect("Error running Tauri");
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
    Ok(state.identity.clone())
}

/// Update alias. We update identity file and state; network broadcast thread
/// won’t pick up new alias until restart, so we *also* emit an event advising
/// UI to restart if user wants peers to see new alias immediately.
#[tauri::command]
async fn set_alias(
    state: tauri::State<'_, AppState>,
    new_alias: String,
) -> Result<(), String> {
    if new_alias.trim().is_empty() {
        return Err("alias empty".into());
    }
    let mut id = state.identity.clone();
    id.alias = new_alias.trim().to_string();
    if let Err(e) = fs::write(&state.identity_path, serde_json::to_string_pretty(&id).unwrap()) {
        return Err(format!("write identity: {e}"));
    }
    // update in-memory
    // SAFETY: we can't mutate `state.identity` directly (it's not behind a lock).
    // Instead we leak a mutable reference via raw ptr cast (UB). DON'T DO THAT.
    // Instead: rebuild new AppState? Simpler: just log & emit; user restart recommended.
    warn!("Alias changed on disk; restart app for network broadcast to reflect it.");
    let _ = state.app.emit("alias_update", ());
    Ok(())
}

/// Return current peer list.
#[tauri::command]
async fn get_peers(state: tauri::State<'_, AppState>) -> Result<Vec<PeerInfo>, String> {
    Ok(state.node.list_peers().await)
}

/// Add chat message (to one peer or all).
#[tauri::command]
async fn add_chat_message(
    state: tauri::State<'_, AppState>,
    content: String,
    to_peer: Option<String>,
) -> Result<(), String> {
    let payload = ChatPayloadV1 {
        from: state.identity.public_key_b64.clone(),
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
            if let Err(e) = state.node.send_direct_block(&peer_id, payload_json.clone()).await {
                warn!("send_direct_block error: {e}");
            }
        }
        None => {
            // group = send to everyone separately (no re-broadcast)
            let peers = state.node.list_peers().await;
            for p in peers {
                if p.id == state.identity.public_key_b64 {
                    continue;
                }
                if let Err(e) = state.node.send_direct_block(&p.id, payload_json.clone()).await {
                    warn!("group send error -> {}: {e}", p.id);
                }
            }
        }
    }
    Ok(())
}

/// Fetch all chat payloads (parsed) for UI.
#[tauri::command]
async fn get_chat_history(state: tauri::State<'_, AppState>) -> Result<Vec<ChatPayloadV1>, String> {
    let chain = state.blockchain.lock().await;
    // Each block is text JSON; parse best-effort.
    let mut out = Vec::new();
    for b in &chain.chain {
        if let Ok(p) = serde_json::from_str::<ChatPayloadV1>(&b.data) {
            out.push(p);
        }
    }
    Ok(out)
}

/// Reset data: delete blockchain + identity from disk. We *do not* rebuild the
/// running state here; instead we tell the UI to prompt user to restart WiChain.
#[tauri::command]
async fn reset_data(state: tauri::State<'_, AppState>) -> Result<(), String> {
    let _ = fs::remove_file(&state.blockchain_path);
    let _ = fs::remove_file(&state.identity_path);
    warn!("Local WiChain data deleted; please restart app.");
    let _ = state.app.emit("reset_done", ());
    Ok(())
}
