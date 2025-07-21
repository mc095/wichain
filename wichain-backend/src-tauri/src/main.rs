#![cfg_attr(all(not(debug_assertions), target_os = "windows"), windows_subsystem = "windows")]

//! WiChain Tauri backend – **direct LAN, SHA3‑XOR confidential peer & group chat** (no broadcast).
//!
//! ## This build
//! - **Peer‑to‑peer only**; broadcast removed.
//! - **Group chat**: obfuscated copies sent individually (fan‑out) to each member.
//! - **Confidentiality**: SHA3‑512 XOR per‑peer and per‑group derived keys (obfuscation, not encryption).
//! - **Authenticity**: Each plaintext [`ChatBody`] is Ed25519‑signed → [`ChatSigned`].
//! - **Transport**: Signed JSON is obfuscated (XOR+Base64) before being sent over UDP.
//! - **Ledger**: Clear signed JSON appended locally (tamper‑evident blockchain file).
//! - **Alias hot‑update**: Rename device live; peers discover via LAN.
//! - **Reset chat only**: Clears blockchain; identity preserved.
//!
//! ## Events emitted
//! `peer_update`, `chat_update`, `alias_update`, `reset_done`.
//!
//! ## Commands
//! `get_identity`, `set_alias`, `get_peers`, `add_chat_message`,
//! `create_group`, `list_groups`, `add_group_message`, `get_chat_history`, `reset_data`.

use std::{
    fs,
    path::{Path, PathBuf},
    sync::Arc,
};

use base64::{engine::general_purpose, Engine as _};
use ed25519_dalek::{Signer as _, SigningKey, VerifyingKey};
use log::{debug, info, warn};
use rand::rngs::OsRng;
use serde::{Deserialize, Serialize};
use sha3::{Digest, Sha3_512};
use tokio::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager};

use wichain_blockchain::Blockchain;
use wichain_network::{NetworkMessage, NetworkNode, PeerInfo};

mod group_manager;
use group_manager::{GroupInfo, GroupManager};

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
    pub to: Option<String>,  // receiver pubkey b64 OR group_id
    pub text: String,        // UTF‑8
    pub ts_ms: u128,         // unix ms
}

/// Signed body (plaintext + Ed25519 sig).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatSigned {
    #[serde(flatten)]
    pub body: ChatBody,
    pub sig_b64: String,
}

// -----------------------------------------------------------------------------
// Lightweight SHA3-512 XOR "confidentiality" helpers
// -----------------------------------------------------------------------------

/// Derive a 64-byte mask from two pubkeys (sorted) using SHA3-512.
fn simple_pair_mask(pub_a: &str, pub_b: &str) -> [u8; 64] {
    let (lo, hi) = if pub_a <= pub_b { (pub_a, pub_b) } else { (pub_b, pub_a) };
    let mut h = Sha3_512::default();
    h.update(lo.as_bytes());
    h.update(b"|");
    h.update(hi.as_bytes());
    let digest = h.finalize();
    let mut out = [0u8; 64];
    out.copy_from_slice(&digest[..]);
    out
}

/// XOR data with repeating mask bytes.
fn simple_xor(data: &[u8], mask: &[u8]) -> Vec<u8> {
    data.iter()
        .enumerate()
        .map(|(i, b)| b ^ mask[i % mask.len()])
        .collect()
}

/// Obfuscate clear JSON string → base64 string.
fn simple_obfuscate_json(my_pub: &str, other_pub: &str, clear_json: &str) -> String {
    let mask = simple_pair_mask(my_pub, other_pub);
    let x = simple_xor(clear_json.as_bytes(), &mask);
    general_purpose::STANDARD.encode(x)
}

/// Attempt to de‑obfuscate b64 string back to JSON.
fn simple_deobfuscate_json(my_pub: &str, other_pub: &str, b64_payload: &str) -> Option<String> {
    let bytes = general_purpose::STANDARD.decode(b64_payload.as_bytes()).ok()?;
    let mask = simple_pair_mask(my_pub, other_pub);
    let clear = simple_xor(&bytes, &mask);
    String::from_utf8(clear).ok()
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
        let sig_bytes = match general_purpose::STANDARD.decode(&self.sig_b64) {
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
pub struct AppState {
    pub app: AppHandle,
    pub identity: Arc<Mutex<StoredIdentity>>,
    pub signing_key: Arc<Mutex<SigningKey>>,
    pub blockchain: Arc<Mutex<Blockchain>>,
    pub node: Arc<NetworkNode>,
    pub groups: Arc<GroupManager>,
    pub blockchain_path: PathBuf,
    pub identity_path: PathBuf,
}

// -----------------------------------------------------------------------------
// main
// -----------------------------------------------------------------------------
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
            // Load & decode; regenerate if corrupt.
            let mut identity_loaded = load_or_create_identity(&identity_path);
            let signing_key = match decode_signing_key(&identity_loaded) {
                Ok(sk) => sk,
                Err(e) => {
                    warn!("Identity decode error ({e}); regenerating fresh identity.");
                    identity_loaded = regenerate_identity(&identity_path);
                    decode_signing_key(&identity_loaded).expect("fresh identity must decode")
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

            // --- Group Manager ----------------------------------------------------------
            let groups = GroupManager::new();

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

            // Spawn network loop
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
                            NetworkMessage::Peer { .. }
                            | NetworkMessage::Ping { .. }
                            | NetworkMessage::Pong { .. } => {
                                let _ = app_handle_for_task.emit("peer_update", ());
                            }
                            NetworkMessage::Block { .. } => {
                                // Broadcast unsupported in this build.
                            }
                        }
                    }
                });
            }

            // --- Install state ----------------------------------------------------------
            app.manage(AppState {
                app: app.handle().clone(),
                identity,
                signing_key,
                blockchain,
                node,
                groups,
                blockchain_path,
                identity_path,
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_identity,
            set_alias,
            get_peers,
            add_chat_message,
            create_group,
            list_groups,
            add_group_message,
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

    let id = StoredIdentity { alias, public_key_b64, private_key_b64 };
    if let Err(e) = fs::write(path, serde_json::to_string_pretty(&id).unwrap()) {
        warn!("Failed to write identity.json: {e}");
    }
    id
}

fn decode_signing_key(id: &StoredIdentity) -> Result<SigningKey, String> {
    let priv_bytes = general_purpose::STANDARD
        .decode(&id.private_key_b64)
        .map_err(|e| format!("decode private key: {e}"))?;
    if priv_bytes.len() != 32 {
        return Err(format!("private key wrong length {}", priv_bytes.len()));
    }
    let mut arr = [0u8; 32];
    arr.copy_from_slice(&priv_bytes);
    Ok(SigningKey::from_bytes(&arr))
}

// -----------------------------------------------------------------------------
// inbound network handler
// -----------------------------------------------------------------------------
async fn handle_incoming_network_payload(
    app: &AppHandle,
    blockchain: &Arc<Mutex<Blockchain>>,
    blockchain_path: &Path,
    my_pub_b64: &str,
    network_from_b64: &str,
    _network_to_b64: &str,
    payload_str: &str,
) {
    // 0. Try direct deobfuscation with reported "from"
    if let Some(clear_json) = simple_deobfuscate_json(my_pub_b64, network_from_b64, payload_str) {
        if let Ok(chat_signed) = serde_json::from_str::<ChatSigned>(&clear_json) {
            record_decrypted_chat(app, blockchain, blockchain_path, &chat_signed, network_from_b64).await;
            return;
        }
    }

    // 1. Brute try deobfuscation with all peers (in case 'from' is wrong)
    let peers = app.state::<AppState>().node.list_peers().await;
    for p in peers {
        if let Some(clear_json) = simple_deobfuscate_json(my_pub_b64, &p.id, payload_str) {
            if let Ok(chat_signed) = serde_json::from_str::<ChatSigned>(&clear_json) {
                record_decrypted_chat(app, blockchain, blockchain_path, &chat_signed, &p.id).await;
                return;
            }
        }
    }

    // 2. Try if the payload is already clear ChatSigned JSON
    if let Ok(chat_signed) = serde_json::from_str::<ChatSigned>(payload_str) {
        record_decrypted_chat(app, blockchain, blockchain_path, &chat_signed, network_from_b64).await;
        return;
    }

    // 3. Fallback: wrap raw payload as plain text (force store as text)
    let chat_signed = ChatSigned {
        body: ChatBody {
            from: network_from_b64.to_string(),
            to: Some(my_pub_b64.to_string()),
            text: format!("[UNREADABLE] {}", payload_str),
            ts_ms: now_ms(),
        },
        sig_b64: String::new(),
    };
    record_decrypted_chat(app, blockchain, blockchain_path, &chat_signed, network_from_b64).await;
}


// -----------------------------------------------------------------------------
// chat persistence
// -----------------------------------------------------------------------------
fn now_ms() -> u128 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_millis()).unwrap_or_default()
}

async fn record_decrypted_chat(
    app: &AppHandle,
    blockchain: &Arc<Mutex<Blockchain>>,
    blockchain_path: &Path,
    chat_signed: &ChatSigned,
    _network_from_b64: &str,
) {
    let json = serde_json::to_string(chat_signed).unwrap();
    {
        let mut chain = blockchain.lock().await;
        chain.add_text_block(json.clone());
        let _ = chain.save_to_file(blockchain_path);
    }
    let _ = app.emit("chat_update", ());
    debug!("record_decrypted_chat: appended to blockchain ({} bytes).", json.len());
}

// -----------------------------------------------------------------------------
// Tauri commands
// -----------------------------------------------------------------------------
#[tauri::command]
async fn get_identity(state: tauri::State<'_, AppState>) -> Result<StoredIdentity, String> {
    Ok(state.identity.lock().await.clone())
}

#[tauri::command]
async fn set_alias(state: tauri::State<'_, AppState>, new_alias: String) -> Result<(), String> {
    let alias = new_alias.trim();
    if alias.is_empty() {
        return Err("alias empty".into());
    }

    {
        let mut id = state.identity.lock().await;
        id.alias = alias.to_string();
        fs::write(&state.identity_path, serde_json::to_string_pretty(&*id).unwrap())
            .map_err(|e| format!("write identity: {e}"))?;
    }

    state.node.set_alias(alias.to_string()).await;
    let _ = state.app.emit("alias_update", ());
    Ok(())
}

#[tauri::command]
async fn get_peers(state: tauri::State<'_, AppState>) -> Result<Vec<PeerInfo>, String> {
    let peers = state.node.list_peers().await;
    let my_id = state.identity.lock().await.public_key_b64.clone();
    Ok(peers.into_iter().filter(|p| p.id != my_id).collect())
}

#[tauri::command]
async fn add_chat_message(
    state: tauri::State<'_, AppState>,
    content: String,
    to_peer: String,
) -> Result<(), String> {
    let peer_id = to_peer.trim();
    if peer_id.is_empty() {
        return Err("peer required".into());
    }

    let my_pub = state.identity.lock().await.public_key_b64.clone();
    let my_sk = state.signing_key.lock().await.clone();

    let body = ChatBody {
        from: my_pub.clone(),
        to: Some(peer_id.to_string()),
        text: content.clone(),
        ts_ms: now_ms(),
    };
    let chat_signed = ChatSigned::new_signed(body, &my_sk);
    let clear_json = serde_json::to_string(&chat_signed).unwrap();

    {
        let mut chain = state.blockchain.lock().await;
        chain.add_text_block(clear_json.clone());
        chain.save_to_file(&state.blockchain_path).ok();
    }
    let _ = state.app.emit("chat_update", ());

    let obf_b64 = simple_obfuscate_json(&my_pub, peer_id, &clear_json);
    let _ = state.node.send_direct_block(peer_id, obf_b64).await;
    Ok(())
}

#[tauri::command]
async fn create_group(state: tauri::State<'_, AppState>, members: Vec<String>) -> Result<String, String> {
    if members.is_empty() {
        return Err("group needs at least 1 member".into());
    }
    Ok(state.groups.create_group(members))
}

#[tauri::command]
async fn list_groups(state: tauri::State<'_, AppState>) -> Result<Vec<GroupInfo>, String> {
    Ok(state.groups.list_groups())
}

#[tauri::command]
async fn add_group_message(
    state: tauri::State<'_, AppState>,
    content: String,
    group_id: String,
) -> Result<(), String> {
    let group = state.groups.get_group(&group_id).ok_or("unknown group")?;
    let (my_pub, chat_signed) = {
        let id = state.identity.lock().await;
        let sk = state.signing_key.lock().await;
        let body = ChatBody {
            from: id.public_key_b64.clone(),
            to: Some(group_id.clone()),
            text: content.clone(),
            ts_ms: now_ms(),
        };
        (id.public_key_b64.clone(), ChatSigned::new_signed(body, &*sk))
    };

    let clear_json = serde_json::to_string(&chat_signed).unwrap();
    {
        let mut chain = state.blockchain.lock().await;
        chain.add_text_block(clear_json.clone());
        chain.save_to_file(&state.blockchain_path).ok();
    }
    let _ = state.app.emit("chat_update", ());

    for member in group.members.iter().filter(|m| *m != &my_pub) {
        let obf = simple_obfuscate_json(&my_pub, member, &clear_json);
        let _ = state.node.send_direct_block(member, obf).await;
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
        if let Ok(signed) = serde_json::from_str::<ChatSigned>(&b.data) {
            if signed.body.from == my_pub
                || signed.body.to.as_deref() == Some(&my_pub)
                || signed
                    .body
                    .to
                    .as_ref()
                    .map(|gid| state.groups.is_member(gid, &my_pub))
                    .unwrap_or(false)
            {
                out.push(signed.body);
            }
            continue;
        }
        if let Ok(body) = serde_json::from_str::<ChatBody>(&b.data) {
            if body.from == my_pub
                || body.to.as_deref() == Some(&my_pub)
                || body
                    .to
                    .as_ref()
                    .map(|gid| state.groups.is_member(gid, &my_pub))
                    .unwrap_or(false)
            {
                out.push(body);
            }
        }
    }
    Ok(out)
}

/// Reset chat *only* (clear blockchain; keep identity & groups).
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

    warn!("Local WiChain chat history cleared; identity preserved.");
    let _ = state.app.emit("reset_done", ());
    Ok(())
}


