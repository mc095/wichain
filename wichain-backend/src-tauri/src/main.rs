#![cfg_attr(all(not(debug_assertions), target_os = "windows"), windows_subsystem = "windows")]

// WiChain backend: direct peer‑to‑peer chat + local blockchain log.

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
use tokio::sync::Mutex;

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
    pub identity: Arc<Mutex<StoredIdentity>>,
    pub signing_key: SigningKey,
    pub blockchain: Arc<Mutex<Blockchain>>,
    pub node: Arc<NetworkNode>,
    pub blockchain_path: PathBuf,
    pub data_dir: PathBuf,
}

fn main() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_log::Builder::default()
                .level(log::LevelFilter::Debug)
                .build(),
        )
        .setup(|app| {
            // ── Data dir ──
            let mut data_dir = app
                .path()
                .app_data_dir()
                .unwrap_or_else(|_| PathBuf::from("."));
            data_dir.push("WiChain");
            if let Err(e) = fs::create_dir_all(&data_dir) {
                warn!("Failed to create data dir {:?}: {e}", data_dir);
            }
            info!("✅ App data dir: {:?}", data_dir);

            // ── Identity ──
            let mut id_disk = load_or_create_identity(&data_dir);
            let signing_key = decode_signing_key(&id_disk).unwrap_or_else(|e| {
                warn!("Identity decode error ({e}); regenerating.");
                id_disk = regenerate_identity(&data_dir);
                decode_signing_key(&id_disk).expect("fresh identity must decode")
            });
            info!(
                "✅ Identity alias: {} (pubkey {} chars)",
                id_disk.alias,
                id_disk.public_key_b64.len()
            );
            let identity = Arc::new(Mutex::new(id_disk));

            // ── Blockchain ──
            let blockchain_path = data_dir.join(BLOCKCHAIN_FILE);
            let blockchain = if blockchain_path.exists() {
                match Blockchain::load_from_file(&blockchain_path) {
                    Ok(bc) => {
                        info!("✅ Loaded blockchain ({} blocks).", bc.chain.len());
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

            // ── Network Node ──
            let id_clone = identity.clone();
            let id_guard = futures::executor::block_on(id_clone.lock());
            let node = Arc::new(NetworkNode::new(
                WICHAIN_PORT,
                id_guard.public_key_b64.clone(),
                id_guard.alias.clone(),
                id_guard.public_key_b64.clone(),
            ));
            drop(id_guard);

            // Channel network -> backend
            let (tx, mut rx) = tokio::sync::mpsc::channel::<NetworkMessage>(64);

            // Start network
            {
                let node = node.clone();
                tauri::async_runtime::spawn(async move {
                    node.start(tx).await;
                });
            }
            {
                let id_guard = futures::executor::block_on(identity.lock());
                info!(
                    "✅ Node started: alias={} id={} port={}",
                    id_guard.alias, id_guard.public_key_b64, WICHAIN_PORT
                );
            }

            // ── Background network message loop ──
            {
                let blockchain = blockchain.clone();
                let blockchain_path = blockchain_path.clone();
                let app_handle = app.handle().clone();

                tauri::async_runtime::spawn(async move {
                    while let Some(msg) = rx.recv().await {
                        match msg {
                            // Legacy (ignored except for chain sync)
                            NetworkMessage::Block { block_json } => {
                                match serde_json::from_str::<Blockchain>(&block_json) {
                                    Ok(incoming_chain) => {
                                        let mut guard = blockchain.lock().await;
                                        let local_len = guard.chain.len();
                                        let incoming_len = incoming_chain.chain.len();
                                        if incoming_chain.is_valid() && incoming_len > local_len {
                                            *guard = incoming_chain;
                                            if let Err(e) = guard.save_to_file(&blockchain_path) {
                                                error!("Failed saving incoming chain: {e}");
                                            } else {
                                                info!("✅ Chain replaced via legacy broadcast ({local_len}→{incoming_len}).");
                                                let _ = app_handle.emit("chain_update", ());
                                            }
                                        }
                                    }
                                    Err(e) => warn!("⚠ Bad legacy chain JSON: {e}"),
                                }
                            }
                            // Direct peer message
                            NetworkMessage::DirectBlock { from, to, payload_json } => {
                                let mut guard = blockchain.lock().await;
                                guard.add_text_block(payload_json);
                                if let Err(e) = guard.save_to_file(&blockchain_path) {
                                    warn!("Failed saving chain after DirectBlock: {e}");
                                }
                                let _ = app_handle.emit("chain_update", ());
                                info!("💬 Direct msg from {from} to {to} appended.");
                            }
                            // Discovery updates
                            NetworkMessage::Peer { .. }
                            | NetworkMessage::Ping { .. }
                            | NetworkMessage::Pong { .. } => {
                                let _ = app_handle.emit("peer_update", ());
                                info!("🔔 Peer update event triggered");
                            }
                        }
                    }
                    info!("Network loop ended.");
                });
            }

            // ── Install state ──
            let state = AppState {
                identity,
                signing_key,
                blockchain,
                node,
                blockchain_path,
                data_dir,
            };
            app.manage(state);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_identity,
            set_alias,
            get_peers,
            get_blockchain_json,
            send_text_message
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

// -----------------------------------------------------------------------------
// Tauri Commands
// -----------------------------------------------------------------------------

#[tauri::command]
async fn get_identity(state: tauri::State<'_, AppState>) -> Result<StoredIdentity, String> {
    Ok(state.identity.lock().await.clone())
}

#[tauri::command]
async fn set_alias(
    state: tauri::State<'_, AppState>,
    new_alias: String,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    // Update in memory
    {
        let mut id = state.identity.lock().await;
        id.alias = new_alias.trim().to_string();
        // Persist
        let path = state.data_dir.join("identity.json");
        if let Err(e) = fs::write(&path, serde_json::to_string_pretty(&*id).unwrap()) {
            warn!("Failed to persist new alias: {e}");
        }
        info!("✏️ Alias changed to {}", id.alias);
    }

    // Notify UI
    let _ = app_handle.emit("peer_update", ());
    let _ = app_handle.emit("chain_update", ());

    // One‑shot announce (best effort)
    {
        let id = state.identity.lock().await;
        let msg = NetworkMessage::Peer {
            id: id.public_key_b64.clone(),
            alias: id.alias.clone(),
            pubkey: id.public_key_b64.clone(),
        };
        if let Err(e) = state.node.quick_broadcast(&msg).await {
            warn!("Alias announce error: {e}");
        }
    }

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

/// Direct send only. UI must supply `to_peer`.
#[tauri::command]
async fn send_text_message(
    state: tauri::State<'_, AppState>,
    content: String,
    to_peer: String,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    if content.trim().is_empty() {
        return Err("empty message".into());
    }
    if to_peer.trim().is_empty() {
        return Err("no peer selected".into());
    }

    use std::time::{SystemTime, UNIX_EPOCH};
    let ts = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or_default();

    let id = state.identity.lock().await.clone();
    let payload = serde_json::json!({
        "from": id.public_key_b64,
        "to": to_peer,
        "text": content,
        "ts": ts,
    })
    .to_string();
    drop(id);

    // Append locally
    {
        let mut chain = state.blockchain.lock().await;
        chain.add_text_block(&payload);
        if let Err(e) = chain.save_to_file(&state.blockchain_path) {
            return Err(format!("save error: {e}"));
        }
    }
    let _ = app_handle.emit("chain_update", ());

    // Send network DirectBlock
    if let Err(e) = state.node.send_direct_block(&to_peer, payload.clone()).await {
        warn!("Direct send error: {e}");
    }

    Ok(())
}
