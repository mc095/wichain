// #![cfg_attr(all(windows, not(debug_assertions)), windows_subsystem = "windows")]
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

use base64::{engine::general_purpose, Engine as _};
use ed25519_dalek::{Signer as _, SigningKey, VerifyingKey};
use log::{info, warn};
use rand::rngs::{OsRng};
use rand::SeedableRng;
use serde::{Deserialize, Serialize};
use sha3::{Digest, Sha3_512};
use tokio::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager};

use wichain_blockchain::Blockchain;
use wichain_network::{NetworkMessage, NetworkNode, PeerInfo};
mod crypto_utils;
use crypto_utils::{encrypt_text, decrypt_text};
use std::fs::File;
use std::io::Read;
use rand::RngCore;
use std::io::Write;
// Fixed import for x25519-dalek 2.0.1
use x25519_dalek::{PublicKey as X25519Public, EphemeralSecret as X25519Secret};

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
    pub x25519_private_b64: String,
    pub x25519_public_b64: String,
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
    pub aes_key: Arc<[u8; 32]>,
}

// -----------------------------------------------------------------------------
// Lightweight SHA3‑512 XOR "confidentiality" helpers
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
    let verifying_key = signing_key.verifying_key();
    let alias = format!("Anon-{}", rand::random::<u16>());
    let public_key_b64 = general_purpose::STANDARD.encode(verifying_key.to_bytes());
    let private_key_b64 = general_purpose::STANDARD.encode(signing_key.to_bytes());

    // Generate X25519 keypair
    let x25519_secret = X25519Secret::random_from_rng(&mut OsRng);
    let x25519_public = X25519Public::from(&x25519_secret);
    let x25519_public_b64 = general_purpose::STANDARD.encode(x25519_public.as_bytes());
    // For x25519-dalek 2.0.1, we can't easily serialize EphemeralSecret
    // We'll use a different approach - generate a random seed and store it
    let mut seed = [0u8; 32];
    OsRng.fill_bytes(&mut seed);
    let x25519_private_b64 = general_purpose::STANDARD.encode(seed);

    let id = StoredIdentity {
        alias,
        public_key_b64,
        private_key_b64,
        x25519_private_b64,
        x25519_public_b64,
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

fn b64_to_32(bytes_b64: &str) -> [u8; 32] {
    let vec = general_purpose::STANDARD.decode(bytes_b64).expect("b64 decode");
    let mut arr = [0u8; 32];
    arr.copy_from_slice(&vec);
    arr
}

// Helper function to create X25519Secret from stored bytes
fn x25519_secret_from_b64(b64: &str) -> X25519Secret {
    let bytes = b64_to_32(b64);
    // For x25519-dalek 2.0.1, we'll use the bytes as a seed for a deterministic RNG
    // This is a simplified approach - in production you'd want a more secure method
    let mut rng = rand::rngs::StdRng::from_seed(bytes);
    X25519Secret::random_from_rng(&mut rng)
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

    let json = serde_json::to_string(chat_signed).unwrap();
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

    // ---- 0. Try direct SHA3-XOR deobfuscation w/ reported 'from' ----
    if let Some(clear) = simple_deobfuscate_json(my_pub_b64, network_from_b64, cleaned) {
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
        warn!("inbound: deobf w/reported sender FAILED; will brute peers.");
    }

    // ---- 1. Brute deobf w/ *all* known peers (sender mismatch) ----
    let peers = node.list_peers().await;
    for p in &peers {
        if p.id == network_from_b64 {
            continue; // already tried above
        }
        if let Some(clear) = simple_deobfuscate_json(my_pub_b64, &p.id, cleaned) {
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

    let (my_pub, my_sk, my_x25519_private_b64) = {
        let id = state.identity.lock().await;
        (id.public_key_b64.clone(), state.signing_key.lock().await.clone(), id.x25519_private_b64.clone())
    };

    // Use stored X25519 private key for encryption
    let aes_key = if !my_x25519_private_b64.is_empty() {
        let recipient_x25519_public = X25519Public::from(b64_to_32(&peer_id));
        let my_x25519_secret = x25519_secret_from_b64(&my_x25519_private_b64);
        let shared_secret = my_x25519_secret.diffie_hellman(&recipient_x25519_public);
        let shared_bytes = shared_secret.as_bytes();
        // Convert to owned array to avoid lifetime issues
        let mut aes_key = [0u8; 32];
        aes_key.copy_from_slice(shared_bytes);
        aes_key
    } else {
        // Fallback to old encryption method
        *state.aes_key
    };

    let encrypted_text = encrypt_text(&content, &aes_key).unwrap_or_else(|_| "[ENCRYPT_ERROR]".to_string());
    let body = ChatBody {
        from: my_pub.clone(),
        to: Some(peer_id.to_string()),
        text: encrypted_text,
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

    if let Err(e) = state.node.send_direct_block(peer_id, obf_b64).await {
        warn!("add_chat_message: send_direct_block error -> {}: {e}", peer_id);
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
        let obf_b64 = simple_obfuscate_json(&my_pub, member, &clear_json);
        if let Err(e) = state.node.send_direct_block(member, obf_b64).await {
            warn!("create_group: send_direct_block error -> {}: {e}", member);
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
        
        // Use stored X25519 private key for encryption if available
        let aes_key = if !id.x25519_private_b64.is_empty() {
            // For group messages, we'll use the old method for now since we need to encrypt for multiple recipients
            &*state.aes_key
        } else {
            &*state.aes_key
        };
        
        let encrypted_text = encrypt_text(&content, aes_key).unwrap_or_else(|_| "[ENCRYPT_ERROR]".to_string());
        let body = ChatBody {
            from: id.public_key_b64.clone(),
            to: Some(group_id.clone()),
            text: encrypted_text,
            ts_ms: now_ms(),
        };
        (id.public_key_b64.clone(), ChatSigned::new_signed(body, &*sk))
    };

    let clear_json = serde_json::to_string(&chat_signed).unwrap();

    // append clear locally
    {
        let mut chain = state.blockchain.lock().await;
        chain.add_text_block(clear_json.clone());
        chain.save_to_file(&state.blockchain_path).ok();
    }
    let _ = state.app.emit("chat_update", ());

    // fan‑out: obfuscate uniquely per member
    for member in group.members.iter().filter(|m| *m != &my_pub) {
        let obf = simple_obfuscate_json(&my_pub, member, &clear_json);
        if let Err(e) = state.node.send_direct_block(member, obf).await {
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
                || signed.body.to.as_ref().map(|gid| state.groups.is_member(gid, &my_pub)).unwrap_or(false)
            {
                // Get the stored X25519 private key for decryption
                let my_x25519_private_b64 = {
                    let id = state.identity.lock().await;
                    id.x25519_private_b64.clone()
                };
                
                if !my_x25519_private_b64.is_empty() {
                    let sender_x25519_public = X25519Public::from(b64_to_32(&signed.body.from));
                    let my_x25519_secret = x25519_secret_from_b64(&my_x25519_private_b64);
                    let shared_secret = my_x25519_secret.diffie_hellman(&sender_x25519_public);
                    let shared_bytes = shared_secret.as_bytes();
                    // Convert to owned array to avoid lifetime issues
                    let mut aes_key = [0u8; 32];
                    aes_key.copy_from_slice(shared_bytes);

                    let decrypted_text = decrypt_text(&signed.body.text, &aes_key).unwrap_or_else(|_| "[DECRYPT_ERROR]".to_string());
                    let mut signed = signed;
                    signed.body.text = decrypted_text;
                    out.push(signed.body);
                } else {
                    // Fallback to old encryption method
                    let decrypted_text = decrypt_text(&signed.body.text, &*state.aes_key).unwrap_or_else(|_| "[DECRYPT_ERROR]".to_string());
                    let mut signed = signed;
                    signed.body.text = decrypted_text;
                    out.push(signed.body);
                }
            }
            continue;
        }
        if let Ok(body) = serde_json::from_str::<ChatBody>(&b.data) {
            if body.from == my_pub
                || body.to.as_deref() == Some(&my_pub)
                || body.to.as_ref().map(|gid| state.groups.is_member(gid, &my_pub)).unwrap_or(false)
            {
                let decrypted_text = decrypt_text(&body.text, &*state.aes_key).unwrap_or_else(|_| "[DECRYPT_ERROR]".to_string());
                let mut body = body;
                body.text = decrypted_text;
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

fn load_or_create_aes_key(path: &std::path::Path) -> Result<[u8; 32], String> {
    if path.exists() {
        let mut file = File::open(path).map_err(|e| format!("open key: {e}"))?;
        let mut buf = [0u8; 32];
        file.read_exact(&mut buf).map_err(|e| format!("read key: {e}"))?;
        Ok(buf)
    } else {
        let mut buf = [0u8; 32];
        rand::thread_rng().fill_bytes(&mut buf);
        let mut file = File::create(path).map_err(|e| format!("create key: {e}"))?;
        file.write_all(&buf).map_err(|e| format!("write key: {e}"))?;
        Ok(buf)
    }
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
                aes_key: Arc::new(load_or_create_aes_key(&data_dir.join("aes_key.bin")).expect("AES key")),
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