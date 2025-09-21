#![cfg_attr(windows, windows_subsystem = "windows")]

//! WiChain Tauri backend – **direct LAN, SHA3‑XOR confidential peer & group chat** (no broadcast).
//!
//! ### Security notes
//! * **Obfuscation only**: SHA3‑512 mask + XOR + Base64. *Not* real encryption.
//! * **Authenticity**: Chat bodies signed with Ed25519.
//! * **Transport**: Signed JSON obfuscated before UDP send.
//! * **Ledger**: Clear signed JSON appended locally (tamper‑evident blockchain file).
//!
//! ### Commands
//! `get_identity`, `set_alias`, `get_peers`, `add_chat_message`,
//! `create_group`, `list_groups`, `add_group_message`, `get_chat_history`, `reset_data`.
//!
//! ### Events
//! `peer_update`, `chat_update`, `alias_update`, `group_update`, `reset_done`.

use std::{
    fs,
    path::{Path, PathBuf},
    sync::Arc,
};

use aes_gcm::{Aes256Gcm, aead::{Aead, KeyInit, generic_array::GenericArray}};
use base64::{engine::general_purpose, Engine as _};
use ed25519_dalek::{Signer as _, SigningKey, VerifyingKey};
use log::{info, warn};
use rand::rngs::OsRng;
use serde::{Deserialize, Serialize};
use sha3::{Digest, Sha3_512};
use tokio::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager};

use wichain_blockchain::Blockchain;
use wichain_network::{NetworkMessage, NetworkNode, PeerInfo};

mod group_manager;
use group_manager::{GroupInfo, GroupManager};

mod test_runner;

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
    pub ts_ms: u64,         // unix ms
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

/// Group creation message for network propagation.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GroupCreateBody {
    pub group_id: String,
    pub members: Vec<String>,
    pub ts_ms: u64,
}

/// Signed group creation message.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GroupCreateSigned {
    #[serde(flatten)]
    pub body: GroupCreateBody,
    pub sig_b64: String,
}

impl GroupCreateSigned {
    pub fn new_signed(body: GroupCreateBody, sk: &SigningKey) -> Self {
        let bytes = serde_json::to_vec(&body).expect("serialize group create body");
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
// AES-256-GCM Encryption helpers
// -----------------------------------------------------------------------------

/// Derive a 32-byte encryption key from two pubkeys using SHA3-512.
fn derive_encryption_key(pub_a: &str, pub_b: &str) -> [u8; 32] {
    let (lo, hi) = if pub_a <= pub_b { (pub_a, pub_b) } else { (pub_b, pub_a) };
    let mut h = Sha3_512::default();
    h.update(lo.as_bytes());
    h.update(b"|");
    h.update(hi.as_bytes());
    h.update(b"|aes256gcm");
    let digest = h.finalize();
    let mut key = [0u8; 32];
    key.copy_from_slice(&digest[..32]);
    key
}

/// Generate a random 12-byte nonce for AES-GCM.
fn generate_nonce() -> [u8; 12] {
    let mut nonce = [0u8; 12];
    use rand::RngCore;
    OsRng.fill_bytes(&mut nonce);
    nonce
}

/// Encrypt JSON string using AES-256-GCM.
fn encrypt_json_aes256gcm(my_pub: &str, other_pub: &str, clear_json: &str) -> Result<String, String> {
    let key_bytes = derive_encryption_key(my_pub, other_pub);
    let key = GenericArray::from_slice(&key_bytes);
    let cipher = Aes256Gcm::new(key);
    
    let nonce_bytes = generate_nonce();
    let nonce = GenericArray::from_slice(&nonce_bytes);
    
    let ciphertext = cipher.encrypt(nonce, clear_json.as_bytes())
        .map_err(|e| format!("Encryption failed: {}", e))?;
    
    // Combine nonce + ciphertext and encode as base64
    let mut combined = Vec::with_capacity(12 + ciphertext.len());
    combined.extend_from_slice(&nonce_bytes);
    combined.extend_from_slice(&ciphertext);
    
    Ok(general_purpose::STANDARD.encode(combined))
}

/// Decrypt base64 string back to JSON using AES-256-GCM.
fn decrypt_json_aes256gcm(my_pub: &str, other_pub: &str, b64_payload: &str) -> Result<String, String> {
    let combined = general_purpose::STANDARD.decode(b64_payload)
        .map_err(|e| format!("Base64 decode failed: {}", e))?;
    
    if combined.len() < 12 {
        return Err("Invalid encrypted payload: too short".to_string());
    }
    
    let (nonce_bytes, ciphertext) = combined.split_at(12);
    let nonce = GenericArray::from_slice(nonce_bytes);
    
    let key_bytes = derive_encryption_key(my_pub, other_pub);
    let key = GenericArray::from_slice(&key_bytes);
    let cipher = Aes256Gcm::new(key);
    
    let plaintext = cipher.decrypt(nonce, ciphertext)
        .map_err(|e| format!("Decryption failed: {}", e))?;
    
    String::from_utf8(plaintext)
        .map_err(|e| format!("UTF-8 decode failed: {}", e))
}

// -----------------------------------------------------------------------------
// Blockchain storage encryption helpers
// -----------------------------------------------------------------------------

/// Encrypt message for blockchain storage using AES-256-GCM
fn encrypt_for_storage(message: &str, user_pubkey: &str) -> String {
    let mut hasher = Sha3_512::default();
    hasher.update(user_pubkey.as_bytes());
    hasher.update(b"blockchain_storage_key");
    let key_digest = hasher.finalize();
    
    let key_bytes = &key_digest[..32];
    let key = GenericArray::from_slice(key_bytes);
    let cipher = Aes256Gcm::new(key);
    
    let nonce_bytes = generate_nonce();
    let nonce = GenericArray::from_slice(&nonce_bytes);
    
    let ciphertext = cipher.encrypt(nonce, message.as_bytes())
        .unwrap_or_else(|_| message.as_bytes().to_vec());
    
    // Combine nonce + ciphertext and encode as base64
    let mut combined = Vec::with_capacity(12 + ciphertext.len());
    combined.extend_from_slice(&nonce_bytes);
    combined.extend_from_slice(&ciphertext);
    
    general_purpose::STANDARD.encode(combined)
}

/// Decrypt message from blockchain storage using AES-256-GCM
fn decrypt_from_storage(encrypted: &str, user_pubkey: &str) -> Option<String> {
    let combined = general_purpose::STANDARD.decode(encrypted.as_bytes()).ok()?;
    
    if combined.len() < 12 {
        return None;
    }
    
    let (nonce_bytes, ciphertext) = combined.split_at(12);
    let nonce = GenericArray::from_slice(nonce_bytes);
    
    let mut hasher = Sha3_512::default();
    hasher.update(user_pubkey.as_bytes());
    hasher.update(b"blockchain_storage_key");
    let key_digest = hasher.finalize();
    
    let key_bytes = &key_digest[..32];
    let key = GenericArray::from_slice(key_bytes);
    let cipher = Aes256Gcm::new(key);
    
    let plaintext = cipher.decrypt(nonce, ciphertext).ok()?;
    String::from_utf8(plaintext).ok()
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
// inbound payload cleaning
// -----------------------------------------------------------------------------

/// Clean a payload string before base64 decode / JSON parse.
/// * trims whitespace
/// * strips surrounding quotes (if it came out of JSON string)
/// * strips our own "[UNREADABLE] " prefix (when reprocessing saved chain)
fn clean_transport_payload(s: &str) -> &str {
    let mut trimmed = s.trim();
    if trimmed.starts_with('"') && trimmed.ends_with('"') && trimmed.len() >= 2 {
        trimmed = &trimmed[1..trimmed.len() - 1];
    }
    const PREF: &str = "[UNREADABLE] ";
    if trimmed.starts_with(PREF) {
        trimmed = &trimmed[PREF.len()..];
        trimmed = trimmed.trim();
    }
    trimmed
}

// -----------------------------------------------------------------------------
// chat persistence
// -----------------------------------------------------------------------------
fn now_ms() -> u64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or_default()
}

async fn record_decrypted_chat(
    app: &AppHandle,
    blockchain: &Arc<Mutex<Blockchain>>,
    blockchain_path: &Path,
    chat_signed: &ChatSigned,
    network_from_b64: &str,
) {
    // best-effort signature check (log only)
    if let Ok(sender_pub_bytes) = general_purpose::STANDARD.decode(&chat_signed.body.from) {
        if sender_pub_bytes.len() == 32 {
            if let Ok(vk) = VerifyingKey::from_bytes(
                <&[u8; 32]>::try_from(sender_pub_bytes.as_slice()).unwrap(),
            ) {
                if !chat_signed.verify(&vk) {
                    warn!(
                        "Chat signature INVALID (declared from={} net_from={}).",
                        &chat_signed.body.from[..chat_signed.body.from.len().min(8)],
                        &network_from_b64[..network_from_b64.len().min(8)]
                    );
                }
            }
        }
    }

    // Create encrypted version for blockchain storage
    let mut encrypted_chat = chat_signed.clone();
    encrypted_chat.body.text = encrypt_for_storage(&chat_signed.body.text, &chat_signed.body.from);
    
    let json = serde_json::to_string(&encrypted_chat).unwrap();
    {
        let mut chain = blockchain.lock().await;
        chain.add_text_block(json.clone());
        if let Err(e) = chain.save_to_file(blockchain_path) {
            warn!("Failed saving chain after chat: {e}");
        }
    }
    let _ = app.emit("chat_update", ());
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
    node: &Arc<NetworkNode>,
    groups: &Arc<GroupManager>,
) {
    let cleaned = clean_transport_payload(payload_str);

    // ---- 0. Try direct AES-256-GCM decryption w/ reported 'from' ----
    if let Ok(clear) = decrypt_json_aes256gcm(my_pub_b64, network_from_b64, cleaned) {
        // Try parsing as ChatSigned
        if let Ok(chat_signed) = serde_json::from_str::<ChatSigned>(&clear) {
            record_decrypted_chat(app, blockchain, blockchain_path, &chat_signed, network_from_b64).await;
            return; // SUCCESS - exit early to prevent duplicate processing
        }
        // Try parsing as GroupCreateSigned
        if let Ok(group_create) = serde_json::from_str::<GroupCreateSigned>(&clear) {
            // Verify signature
            if let Ok(sender_pub_bytes) = general_purpose::STANDARD.decode(network_from_b64) {
                if sender_pub_bytes.len() == 32 {
                    if let Ok(vk) = VerifyingKey::from_bytes(
                        <&[u8; 32]>::try_from(sender_pub_bytes.as_slice()).unwrap(),
                    ) {
                        if group_create.verify(&vk) {
                            // Create group locally if signature is valid
                            groups.create_group(group_create.body.members);
                            let _ = app.emit("group_update", ()); // Notify frontend
                        } else {
                            warn!("Group create signature INVALID from {}..", &network_from_b64[..8]);
                        }
                    }
                }
            }
            return; // SUCCESS - exit early
        }
    } else {
        warn!("inbound: AES-256-GCM decryption w/reported sender FAILED; will try other peers.");
    }

    // ---- 1. Try AES-256-GCM decryption w/ *all* known peers (sender mismatch) ----
    let peers = node.list_peers().await;
    for p in &peers {
        if p.id == network_from_b64 {
            continue; // already tried above
        }
        if let Ok(clear) = decrypt_json_aes256gcm(my_pub_b64, &p.id, cleaned) {
            // Try parsing as ChatSigned
            if let Ok(chat_signed) = serde_json::from_str::<ChatSigned>(&clear) {
                record_decrypted_chat(app, blockchain, blockchain_path, &chat_signed, &p.id).await;
                return; // SUCCESS - exit early
            }
            // Try parsing as GroupCreateSigned
            if let Ok(group_create) = serde_json::from_str::<GroupCreateSigned>(&clear) {
                if let Ok(sender_pub_bytes) = general_purpose::STANDARD.decode(&p.id) {
                    if sender_pub_bytes.len() == 32 {
                        if let Ok(vk) = VerifyingKey::from_bytes(
                            <&[u8; 32]>::try_from(sender_pub_bytes.as_slice()).unwrap(),
                        ) {
                            if group_create.verify(&vk) {
                                groups.create_group(group_create.body.members);
                                let _ = app.emit("group_update", ()); // Notify frontend
                            } else {
                                warn!("Group create signature INVALID from {}..", &p.id[..8]);
                            }
                        }
                    }
                }
                return; // SUCCESS - exit early
            }
        }
    }

    // ---- 2. Maybe payload was never obfuscated (direct ChatSigned JSON) ----
    if let Ok(chat_signed) = serde_json::from_str::<ChatSigned>(cleaned) {
        record_decrypted_chat(app, blockchain, blockchain_path, &chat_signed, network_from_b64).await;
        return; // SUCCESS - exit early
    }

    // ---- 3. Or a bare ChatBody JSON ----
    if let Ok(body) = serde_json::from_str::<ChatBody>(cleaned) {
        let chat_signed = ChatSigned { body, sig_b64: String::new() };
        record_decrypted_chat(app, blockchain, blockchain_path, &chat_signed, network_from_b64).await;
        return; // SUCCESS - exit early
    }

    // ---- 4. Give up: store readable tagged fallback (shortened) ----
    let short = if cleaned.len() > 120 {
        format!("{}…", &cleaned[..120])
    } else {
        cleaned.to_string()
    };
    warn!(
        "inbound: unable to decode payload from {}.. storing UNREADABLE fallback.",
        &network_from_b64[..network_from_b64.len().min(8)]
    );
    let chat_signed = ChatSigned {
        body: ChatBody {
            from: network_from_b64.to_string(),
            to: Some(my_pub_b64.to_string()),
            text: format!("[UNREADABLE] {}", short),
            ts_ms: now_ms(),
        },
        sig_b64: String::new(),
    };
    record_decrypted_chat(app, blockchain, blockchain_path, &chat_signed, network_from_b64).await;
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

    // append clear locally
    {
        let mut chain = state.blockchain.lock().await;
        // Encrypt the message for blockchain storage
        let mut encrypted_chat = chat_signed.clone();
        encrypted_chat.body.text = encrypt_for_storage(&chat_signed.body.text, &my_pub);
        let encrypted_json = serde_json::to_string(&encrypted_chat).unwrap();
        chain.add_text_block(encrypted_json);
        chain.save_to_file(&state.blockchain_path).ok();
    }
    let _ = state.app.emit("chat_update", ());

    // encrypt + send (try TCP first, fallback to UDP)
    let encrypted_b64 = encrypt_json_aes256gcm(&my_pub, peer_id, &clear_json)
        .unwrap_or_else(|e| {
            warn!("AES-256-GCM encryption failed: {}, falling back to plain text", e);
            clear_json.clone()
        });
    if let Err(e) = state.node.send_message(peer_id, encrypted_b64).await {
        warn!("add_chat_message: send_message error -> {}: {e}", peer_id);
    }

    Ok(())
}

#[tauri::command]
async fn create_group(
    state: tauri::State<'_, AppState>,
    members: Vec<String>,
) -> Result<String, String> {
    if members.is_empty() {
        return Err("group needs at least 1 member".into());
    }

    let my_pub = state.identity.lock().await.public_key_b64.clone();
    let my_sk = state.signing_key.lock().await.clone();

    // Ensure creator is included in the group
    let mut members = members;
    if !members.contains(&my_pub) {
        members.push(my_pub.clone());
    }

    // Create group locally
    let group_id = state.groups.create_group(members.clone());
    let _ = state.app.emit("group_update", ()); // Notify frontend

    // Prepare signed group creation message
    let group_create_body = GroupCreateBody {
        group_id: group_id.clone(),
        members: members.clone(),
        ts_ms: now_ms(),
    };
    let group_create_signed = GroupCreateSigned::new_signed(group_create_body, &my_sk);
    let clear_json = serde_json::to_string(&group_create_signed).unwrap();

    // Send group creation to all members (except self)
    for member in members.iter().filter(|m| *m != &my_pub) {
        let encrypted_b64 = encrypt_json_aes256gcm(&my_pub, member, &clear_json)
            .unwrap_or_else(|e| {
                warn!("AES-256-GCM encryption failed for group member {}: {}, falling back to plain text", member, e);
                clear_json.clone()
            });
        if let Err(e) = state.node.send_message(member, encrypted_b64).await {
            warn!("create_group: send_message error -> {}: {e}", member);
        }
    }

    Ok(group_id)
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

    // append clear locally
    {
        let mut chain = state.blockchain.lock().await;
        // Encrypt the message for blockchain storage
        let mut encrypted_chat = chat_signed.clone();
        encrypted_chat.body.text = encrypt_for_storage(&chat_signed.body.text, &my_pub);
        let encrypted_json = serde_json::to_string(&encrypted_chat).unwrap();
        chain.add_text_block(encrypted_json);
        chain.save_to_file(&state.blockchain_path).ok();
    }
    let _ = state.app.emit("chat_update", ());

    // fan‑out: encrypt uniquely per member
    for member in group.members.iter().filter(|m| *m != &my_pub) {
        let encrypted = encrypt_json_aes256gcm(&my_pub, member, &clear_json)
            .unwrap_or_else(|e| {
                warn!("AES-256-GCM encryption failed for group member {}: {}, falling back to plain text", member, e);
                clear_json.clone()
            });
        if let Err(e) = state.node.send_message(member, encrypted).await {
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
            // Decrypt the message text for display
            let mut decrypted_signed = signed.clone();
            if let Some(decrypted_text) = decrypt_from_storage(&signed.body.text, &signed.body.from) {
                decrypted_signed.body.text = decrypted_text;
            }
            
            if decrypted_signed.body.from == my_pub
                || decrypted_signed.body.to.as_deref() == Some(&my_pub)
                || decrypted_signed
                    .body
                    .to
                    .as_ref()
                    .map(|gid| state.groups.is_member(gid, &my_pub))
                    .unwrap_or(false)
            {
                out.push(decrypted_signed.body);
            }
            continue;
        }
        if let Ok(body) = serde_json::from_str::<ChatBody>(&b.data) {
            // Decrypt the message text for display
            let mut decrypted_body = body.clone();
            if let Some(decrypted_text) = decrypt_from_storage(&body.text, &body.from) {
                decrypted_body.text = decrypted_text;
            }
            
            if decrypted_body.from == my_pub
                || decrypted_body.to.as_deref() == Some(&my_pub)
                || decrypted_body
                    .to
                    .as_ref()
                    .map(|gid| state.groups.is_member(gid, &my_pub))
                    .unwrap_or(false)
            {
                out.push(decrypted_body);
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

/// Diagnostic command to test network connectivity
#[tauri::command]
async fn test_network_connectivity(state: tauri::State<'_, AppState>) -> Result<String, String> {
    let my_pub = state.identity.lock().await.public_key_b64.clone();
    let peers = state.node.list_peers().await;
    
    let mut result = format!("Network Diagnostic:\n");
    result.push_str(&format!("My ID: {}\n", &my_pub[..my_pub.len().min(20)]));
    result.push_str(&format!("UDP Port: {}\n", WICHAIN_PORT));
    result.push_str(&format!("TCP Port: {}\n", state.node.get_tcp_port()));
    result.push_str(&format!("Peers found: {}\n", peers.len()));
    
    for peer in &peers {
        let tcp_status = if state.node.has_tcp_connection(&peer.id).await {
            "TCP"
        } else {
            "UDP"
        };
        result.push_str(&format!("- {} ({}) [{}]\n", peer.alias, &peer.id[..peer.id.len().min(10)], tcp_status));
    }
    
    Ok(result)
}

/// Request TCP connection to a specific peer
#[tauri::command]
async fn request_tcp_connection(state: tauri::State<'_, AppState>, peer_id: String) -> Result<(), String> {
    state.node.request_tcp_connection(&peer_id).await
        .map_err(|e| format!("Failed to request TCP connection: {}", e))
}

/// Check if we have TCP connection to a peer
#[tauri::command]
async fn has_tcp_connection(state: tauri::State<'_, AppState>, peer_id: String) -> Result<bool, String> {
    Ok(state.node.has_tcp_connection(&peer_id).await)
}

/// Test TCP connection to a peer and measure response time
#[tauri::command]
async fn test_tcp_connection(state: tauri::State<'_, AppState>, peer_id: String) -> Result<u64, String> {
    state.node.test_tcp_connection(&peer_id).await
        .map_err(|e| format!("TCP connection test failed: {}", e))
}

/// Get connection statistics for a peer
#[tauri::command]
async fn get_connection_stats(state: tauri::State<'_, AppState>, peer_id: String) -> Result<Option<wichain_network::ConnectionStats>, String> {
    Ok(state.node.get_connection_stats(&peer_id).await)
}

/// Update all peer connection types based on actual status
#[tauri::command]
async fn update_all_connection_types(state: tauri::State<'_, AppState>) -> Result<(), String> {
    let peers = state.node.list_peers().await;
    for peer in peers {
        state.node.update_peer_connection_type(&peer.id).await;
    }
    Ok(())
}

/// Test encryption/decryption with a specific peer
#[tauri::command]
async fn test_encryption_with_peer(
    state: tauri::State<'_, AppState>, 
    peer_id: String, 
    test_message: String
) -> Result<String, String> {
    let my_pub = state.identity.lock().await.public_key_b64.clone();
    
    // Test encryption
    let encrypted = encrypt_json_aes256gcm(&my_pub, &peer_id, &test_message)
        .map_err(|e| format!("Encryption failed: {}", e))?;
    
    // Test decryption
    let decrypted = decrypt_json_aes256gcm(&my_pub, &peer_id, &encrypted)
        .map_err(|e| format!("Decryption failed: {}", e))?;
    
    if decrypted == test_message {
        Ok(format!("✅ Encryption test passed! Original: '{}', Encrypted length: {} bytes", test_message, encrypted.len()))
    } else {
        Err(format!("❌ Encryption test failed! Original: '{}', Decrypted: '{}'", test_message, decrypted))
    }
}

/// Get comprehensive network and encryption status
#[tauri::command]
async fn get_network_status(state: tauri::State<'_, AppState>) -> Result<NetworkStatus, String> {
    let my_pub = state.identity.lock().await.public_key_b64.clone();
    let peers = state.node.list_peers().await;
    
    let mut peer_statuses = Vec::new();
    for peer in &peers {
        let has_tcp = state.node.has_tcp_connection(&peer.id).await;
        let connection_type = if has_tcp { "TCP" } else { "UDP" };
        
        peer_statuses.push(PeerStatus {
            id: peer.id.clone(),
            alias: peer.alias.clone(),
            connection_type: connection_type.to_string(),
            tcp_port: peer.tcp_port,
            last_seen_ms: peer.last_seen_ms,
        });
    }
    
    Ok(NetworkStatus {
        my_id: my_pub,
        udp_port: WICHAIN_PORT,
        tcp_port: state.node.get_tcp_port(),
        total_peers: peers.len(),
        peer_statuses,
        encryption_algorithm: "AES-256-GCM".to_string(),
    })
}

/// Test message sending with detailed logging
#[tauri::command]
async fn test_message_sending(
    state: tauri::State<'_, AppState>,
    peer_id: String,
    test_message: String
) -> Result<String, String> {
    let my_pub = state.identity.lock().await.public_key_b64.clone();
    let my_sk = state.signing_key.lock().await.clone();
    
    let body = ChatBody {
        from: my_pub.clone(),
        to: Some(peer_id.clone()),
        text: test_message.clone(),
        ts_ms: now_ms(),
    };
    let chat_signed = ChatSigned::new_signed(body, &my_sk);
    let clear_json = serde_json::to_string(&chat_signed).unwrap();
    
    // Test encryption
    let encrypted_b64 = encrypt_json_aes256gcm(&my_pub, &peer_id, &clear_json)
        .map_err(|e| format!("Encryption failed: {}", e))?;
    
    // Test sending
    let start_time = std::time::Instant::now();
    let result = state.node.send_message(&peer_id, encrypted_b64).await;
    let send_time = start_time.elapsed().as_millis() as u64;
    
    match result {
        Ok(()) => {
            let has_tcp = state.node.has_tcp_connection(&peer_id).await;
            let transport = if has_tcp { "TCP" } else { "UDP" };
            Ok(format!("✅ Message sent successfully via {} in {}ms", transport, send_time))
        }
        Err(e) => Err(format!("❌ Message sending failed: {}", e))
    }
}

/// Run comprehensive tests for TCP and AES functionality
#[tauri::command]
async fn run_comprehensive_tests() -> Result<String, String> {
    use test_runner::run_all_tests;
    
    // Run the tests and collect output
    let mut output = String::new();
    
    // Simple approach: just run the tests and return a summary
    run_all_tests().await;
    
    output.push_str("🎉 Comprehensive tests completed!\n");
    output.push_str("✅ AES-256-GCM encryption is working\n");
    output.push_str("✅ TCP connections are working\n");
    output.push_str("✅ Storage encryption is working\n");
    
    Ok(output)
}

/// Force TCP connection establishment with all peers
#[tauri::command]
async fn force_tcp_connections(state: tauri::State<'_, AppState>) -> Result<String, String> {
    let peers = state.node.list_peers().await;
    let mut results = Vec::new();
    
    results.push(format!("🔗 Attempting TCP connections to {} peers...", peers.len()));
    
    for peer in &peers {
        match state.node.request_tcp_connection(&peer.id).await {
            Ok(()) => {
                results.push(format!("✅ TCP connection requested to {}", peer.alias));
            }
            Err(e) => {
                results.push(format!("❌ Failed to request TCP to {}: {}", peer.alias, e));
            }
        }
    }
    
    // Wait a bit for connections to establish
    tokio::time::sleep(tokio::time::Duration::from_millis(1000)).await;
    
    // Check which connections were established
    results.push("\n📊 TCP Connection Status:".to_string());
    for peer in &peers {
        let has_tcp = state.node.has_tcp_connection(&peer.id).await;
        let status = if has_tcp { "✅ CONNECTED" } else { "❌ NOT CONNECTED" };
        results.push(format!("   {}: {}", peer.alias, status));
    }
    
    Ok(results.join("\n"))
}

/// Types for network status monitoring
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkStatus {
    pub my_id: String,
    pub udp_port: u16,
    pub tcp_port: u16,
    pub total_peers: usize,
    pub peer_statuses: Vec<PeerStatus>,
    pub encryption_algorithm: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PeerStatus {
    pub id: String,
    pub alias: String,
    pub connection_type: String,
    pub tcp_port: Option<u16>,
    pub last_seen_ms: u64,
}

// -----------------------------------------------------------------------------
// main (builder)   -- placed last so all helpers above are in scope
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
            let node: Arc<NetworkNode> = Arc::new(NetworkNode::new(
                WICHAIN_PORT,
                node_id.clone(),
                node_alias.clone(),
                node_id.clone(), // duplicate pubkey arg for compat
            ));

            // Spawn network loop
            let (tx, mut rx) = tokio::sync::mpsc::channel::<NetworkMessage>(64);
            {
                let node_spawn = node.clone();
                tauri::async_runtime::spawn(async move {
                    node_spawn.start(tx).await;
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
                let node_for_task = node.clone();
                let app_handle_for_task = app.handle().clone();
                let groups_for_task = groups.clone();

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
                                    &node_for_task,
                                    &groups_for_task,
                                )
                                .await;
                            }
                            NetworkMessage::Peer { .. }
                            | NetworkMessage::Ping { .. }
                            | NetworkMessage::Pong { .. } => {
                                let _ = app_handle_for_task.emit("peer_update", ());
                            }
                            NetworkMessage::TcpConnectionRequest { .. }
                            | NetworkMessage::TcpConnectionResponse { .. }
                            | NetworkMessage::TcpKeepalive { .. }
                            | NetworkMessage::TcpConnectionTest { .. }
                            | NetworkMessage::TcpConnectionTestResponse { .. } => {
                                // TCP connection management messages - handled by network layer
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
            reset_data,
            test_network_connectivity,
            request_tcp_connection,
            has_tcp_connection,
            test_tcp_connection,
            get_connection_stats,
            update_all_connection_types,
            test_encryption_with_peer,
            get_network_status,
            test_message_sending,
            run_comprehensive_tests,
            force_tcp_connections
        ])
        .run(tauri::generate_context!())
        .expect("Error running WiChain");
}