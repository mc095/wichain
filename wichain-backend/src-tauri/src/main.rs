#![cfg_attr(all(not(debug_assertions), target_os = "windows"), windows_subsystem = "windows")]

use std::{
    fs,
    path::{Path, PathBuf},
    sync::Arc,
};

use base64::Engine;
use ed25519_dalek::SigningKey;
use log::{ info, warn};
use rand::rngs::OsRng;
use serde::{Deserialize, Serialize};
use tokio::sync::{mpsc, Mutex};

use tauri::{Emitter, Manager};

use wichain_blockchain::Blockchain;
use wichain_network::{NetworkMessage, NetworkNode, PeerInfo};

const WICHAIN_PORT: u16 = 60000;
const BLOCKCHAIN_FILE: &str = "blockchain.json";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoredIdentity {
    pub alias: String,
    pub private_key_b64: String,
    pub public_key_b64: String,
}

pub struct AppState {
    pub app_handle: tauri::AppHandle,
    pub data_dir: PathBuf,
    pub identity: Arc<Mutex<StoredIdentity>>,
    pub signing_key: SigningKey, // immutable; we never change keys after launch
    pub blockchain: Arc<Mutex<Blockchain>>,
    pub node: Arc<NetworkNode>,
    pub blockchain_path: PathBuf,
}

fn main() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_log::Builder::default()
                .level(log::LevelFilter::Debug)
                .build(),
        )
        .setup(|app| {
            // Data directory -------------------------------------------------
            let mut data_dir = app.path().app_data_dir().unwrap_or_else(|_| PathBuf::from("."));
            data_dir.push("WiChain");
            if let Err(e) = fs::create_dir_all(&data_dir) {
                warn!("Failed to create data dir {:?}: {e}", data_dir);
            }
            info!("✅ App data dir: {:?}", data_dir);

            // Identity -------------------------------------------------------
            let mut identity = load_or_create_identity(&data_dir);
            let signing_key = decode_signing_key(&identity).unwrap_or_else(|e| {
                warn!("Identity decode error ({e}); regenerating.");
                identity = regenerate_identity(&data_dir);
                decode_signing_key(&identity).expect("fresh identity must decode")
            });
            info!(
                "✅ Identity alias: {}  (pubkey {} chars)",
                identity.alias, identity.public_key_b64.len()
            );
            let identity_lock = Arc::new(Mutex::new(identity.clone()));

            // Blockchain -----------------------------------------------------
            let blockchain_path = data_dir.join(BLOCKCHAIN_FILE);
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

            // Network Node ---------------------------------------------------
            let node_id = identity.public_key_b64.clone();
            let node = Arc::new(NetworkNode::new(
                WICHAIN_PORT,
                node_id.clone(),
                identity.alias.clone(),
                identity.public_key_b64.clone(),
            ));

            // channel network->backend
            let (tx, mut rx) = mpsc::channel::<NetworkMessage>(64);

            // start network
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

            // background: network message processing -------------------------
            {
                let blockchain = Arc::clone(&blockchain);
                let blockchain_path = blockchain_path.clone();
                let app_handle_for_task = app.handle().clone();
                tauri::async_runtime::spawn(async move {
                    while let Some(msg) = rx.recv().await {
                        match msg {
                            NetworkMessage::Block { .. } => {
                                // Legacy broadcast ignored.
                                info!("(ignored legacy Block broadcast)");
                            }
                            NetworkMessage::DirectBlock { from, to, payload_json } => {
                                // Accept all; append JSON payload to local chain.
                                let mut chain_guard = blockchain.lock().await;
                                chain_guard.add_text_block(payload_json.clone());
                                if let Err(e) = chain_guard.save_to_file(&blockchain_path) {
                                    warn!("Failed saving chain after direct block: {e}");
                                }
                                info!(
                                    "📥 Direct msg {} -> {} appended.",
                                    &from[..8.min(from.len())],
                                    &to[..8.min(to.len())]
                                );
                                let _ = app_handle_for_task.emit("chain_update", ());
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

            // install state --------------------------------------------------
            let state = AppState {
                app_handle: app.handle().clone(),
                data_dir,
                identity: identity_lock,
                signing_key,
                blockchain,
                node,
                blockchain_path,
            };
            app.manage(state);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_identity,
            set_alias,
            get_peers,
            get_blockchain_json,
            add_text_message
        ])
        .run(tauri::generate_context!())
        .expect("Error running Tauri");
}

// -----------------------------------------------------------------------------
// Identity helpers
// -----------------------------------------------------------------------------
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

fn load_or_create_identity(dir: &Path) -> StoredIdentity {
    let path = dir.join("identity.json");
    if let Ok(data) = fs::read_to_string(&path) {
        if let Ok(id) = serde_json::from_str::<StoredIdentity>(&data) {
            return id;
        }
        warn!("Failed to parse identity.json; regenerating.");
    }
    regenerate_identity(dir)
}

fn regenerate_identity(dir: &Path) -> StoredIdentity {
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
    let path = dir.join("identity.json");
    if let Err(e) = fs::write(&path, serde_json::to_string_pretty(&id).unwrap()) {
        warn!("Failed to write identity.json: {e}");
    }
    id
}

fn persist_identity(dir: &Path, id: &StoredIdentity) -> anyhow::Result<()> {
    let path = dir.join("identity.json");
    fs::write(path, serde_json::to_string_pretty(id)?)?;
    Ok(())
}

// -----------------------------------------------------------------------------
// Commands
// -----------------------------------------------------------------------------

#[tauri::command]
async fn get_identity(state: tauri::State<'_, AppState>) -> Result<StoredIdentity, String> {
    Ok(state.identity.lock().await.clone())
}

/// Update alias, persist, notify node + UI.
/// Arg name is `new_alias` to match frontend.
#[tauri::command]
async fn set_alias(
    state: tauri::State<'_, AppState>,
    new_alias: String,
) -> Result<(), String> {
    let trimmed = new_alias.trim();
    if trimmed.is_empty() {
        return Err("alias empty".into());
    }

    // update identity in memory
    {
        let mut id = state.identity.lock().await;
        id.alias = trimmed.to_string();
        if let Err(e) = persist_identity(&state.data_dir, &id) {
            warn!("persist alias error: {e}");
        }
        // local log
        info!("🔄 Alias updated -> {}", id.alias);
    }

    // update network node alias (broadcast presence)
    state.node.set_alias(trimmed.to_string()).await;

    // bump UI
    let _ = state.app_handle.emit("peer_update", ());
    Ok(())
}

#[tauri::command]
async fn get_peers(state: tauri::State<'_, AppState>) -> Result<Vec<PeerInfo>, String> {
    Ok(state.node.list_peers().await)
}

#[tauri::command]
async fn get_blockchain_json(state: tauri::State<'_, AppState>) -> Result<String, String> {
    let chain = state.blockchain.lock().await;
    serde_json::to_string_pretty(&*chain).map_err(|e| e.to_string())
}

/// Direct message *required* (`to_peer`). Stored locally + sent to peer.
#[tauri::command]
async fn add_text_message(
    state: tauri::State<'_, AppState>,
    content: String,
    to_peer: Option<String>,
) -> Result<String, String> {
    let peer_id = to_peer.ok_or_else(|| "No peer selected".to_string())?;
    let from_pub = {
        let id = state.identity.lock().await;
        id.public_key_b64.clone()
    };

    // Canonical JSON payload
    let payload_json = serde_json::json!({
        "from": from_pub,
        "to": peer_id,
        "text": content,
        "ts": current_timestamp_ms(),
    })
    .to_string();

    // append & persist
    {
        let mut chain = state.blockchain.lock().await;
        chain.add_text_block(payload_json.clone());
        if let Err(e) = chain.save_to_file(&state.blockchain_path) {
            return Err(format!("save error: {e}"));
        }
    }

    // emit local update
    let _ = state.app_handle.emit("chain_update", ());

    // send network
    if let Err(e) = state.node.send_direct_block(&peer_id, payload_json.clone()).await {
        warn!("Failed sending direct block to {peer_id}: {e}");
    }

    Ok("ok".into())
}

// timestamp helper
fn current_timestamp_ms() -> u128 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or_default()
}
