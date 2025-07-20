#![cfg_attr(all(not(debug_assertions), target_os = "windows"), windows_subsystem = "windows")]

//! WiChain Tauri backend – **direct LAN, AES‑confidential peer & group chat** (no broadcast).
//!
//! ## This build
//! - **Peer‑to‑peer only**; broadcast removed.
//! - **Group chat**: encrypted copies sent individually (fan‑out) to each member.
//! - **Confidentiality**: AES‑256‑GCM per‑peer and per‑group derived keys.
//! - **Authenticity**: Each plaintext [`ChatBody`] is Ed25519‑signed → [`ChatSigned`].
//! - **Transport**: Signed JSON is encrypted before being sent over UDP.
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
//!
//! ## Demo Security Model
//! - Shared AES keys derived deterministically (SHA3‑256) from peer pubkeys or sorted group member list (no forward secrecy).
//! - Group membership included in each encrypted payload so receivers can derive key statelessly.
//! - Ledger stores cleartext signed records for UI & auditing.
//! - Signature verification best effort; message recorded even if verify fails (logged).

use std::{
    fs,
    path::{Path, PathBuf},
    sync::Arc,
};

use aes_gcm::aead::{Aead, KeyInit};
use aes_gcm::{Aes256Gcm, Key, Nonce};
use base64::{engine::general_purpose, Engine as _};
use ed25519_dalek::{Signer as _, SigningKey, VerifyingKey};
use log::{info, warn};
use rand::{rngs::OsRng, RngCore};
use serde::{Deserialize, Serialize};
use sha3::{Digest, Sha3_256};
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

/// Encrypted container sent over the network.
///
/// For **group** messages we include `group_members` so receivers can derive
/// the same AES key statelessly (no local group registration required to decrypt).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatEncrypted {
    pub from: String,                  // sender pubkey b64
    pub to: Option<String>,            // peer pubkey OR group_id
    pub nonce_b64: String,
    pub ciphertext_b64: String,
    pub ts_ms: u128,
    pub is_group: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub group_members: Option<Vec<String>>, // required if is_group
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
// AES helpers
// -----------------------------------------------------------------------------

/// Peer key derivation: stable ordering so both sides match.
fn derive_peer_aes_key(a: &str, b: &str) -> Key<Aes256Gcm> {
    let (lo, hi) = if a <= b { (a, b) } else { (b, a) };
    let mut hasher = Sha3_256::default(); 
    hasher.update(lo.as_bytes());
    hasher.update(b"|");
    hasher.update(hi.as_bytes());
    let digest = hasher.finalize();
    Key::<Aes256Gcm>::from_slice(&digest[..32]).clone()
}

fn encrypt_aes(plaintext: &[u8], key: &Key<Aes256Gcm>) -> (Vec<u8>, [u8; 12]) {
    let cipher = Aes256Gcm::new(key);
    let mut nonce = [0u8; 12];
    rand::thread_rng().fill_bytes(&mut nonce);
    let nonce_obj = Nonce::from_slice(&nonce);
    let ct = cipher.encrypt(nonce_obj, plaintext).expect("encrypt");
    (ct, nonce)
}

fn decrypt_aes(ciphertext: &[u8], nonce: &[u8; 12], key: &Key<Aes256Gcm>) -> Result<Vec<u8>, ()> {
    let cipher = Aes256Gcm::new(key);
    let nonce_obj = Nonce::from_slice(nonce);
    cipher.decrypt(nonce_obj, ciphertext).map_err(|_| ())
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

            // spawn network loop
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

            // --- Install state so commands can access it --------------------------------
            let state = AppState {
                app: app.handle().clone(),
                identity,
                signing_key,
                blockchain,
                node,
                groups,
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

// -----------------------------------------------------------------------------
// inbound network handler
// -----------------------------------------------------------------------------
/// Expected formats (priority order):
/// 1. `ChatEncrypted` JSON (AES ciphertext of `ChatSigned`).
/// 2. `ChatSigned` JSON (legacy signed cleartext).
/// 3. `ChatBody` JSON (legacy unsigned).
/// 4. Raw text (very old builds).
async fn handle_incoming_network_payload(
    app: &AppHandle,
    blockchain: &Arc<Mutex<Blockchain>>,
    blockchain_path: &Path,
    my_pub_b64: &str,
    network_from_b64: &str,
    _network_to_b64: &str,
    payload_str: &str,
) {
    // --- Try ChatEncrypted ---------------------------------------------------
    if let Ok(enc) = serde_json::from_str::<ChatEncrypted>(payload_str) {
        if enc.is_group {
            if let Some(members) = enc.group_members.clone() {
                if !members.iter().any(|m| m == my_pub_b64) {
                    return;
                }
                let key = GroupManager::compute_group_aes_key(&sorted_clone(&members));
                if let Some(clear_signed) = decrypt_chat_encrypted(&enc, &key) {
                    record_decrypted_chat(app, blockchain, blockchain_path, &clear_signed, network_from_b64).await;
                    return;
                } else {
                    warn!("Failed to decrypt inbound group message.");
                    return;
                }
            } else {
                warn!("Inbound group message missing members; ignoring.");
                return;
            }
        } else {
            // Peer message: ensure addressed to us.
            if let Some(ref to) = enc.to {
                if to != my_pub_b64 {
                    return;
                }
            } else {
                return;
            }
            let key = derive_peer_aes_key(&enc.from, my_pub_b64);
            if let Some(clear_signed) = decrypt_chat_encrypted(&enc, &key) {
                record_decrypted_chat(app, blockchain, blockchain_path, &clear_signed, network_from_b64).await;
                return;
            } else {
                warn!("Failed to decrypt inbound peer message.");
                return;
            }
        }
    }

    // --- Try ChatSigned ------------------------------------------------------
    if let Ok(chat_signed) = serde_json::from_str::<ChatSigned>(payload_str) {
        record_decrypted_chat(app, blockchain, blockchain_path, &chat_signed, network_from_b64).await;
        return;
    }

    // --- Try ChatBody --------------------------------------------------------
    if let Ok(body) = serde_json::from_str::<ChatBody>(payload_str) {
        let chat_signed = ChatSigned { body, sig_b64: String::new() };
        record_decrypted_chat(app, blockchain, blockchain_path, &chat_signed, network_from_b64).await;
        return;
    }

    // --- Raw fallback --------------------------------------------------------
    let chat_signed = ChatSigned {
        body: ChatBody {
            from: network_from_b64.to_string(),
            to: Some(my_pub_b64.to_string()),
            text: payload_str.to_string(),
            ts_ms: now_ms(),
        },
        sig_b64: String::new(),
    };
    record_decrypted_chat(app, blockchain, blockchain_path, &chat_signed, network_from_b64).await;
}

/// Utility: return a sorted clone (stable key derivation).
fn sorted_clone(v: &[String]) -> Vec<String> {
    let mut c = v.to_vec();
    c.sort_unstable();
    c
}

/// Attempt to decrypt `ChatEncrypted` using provided key; returns `ChatSigned`.
fn decrypt_chat_encrypted(enc: &ChatEncrypted, key: &Key<Aes256Gcm>) -> Option<ChatSigned> {
    let nonce_bytes_vec = general_purpose::STANDARD.decode(&enc.nonce_b64).ok()?;
    if nonce_bytes_vec.len() != 12 {
        return None;
    }
    let mut nonce_bytes = [0u8; 12];
    nonce_bytes.copy_from_slice(&nonce_bytes_vec);

    let ct_vec = general_purpose::STANDARD.decode(&enc.ciphertext_b64).ok()?;
    let clear = decrypt_aes(&ct_vec, &nonce_bytes, key).ok()?;
    serde_json::from_slice::<ChatSigned>(&clear).ok()
}

/// After decrypting inbound or preparing outbound, append **clear signed** JSON.
async fn record_decrypted_chat(
    app: &AppHandle,
    blockchain: &Arc<Mutex<Blockchain>>,
    blockchain_path: &Path,
    chat_signed: &ChatSigned,
    network_from_b64: &str,
) {
    // Best‑effort signature verify (logs only)
    if let Ok(sender_pub_bytes) = general_purpose::STANDARD.decode(&chat_signed.body.from) {
        if sender_pub_bytes.len() == 32 {
            if let Ok(vk) =
                VerifyingKey::from_bytes(<&[u8; 32]>::try_from(sender_pub_bytes.as_slice()).unwrap())
            {
                if !chat_signed.verify(&vk) {
                    warn!(
                        "Chat signature invalid (declared from={} net_from={}).",
                        &chat_signed.body.from[..8.min(chat_signed.body.from.len())],
                        &network_from_b64[..8.min(network_from_b64.len())]
                    );
                }
            }
        }
    }

    let json = serde_json::to_string(chat_signed).unwrap();
    append_chat_json(app, blockchain, blockchain_path, &json).await;
}

// -----------------------------------------------------------------------------
// Tauri commands
// -----------------------------------------------------------------------------
#[tauri::command]
async fn get_identity(state: tauri::State<'_, AppState>) -> Result<StoredIdentity, String> {
    let id = state.identity.lock().await;
    Ok(id.clone())
}

#[tauri::command]
async fn set_alias(
    state: tauri::State<'_, AppState>,
    new_alias: String,
) -> Result<(), String> {
    let alias = new_alias.trim();
    if alias.is_empty() {
        return Err("alias empty".into());
    }

    {
        let mut id = state.identity.lock().await;
        id.alias = alias.to_string();
        if let Err(e) =
            fs::write(&state.identity_path, serde_json::to_string_pretty(&*id).unwrap())
        {
            return Err(format!("write identity: {e}"));
        }
    }

    state.node.set_alias(alias.to_string()).await;

    let _ = state.app.emit("alias_update", ());
    info!("Alias changed to '{alias}' and network announce updated.");
    Ok(())
}

#[tauri::command]
async fn get_peers(state: tauri::State<'_, AppState>) -> Result<Vec<PeerInfo>, String> {
    let peers = state.node.list_peers().await;
    let my_id = {
        let id = state.identity.lock().await;
        id.public_key_b64.clone()
    };
    Ok(peers.into_iter().filter(|p| p.id != my_id).collect())
}

/// Create (or return existing) group. Must include *all* members (including self).
#[tauri::command]
async fn create_group(
    state: tauri::State<'_, AppState>,
    members: Vec<String>,
) -> Result<String, String> {
    if members.is_empty() {
        return Err("group needs at least 1 member".into());
    }
    let id = state.groups.create_group(members);
    Ok(id)
}

/// List current in‑memory groups.
#[tauri::command]
async fn list_groups(state: tauri::State<'_, AppState>) -> Result<Vec<GroupInfo>, String> {
    Ok(state.groups.list_groups())
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
        (id.public_key_b64.clone(), state.signing_key.lock().await.clone())
    };

    // canonical body
    let body = ChatBody {
        from: my_pub.clone(),
        to: Some(peer_id.clone()),
        text: content.clone(),
        ts_ms: now_ms(),
    };
    // signed plaintext
    let chat_signed = ChatSigned::new_signed(body, &my_sk);

    // encrypt for peer
    let key = derive_peer_aes_key(&my_pub, &peer_id);
    let clear_json = serde_json::to_vec(&chat_signed).map_err(|e| e.to_string())?;
    let (ct, nonce) = encrypt_aes(&clear_json, &key);
    let enc = ChatEncrypted {
        from: my_pub.clone(),
        to: Some(peer_id.clone()),
        nonce_b64: general_purpose::STANDARD.encode(nonce),
        ciphertext_b64: general_purpose::STANDARD.encode(ct),
        ts_ms: chat_signed.body.ts_ms,
        is_group: false,
        group_members: None,
    };
    let enc_json = serde_json::to_string(&enc).map_err(|e| e.to_string())?;

    // append clear (local)
    {
        let mut chain = state.blockchain.lock().await;
        chain.add_text_block(String::from_utf8(clear_json).unwrap());
        if let Err(e) = chain.save_to_file(&state.blockchain_path) {
            return Err(format!("save error: {e}"));
        }
    }
    let _ = state.app.emit("chat_update", ());

    // send encrypted JSON to peer
    if let Err(e) = state.node.send_direct_block(&peer_id, enc_json).await {
        warn!("send_direct_block error -> {}: {e}", peer_id);
    }

    Ok(())
}

/// Send a *group* chat message* (fan‑out encrypted copies).
#[tauri::command]
async fn add_group_message(
    state: tauri::State<'_, AppState>,
    content: String,
    group_id: String,
) -> Result<(), String> {
    // fetch group
    let group = match state.groups.get_group(&group_id) {
        Some(g) => g,
        None => return Err("unknown group".into()),
    };
    if group.members.is_empty() {
        return Err("group empty".into());
    }

    let (my_pub, my_sk) = {
        let id = state.identity.lock().await;
        (id.public_key_b64.clone(), state.signing_key.lock().await.clone())
    };

    // canonical body: .to carries group_id
    let body = ChatBody {
        from: my_pub.clone(),
        to: Some(group_id.clone()),
        text: content.clone(),
        ts_ms: now_ms(),
    };
    let chat_signed = ChatSigned::new_signed(body, &my_sk);

    // prepare encrypted payload for the *group key* (stateless derivation)
    let group_key = GroupManager::compute_group_aes_key(&group.members);
    let clear_json = serde_json::to_vec(&chat_signed).map_err(|e| e.to_string())?;
    let (ct, nonce) = encrypt_aes(&clear_json, &group_key);
    let enc = ChatEncrypted {
        from: my_pub.clone(),
        to: Some(group_id.clone()),
        nonce_b64: general_purpose::STANDARD.encode(nonce),
        ciphertext_b64: general_purpose::STANDARD.encode(ct),
        ts_ms: chat_signed.body.ts_ms,
        is_group: true,
        group_members: Some(group.members.clone()),
    };
    let enc_json = serde_json::to_string(&enc).map_err(|e| e.to_string())?;

    // append clear (local)
    {
        let mut chain = state.blockchain.lock().await;
        chain.add_text_block(String::from_utf8(clear_json.clone()).unwrap());
        if let Err(e) = chain.save_to_file(&state.blockchain_path) {
            return Err(format!("save error: {e}"));
        }
    }
    let _ = state.app.emit("chat_update", ());

    // fan‑out encrypted payload to each member
    for member in &group.members {
        if member == &my_pub {
            continue;
        }
        if let Err(e) = state.node.send_direct_block(member, enc_json.clone()).await {
            warn!("group send error -> {}: {e}", member);
        }
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
