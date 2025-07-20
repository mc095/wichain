#![cfg_attr(all(not(debug_assertions), target_os = "windows"), windows_subsystem = "windows")]

//! WiChain Tauri backend – *direct LAN, signed cleartext demo* (no broadcast, no group mode).
//!
//! ### This build
//! - **Direct only:** You *must* choose a peer; no broadcast / group send paths.
//! - **Signed messages:** Every outbound chat is serialized as [`ChatBody`] then signed
//!   with this device's Ed25519 key → [`ChatSigned`].
//! - **Clear transport:** Signed JSON is sent in the clear over UDP for maximum
//!   interoperability across mixed builds. (Encryption can be re‑enabled later.)
//! - **Tamper‑evident log:** Received or sent messages are appended verbatim to a local
//!   blockchain file. (On startup we *do not* auto‑wipe; use Reset Chat in UI.)
//! - **Alias hot‑update:** Update alias live; we re‑announce on LAN.
//! - **Reset chat only:** Command wipes *blockchain* and emits `reset_done` but keeps identity.
//!
//! ### Events to UI
//! `peer_update`, `chat_update`, `alias_update`, `reset_done`.
//!
//! ### Commands
//! `get_identity`, `set_alias`, `get_peers`, `add_chat_message`, `get_chat_history`, `reset_data`.
//!
//! ### Security Note
//! Messages are *signed* but *not encrypted* in this build. Anyone on the LAN
//! can read them, but tampering is detectable (if you check signatures).

use std::{
    fs,
    path::{Path, PathBuf},
    sync::Arc,
};

use base64::{engine::general_purpose, Engine as _};
use ed25519_dalek::{Signer as _, SigningKey, VerifyingKey};
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

/// Canonical body we sign & display.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatBody {
    pub from: String,        // sender pubkey b64
    pub to: Option<String>,  // receiver pubkey b64
    pub text: String,        // UTF‑8
    pub ts_ms: u128,         // unix ms
}

/// Signed body we transmit & store.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatSigned {
    #[serde(flatten)]
    pub body: ChatBody,
    pub sig_b64: String,
}

impl ChatSigned {
    pub fn new_signed(body: ChatBody, sk: &SigningKey) -> Self {
        let bytes = serde_json::to_vec(&body).expect("serialize body");
        let sig = sk.sign(&bytes);
        Self {
            body,
            sig_b64: general_purpose::STANDARD.encode(sig.to_bytes()),
        }
    }

    pub fn verify(&self, vk: &VerifyingKey) -> bool {
        let bytes = match serde_json::to_vec(&self.body) {
            Ok(b) => b,
            Err(_) => return false,
        };
        let sig_bytes = match general_purpose::STANDARD.decode(self.sig_b64.as_bytes()) {
            Ok(b) => b,
            Err(_) => return false,
        };
        if sig_bytes.len() != 64 {
            return false;
        }
        let mut arr = [0u8; 64];
        arr.copy_from_slice(&sig_bytes);
        let sig = ed25519_dalek::Signature::from_bytes(&arr);
        vk.verify_strict(&bytes, &sig).is_ok()
    }
}

/// ---- application state -----------------------------------------------------
/// Both identity & signing key sit behind Mutex so we can update live (alias / reset chat).
pub struct AppState {
    pub app: AppHandle,
    pub identity: Arc<Mutex<StoredIdentity>>,
    pub signing_key: Arc<Mutex<SigningKey>>,
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
            let signing_key = match decode_signing_key(&identity_loaded) {
                Ok(sk) => sk,
                Err(e) => {
                    warn!("Identity decode error ({e}); regenerating.");
                    let regenerated = regenerate_identity(&identity_path);
                    decode_signing_key(&regenerated).expect("fresh identity must decode")
                }
            };
            info!(
                "✅ Identity alias: {}  (pubkey {} chars)",
                identity_loaded.alias,
                identity_loaded.public_key_b64.len()
            );
            let identity = Arc::new(Mutex::new(identity_loaded));
            let signing_key = Arc::new(Mutex::new(signing_key));

            // --- Blockchain -------------------------------------------------------------
            let blockchain = if blockchain_path.exists() {
                match Blockchain::load_from_file(&blockchain_path) {
                    Ok(bc) => {
                        info!("✅ Loaded blockchain from disk ({} blocks).", bc.chain.len());
                        bc
                    }
                    Err(e) => {
                        warn!("⚠ Failed to load blockchain ({e}); starting empty.");
                        Blockchain::new()
                    }
                }
            } else {
                info!("ℹ No blockchain found; starting empty.");
                Blockchain::new()
            };
            let blockchain = Arc::new(Mutex::new(blockchain));

            // --- Network Node -----------------------------------------------------------
            let (node_id, node_alias) = {
                let id_guard = identity.blocking_lock();
                (id_guard.public_key_b64.clone(), id_guard.alias.clone())
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
                let identity = Arc::clone(&identity);
                let app_handle_for_task = app.handle().clone();
                tauri::async_runtime::spawn(async move {
                    while let Some(msg) = rx.recv().await {
                        match msg {
                            NetworkMessage::DirectBlock { from, to, payload_json } => {
                                // inbound clear JSON (or legacy text)
                                let my_pub = {
                                    let id = identity.lock().await;
                                    id.public_key_b64.clone()
                                };
                                handle_incoming_network_payload(
                                    &app_handle_for_task,
                                    &blockchain,
                                    &blockchain_path,
                                    &my_pub,
                                    &from,
                                    &to,
                                    &payload_json,
                                )
                                .await;
                            }
                            NetworkMessage::Block { .. } => {
                                // Legacy (ignored; broadcast removed in this build).
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
// identity load / save
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
        general_purpose::STANDARD.encode(signing_key.verifying_key().to_bytes());
    let private_key_b64 = general_purpose::STANDARD.encode(signing_key.to_bytes());

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
    let priv_bytes = general_purpose::STANDARD
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
// chat append / persist helpers
// -----------------------------------------------------------------------------
fn now_ms() -> u128 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or_default()
}

async fn append_chat_json(
    app: &AppHandle,
    blockchain: &Arc<Mutex<Blockchain>>,
    blockchain_path: &Path,
    chat_json: &str,
) {
    {
        let mut chain = blockchain.lock().await;
        chain.add_text_block(chat_json);
        if let Err(e) = chain.save_to_file(blockchain_path) {
            warn!("Failed saving chain after chat: {e}");
        }
    }
    let _ = app.emit("chat_update", ());
}

/// Handle inbound network payload (clear `ChatSigned` JSON or legacy plain text).
async fn handle_incoming_network_payload(
    app: &AppHandle,
    blockchain: &Arc<Mutex<Blockchain>>,
    blockchain_path: &Path,
    my_pub_b64: &str,
    from_pub_b64: &str,
    to_pub_b64: &str,
    payload_str: &str,
) {
    // Ignore any traffic not destined to us (belt & suspenders).
    if to_pub_b64 != my_pub_b64 {
        return;
    }

    // 1. Try parse ChatSigned directly.
    if let Ok(chat_signed) = serde_json::from_str::<ChatSigned>(payload_str) {
        // best-effort verify
        if let Ok(sender_pub_bytes) = general_purpose::STANDARD.decode(from_pub_b64.as_bytes()) {
            if sender_pub_bytes.len() == 32 {
                if let Ok(vk) =
                    VerifyingKey::from_bytes(sender_pub_bytes.as_slice().try_into().unwrap())
                {
                    if !chat_signed.verify(&vk) {
                        warn!("Inbound chat signature invalid (peer={})", &from_pub_b64[..8]);
                    }
                }
            }
        }
        let json = serde_json::to_string(&chat_signed).unwrap();
        append_chat_json(app, blockchain, blockchain_path, &json).await;
        return;
    }

    // 2. Try parse ChatBody (unsigned legacy clear)
    if let Ok(body) = serde_json::from_str::<ChatBody>(payload_str) {
        let chat = ChatSigned {
            body,
            sig_b64: String::new(),
        };
        let json = serde_json::to_string(&chat).unwrap();
        append_chat_json(app, blockchain, blockchain_path, &json).await;
        return;
    }

    // 3. Plain text fallback (very old builds / unknown formats).
    let chat = ChatSigned {
        body: ChatBody {
            from: from_pub_b64.to_string(),
            to: Some(to_pub_b64.to_string()),
            text: payload_str.to_string(),
            ts_ms: now_ms(),
        },
        sig_b64: String::new(),
    };
    let json = serde_json::to_string(&chat).unwrap();
    append_chat_json(app, blockchain, blockchain_path, &json).await;
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

/// Update alias (hot). Persists + network announce.
#[tauri::command]
async fn set_alias(
    state: tauri::State<'_, AppState>,
    new_alias: String,
) -> Result<(), String> {
    let alias = new_alias.trim();
    if alias.is_empty() {
        return Err("alias empty".into());
    }

    // Update identity in memory + disk
    {
        let mut id = state.identity.lock().await;
        id.alias = alias.to_string();
        if let Err(e) =
            fs::write(&state.identity_path, serde_json::to_string_pretty(&*id).unwrap())
        {
            return Err(format!("write identity: {e}"));
        }
    }

    // Update network alias + broadcast presence
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

/// Add chat message (peer‑to‑peer only; broadcast disabled).
#[tauri::command]
async fn add_chat_message(
    state: tauri::State<'_, AppState>,
    content: String,
    to_peer: Option<String>,
) -> Result<(), String> {
    let peer_id = match to_peer {
        Some(p) if !p.trim().is_empty() => p,
        _ => return Err("peer required".into()),
    };

    let (my_pub, my_sk) = {
        let id = state.identity.lock().await;
        (id.public_key_b64.clone(), Arc::clone(&state.signing_key))
    };

    // canonical body
    let body = ChatBody {
        from: my_pub.clone(),
        to: Some(peer_id.clone()),
        text: content.clone(),
        ts_ms: now_ms(),
    };
    // signed
    let my_sk_locked = my_sk.lock().await;
    let chat_signed = ChatSigned::new_signed(body, &*my_sk_locked);
    drop(my_sk_locked);
    let msg_json = serde_json::to_string(&chat_signed).map_err(|e| e.to_string())?;

    // append locally
    {
        let mut chain = state.blockchain.lock().await;
        chain.add_text_block(msg_json.clone());
        if let Err(e) = chain.save_to_file(&state.blockchain_path) {
            return Err(format!("save error: {e}"));
        }
    }
    let _ = state.app.emit("chat_update", ());

    // send (single peer only)
    if let Err(e) = state.node.send_direct_block(&peer_id, msg_json).await {
        warn!("send_direct_block error -> {}: {e}", peer_id);
    }

    Ok(())
}

/// Fetch all chat payloads we have locally (simplified to `ChatBody` for UI).
#[tauri::command]
async fn get_chat_history(state: tauri::State<'_, AppState>) -> Result<Vec<ChatBody>, String> {
    let my_pub = {
        let id = state.identity.lock().await;
        id.public_key_b64.clone()
    };
    let chain = state.blockchain.lock().await;
    let mut out = Vec::new();
    for b in &chain.chain {
        // Blocks hold JSON `ChatSigned` (preferred) or possibly `ChatBody` (legacy).
        if let Ok(signed) = serde_json::from_str::<ChatSigned>(&b.data) {
            // keep only conversations we are part of
            if signed.body.from == my_pub
                || signed.body.to.as_deref() == Some(&my_pub)
            {
                out.push(signed.body);
            }
            continue;
        }
        if let Ok(body) = serde_json::from_str::<ChatBody>(&b.data) {
            if body.from == my_pub || body.to.as_deref() == Some(&my_pub) {
                out.push(body);
            }
        }
    }
    Ok(out)
}

/// Reset chat *only* (clear blockchain; keep identity).
#[tauri::command]
async fn reset_data(state: tauri::State<'_, AppState>) -> Result<(), String> {
    // Remove blockchain file
    let _ = fs::remove_file(&state.blockchain_path);

    // Reset blockchain in memory
    {
        let mut chain = state.blockchain.lock().await;
        *chain = Blockchain::new();
        if let Err(e) = chain.save_to_file(&state.blockchain_path) {
            warn!("Failed to save new blockchain: {e}");
        }
    }

    // Identity untouched.
    warn!("Local WiChain chat history cleared; identity preserved.");
    let _ = state.app.emit("reset_done", ());
    Ok(())
}
