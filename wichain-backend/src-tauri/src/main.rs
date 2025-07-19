#![cfg_attr(all(not(debug_assertions), target_os = "windows"), windows_subsystem = "windows")]

//! WiChain Tauri backend – *direct LAN chat edition* with signed + encrypted messages.
//!
//! Key points:
//! - Direct UDP peer messaging; no full‑chain broadcast.
//! - Canonical `ChatBody` is signed (Ed25519), encrypted (ChaCha20Poly1305 w/ X25519 DH).
//! - Verified cleartext (`ChatSigned`) appended to local blockchain (tamper‑evident log).
//! - Alias hot‑update & live reset (identity + chain) supported.
//! - Legacy plaintext interop: if decrypt/parse fails, wrap as minimal payload.
//!
//! Events -> UI: `peer_update`, `chat_update`, `alias_update`, `reset_done`.
//!
//! Commands -> UI: `get_identity`, `set_alias`, `get_peers`, `add_chat_message`,
//! `get_chat_history`, `reset_data`.

use std::{
    fs,
    path::{Path, PathBuf},
    sync::Arc,
};

use base64::{engine::general_purpose, Engine as _};
use chacha20poly1305::{
    aead::{Aead, KeyInit},
    ChaCha20Poly1305, Key, Nonce,
};
use ed25519_dalek::{Signer as _, SigningKey, VerifyingKey};
use log::{info, warn};
use rand::rngs::OsRng;
use serde::{Deserialize, Serialize};
use tokio::sync::Mutex;
// NOTE: use the top-level x25519() function; the StaticSecret type is not available in the
// version you have in your dependency graph.
use x25519_dalek::x25519;

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

/// Canonical body we sign.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatBody {
    pub from: String,        // sender pubkey b64
    pub to: Option<String>,  // receiver pubkey b64; None => group/all
    pub text: String,        // UTF‑8
    pub ts_ms: u128,         // unix ms
}

/// Signed body we encrypt + store.
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
/// `signing_key` wrapped in `Arc<Mutex<...>>` so we can replace it on live reset.
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
                let signing_key = Arc::clone(&signing_key);
                let identity = Arc::clone(&identity);
                let app_handle_for_task = app.handle().clone();
                tauri::async_runtime::spawn(async move {
                    while let Some(msg) = rx.recv().await {
                        match msg {
                            NetworkMessage::DirectBlock { from, to, payload_json } => {
                                // decrypt + verify; append
                                let my_pub = {
                                    let id = identity.lock().await;
                                    id.public_key_b64.clone()
                                };
                                handle_incoming_network_payload(
                                    &app_handle_for_task,
                                    &blockchain,
                                    &blockchain_path,
                                    &signing_key,
                                    &my_pub,
                                    &from,
                                    &to,
                                    &payload_json,
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
// crypto helpers (demo‑grade)
// -----------------------------------------------------------------------------
/// Derive a 32‑byte shared secret via X25519 using *Ed25519 seed bytes* as the scalar.
/// **Security note:** For demo/testing only. A production system should perform a
/// proper Ed25519→X25519 conversion (per RFC 7748 guidance) or maintain a
/// dedicated X25519 keypair.
fn derive_shared_key_32(sk: &SigningKey, peer_pub_b64: &str) -> Option<[u8; 32]> {
    // local scalar = Ed25519 seed (32 bytes)
    let my_seed = sk.to_bytes();
    // peer public = Ed25519 compressed 32 bytes; we reuse raw bytes as X25519 u‑coordinate
    let peer_bytes_vec = general_purpose::STANDARD.decode(peer_pub_b64.as_bytes()).ok()?;
    if peer_bytes_vec.len() != 32 {
        return None;
    }
    let mut peer_bytes = [0u8; 32];
    peer_bytes.copy_from_slice(&peer_bytes_vec);

    let shared = x25519(my_seed, peer_bytes);
    Some(shared)
}

fn encrypt_payload(clear: &[u8], key_bytes: &[u8; 32]) -> (Vec<u8>, [u8; 12]) {
    let key = Key::from_slice(key_bytes);
    let cipher = ChaCha20Poly1305::new(key);
    let nonce_bytes: [u8; 12] = rand::random();
    let nonce = Nonce::from_slice(&nonce_bytes);
    let ct = cipher.encrypt(nonce, clear).expect("encrypt");
    (ct, nonce_bytes)
}

fn decrypt_payload(ct: &[u8], nonce_bytes: &[u8; 12], key_bytes: &[u8; 32]) -> Option<Vec<u8>> {
    let key = Key::from_slice(key_bytes);
    let cipher = ChaCha20Poly1305::new(key);
    let nonce = Nonce::from_slice(nonce_bytes);
    cipher.decrypt(nonce, ct).ok()
}

/// Tag prefix used in network `payload_json` when encrypted.
const ENC_TAG: &str = "E1:";

/// Produce tagged ciphertext string.
fn make_enc_string(nonce: &[u8; 12], ct: &[u8]) -> String {
    let mut buf = Vec::with_capacity(12 + ct.len());
    buf.extend_from_slice(nonce);
    buf.extend_from_slice(ct);
    format!("{ENC_TAG}{}", general_purpose::STANDARD.encode(buf))
}

/// Attempt to parse tagged ciphertext string. Returns (nonce, ct) if tagged.
fn parse_enc_string(s: &str) -> Option<([u8; 12], Vec<u8>)> {
    if !s.starts_with(ENC_TAG) {
        return None;
    }
    let b64 = &s[ENC_TAG.len()..];
    let bytes = general_purpose::STANDARD.decode(b64.as_bytes()).ok()?;
    if bytes.len() < 12 {
        return None;
    }
    let mut nonce = [0u8; 12];
    nonce.copy_from_slice(&bytes[..12]);
    let ct = bytes[12..].to_vec();
    Some((nonce, ct))
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

/// Append a verified ChatSigned JSON string to the local blockchain.
async fn append_verified_chat_json(
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

/// Handle inbound network payload (may be encrypted or legacy plaintext).
async fn handle_incoming_network_payload(
    app: &AppHandle,
    blockchain: &Arc<Mutex<Blockchain>>,
    blockchain_path: &Path,
    my_sk_arc: &Arc<Mutex<SigningKey>>,
    _my_pub_b64: &str,
    from_pub_b64: &str,
    to_pub_b64: &str,
    payload_str: &str,
) {
    // 1. Try encrypted path.
    if let Some((nonce, ct)) = parse_enc_string(payload_str) {
        // We need our local signing key to derive shared
        let my_sk = my_sk_arc.lock().await;
        if let Some(shared) = derive_shared_key_32(&*my_sk, from_pub_b64) {
            if let Some(clear) = decrypt_payload(&ct, &nonce, &shared) {
                if let Ok(chat_signed) = serde_json::from_slice::<ChatSigned>(&clear) {
                    // verify using sender pubkey
                    if let Ok(sender_pub_bytes_vec) =
                        general_purpose::STANDARD.decode(from_pub_b64.as_bytes())
                    {
                        if sender_pub_bytes_vec.len() == 32 {
                            let mut arr = [0u8; 32];
                            arr.copy_from_slice(&sender_pub_bytes_vec);
                            match VerifyingKey::from_bytes(&arr) {
                                Ok(vk) => {
                                    if chat_signed.verify(&vk) {
                                        let json = serde_json::to_string(&chat_signed).unwrap();
                                        append_verified_chat_json(
                                            app,
                                            blockchain,
                                            blockchain_path,
                                            &json,
                                        )
                                        .await;
                                        return;
                                    } else {
                                        warn!(
                                            "Received encrypted chat: signature verify failed \
                                             (from={})",
                                            &from_pub_b64[..8.min(from_pub_b64.len())]
                                        );
                                    }
                                }
                                Err(e) => warn!("Bad sender pubkey bytes: {e}"),
                            }
                        }
                    }
                } else {
                    warn!("Received encrypted chat: JSON parse failed.");
                }
            } else {
                warn!("Decrypt failed (maybe wrong key).");
            }
        }
    }

    // 2. Legacy plaintext fallback -> wrap minimal body + no sig.
    let body = ChatBody {
        from: from_pub_b64.to_string(),
        to: Some(to_pub_b64.to_string()),
        text: payload_str.to_string(),
        ts_ms: now_ms(),
    };
    let chat = ChatSigned {
        body,
        sig_b64: String::new(),
    };
    let json = serde_json::to_string(&chat).unwrap();
    append_verified_chat_json(app, blockchain, blockchain_path, &json).await;
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

/// Add chat message (to one peer or all peers).
#[tauri::command]
async fn add_chat_message(
    state: tauri::State<'_, AppState>,
    content: String,
    to_peer: Option<String>,
) -> Result<(), String> {
    let (my_pub, my_sk) = {
        let id = state.identity.lock().await;
        (id.public_key_b64.clone(), Arc::clone(&state.signing_key))
    };

    // canonical body
    let body = ChatBody {
        from: my_pub.clone(),
        to: to_peer.clone(),
        text: content.clone(),
        ts_ms: now_ms(),
    };
    // signed
    let my_sk_locked = my_sk.lock().await;
    let chat_signed = ChatSigned::new_signed(body.clone(), &*my_sk_locked);
    drop(my_sk_locked);
    let clear_json = serde_json::to_string(&chat_signed).map_err(|e| e.to_string())?;

    // append locally (store clear signed JSON)
    {
        let mut chain = state.blockchain.lock().await;
        chain.add_text_block(clear_json.clone());
        if let Err(e) = chain.save_to_file(&state.blockchain_path) {
            return Err(format!("save error: {e}"));
        }
    }
    let _ = state.app.emit("chat_update", ());

    // send
    match to_peer {
        Some(peer_id) => {
            send_encrypted_to_peer(&state, &chat_signed, &peer_id).await;
        }
        None => {
            // send to all
            let peers = state.node.list_peers().await;
            for p in peers {
                send_encrypted_to_peer(&state, &chat_signed, &p.id).await;
            }
        }
    }
    Ok(())
}

/// Encrypt+send helper (logs on error; never returns Err to caller).
async fn send_encrypted_to_peer(
    state: &tauri::State<'_, AppState>,
    chat_signed: &ChatSigned,
    peer_pub_b64: &str,
) {
    // Serialize clear signed payload
    let clear_json = match serde_json::to_string(chat_signed) {
        Ok(s) => s,
        Err(e) => {
            warn!("serialize chat_signed: {e}");
            return;
        }
    };

    // derive key
    let my_sk = state.signing_key.lock().await;
    let shared = match derive_shared_key_32(&*my_sk, peer_pub_b64) {
        Some(k) => k,
        None => {
            warn!("send_encrypted_to_peer: bad peer pubkey.");
            return;
        }
    };
    drop(my_sk);

    let (ct, nonce) = encrypt_payload(clear_json.as_bytes(), &shared);
    let enc_str = make_enc_string(&nonce, &ct);
    if let Err(e) = state.node.send_direct_block(peer_pub_b64, enc_str).await {
        warn!("send_direct_block error -> {}: {e}", peer_pub_b64);
    }
}

/// Fetch all chat payloads (parsed) for UI.
/// We return simplified `ChatBody` list (drop sig) for UI convenience.
#[tauri::command]
async fn get_chat_history(state: tauri::State<'_, AppState>) -> Result<Vec<ChatBody>, String> {
    let chain = state.blockchain.lock().await;
    let mut out = Vec::new();
    for b in &chain.chain {
        if let Ok(signed) = serde_json::from_str::<ChatSigned>(&b.data) {
            out.push(signed.body);
            continue;
        }
        if let Ok(body) = serde_json::from_str::<ChatBody>(&b.data) {
            out.push(body);
            continue;
        }
    }
    Ok(out)
}

/// Reset data: wipe state + generate new identity live.
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
    let new_signing_key = decode_signing_key(&new_id)
        .map_err(|e| format!("failed to decode new key: {e}"))?;

    {
        let mut id = state.identity.lock().await;
        *id = new_id.clone();
    }
    {
        let mut sk = state.signing_key.lock().await;
        *sk = new_signing_key;
    }

    // Update node alias + announce
    state.node.set_alias(new_id.alias.clone()).await;

    warn!("Local WiChain data reset live (new alias: {}).", new_id.alias);
    let _ = state.app.emit("reset_done", new_id);
    Ok(())
}
