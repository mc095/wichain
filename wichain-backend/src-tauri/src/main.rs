#![cfg_attr(all(not(debug_assertions), target_os = "windows"), windows_subsystem = "windows")]

//! WiChain Tauri backend bootstrap (LAN P2P messaging demo).
//!
//! Responsibilities
//! ----------------
//! • Resolve per-user data dir.
//! • Load/save identity (alias + Ed25519 keys, base64).
//! • Load/save local blockchain (append-only log of chat events).
//! • Start UDP LAN node for discovery + message relay.
//! • Bridge network events -> frontend window events (`peer_update`, `chain_update`).
//! • Provide Tauri commands the UI can call.

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

/// UDP port used for WiChain LAN discovery/traffic.
const WICHAIN_PORT: u16 = 60000;

/// Relative filename for persisted blockchain.
const BLOCKCHAIN_FILE: &str = "blockchain.json";

/// Identity persisted to disk.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoredIdentity {
    pub alias: String,
    pub private_key_b64: String,
    pub public_key_b64: String,
}

/// Shared state for Tauri commands.
pub struct AppState {
    pub identity: StoredIdentity,
    pub signing_key: SigningKey,
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
            //
            // ── Data directory ────────────────────────────────────────────────────────
            //
            let mut data_dir = app.path().app_data_dir().unwrap_or_else(|_| PathBuf::from("."));
            data_dir.push("WiChain");
            if let Err(e) = fs::create_dir_all(&data_dir) {
                warn!("Failed to create data dir {:?}: {e}", data_dir);
            }
            info!("✅ App data dir: {:?}", data_dir);

            //
            // ── Identity ─────────────────────────────────────────────────────────────
            //
            let mut identity = load_or_create_identity(&data_dir);
            let signing_key = decode_signing_key(&identity).unwrap_or_else(|e| {
                warn!("Identity decode error ({e}); regenerating.");
                identity = regenerate_identity(&data_dir);
                decode_signing_key(&identity).expect("fresh identity must decode")
            });
            info!(
                "✅ Identity alias: {}  (pubkey {} chars)",
                identity.alias,
                identity.public_key_b64.len()
            );

            //
            // ── Blockchain ───────────────────────────────────────────────────────────
            //
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

            //
            // ── Network Node ─────────────────────────────────────────────────────────
            //
            let node_id = identity.public_key_b64.clone(); // node id == b64 public key
            let node = Arc::new(NetworkNode::new(
                WICHAIN_PORT,
                node_id.clone(),
                identity.alias.clone(),
                identity.public_key_b64.clone(),
            ));

            let (tx, mut rx) = mpsc::channel::<NetworkMessage>(64);

            // Start the async network tasks.
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

            //
            // ── Network -> State -> UI bridge task ───────────────────────────────────
            //
            {
                let blockchain = Arc::clone(&blockchain);
                let blockchain_path = blockchain_path.clone();
                let app_handle_for_task = app.handle().clone();
                tauri::async_runtime::spawn(async move {
                    while let Some(msg) = rx.recv().await {
                        match msg {
                            // -----------------------------------------------------------------
                            // Legacy full-chain broadcast
                            // -----------------------------------------------------------------
                            NetworkMessage::Block { block_json } => {
                                match serde_json::from_str::<Blockchain>(&block_json) {
                                    Ok(incoming_chain) => {
                                        let mut chain_guard = blockchain.lock().await;
                                        let local_len = chain_guard.chain.len();
                                        let incoming_len = incoming_chain.chain.len();
                                        if incoming_chain.is_valid() && incoming_len > local_len {
                                            *chain_guard = incoming_chain;
                                            if let Err(e) =
                                                chain_guard.save_to_file(&blockchain_path)
                                            {
                                                error!("Failed saving updated chain: {e}");
                                            } else {
                                                info!(
                                                    "✅ Blockchain updated from peer ({} -> {} blocks)",
                                                    local_len, incoming_len
                                                );
                                                let _ = app_handle_for_task.emit("chain_update", ());
                                            }
                                        }
                                    }
                                    Err(e) => warn!("⚠ Failed to parse incoming blockchain JSON: {e}"),
                                }
                            }

                            // -----------------------------------------------------------------
                            // New direct peer → peer block payload
                            //   For now treat payload_json as *text* content and append
                            //   a local text block tagged w/ peer ids so UI can filter.
                            // -----------------------------------------------------------------
                            NetworkMessage::DirectBlock { from, to, payload_json } => {
                                let mut chain_guard = blockchain.lock().await;
                                // We store: @peer:<from>:<to>:::<content>
                                // (Double-colon separates ids from content; easy split in UI)
                                let payload = format!("@peer:{from}:{to}:::{payload_json}");
                                chain_guard.add_text_block(payload);
                                if let Err(e) =
                                    chain_guard.save_to_file(&blockchain_path)
                                {
                                    warn!("Failed saving chain after direct block: {e}");
                                }
                                let _ = app_handle_for_task.emit("chain_update", ());
                            }

                            // -----------------------------------------------------------------
                            // Peer table change signals
                            // -----------------------------------------------------------------
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

            //
            // ── Install shared state ─────────────────────────────────────────────────
            //
            let state = AppState {
                identity,
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
            get_peers,
            get_blockchain_json,
            add_text_message
        ])
        .run(tauri::generate_context!())
        .expect("Error running Tauri");
}

// ============================================================================
// Identity helpers
// ============================================================================

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

// ============================================================================
// Tauri Commands
// ============================================================================

#[tauri::command]
async fn get_identity(state: tauri::State<'_, AppState>) -> Result<StoredIdentity, String> {
    Ok(state.identity.clone())
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

/// Add a text message. If `to_peer` is `Some(id)` we send directly; else broadcast
/// to **all** peers (group chat) by sending a DirectBlock to each.
/// We also append *locally* so history persists across runs.
///
/// NOTE: We accept `to_peer` from the frontend as an **Option<String>**. In JS
/// call this with `{ to_peer: someIdOrNull }`.
#[tauri::command]
async fn add_text_message(
    app: AppHandle,                  // for event emit
    state: tauri::State<'_, AppState>,
    content: String,
    to_peer: Option<String>,
) -> Result<String, String> {
    // Append locally + persist.
    {
        let mut chain = state.blockchain.lock().await;
        let payload = if let Some(ref peer_id) = to_peer {
            format!("@peer:{peer_id}:::{content}")
        } else {
            content.clone()
        };
        chain.add_text_block(payload);
        if let Err(e) = chain.save_to_file(&state.blockchain_path) {
            return Err(format!("save error: {e}"));
        }
    }

    // Let UI update immediately.
    let _ = app.emit("chain_update", ());

    // Send over network.
    match to_peer {
        Some(peer_id) => {
            // Direct to a single peer
            if let Err(e) = state.node.send_direct_block(&peer_id, content.clone()).await {
                warn!("Failed sending direct block to {peer_id}: {e}");
            }
        }
        None => {
            // Broadcast group chat: send direct to every peer we know
            let peers = state.node.list_peers().await;
            for peer in peers {
                if let Err(e) = state.node.send_direct_block(&peer.id, content.clone()).await {
                    warn!("Failed sending group msg to {}: {e}", peer.id);
                }
            }
        }
    }

    Ok("ok".into())
}
