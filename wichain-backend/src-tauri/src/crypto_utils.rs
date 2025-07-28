use aes_gcm::{Aes256Gcm, Nonce};
use aes_gcm::aead::Aead;
use aes_gcm::aead::KeyInit;
use rand::RngCore;
use base64::engine::general_purpose;
use base64::Engine; // Needed for .encode/.decode

/// Encrypts a message with AES-GCM using the provided 32-byte key.
pub fn encrypt_text(plain: &str, key_bytes: &[u8; 32]) -> Result<String, String> {
    let cipher = Aes256Gcm::new_from_slice(key_bytes)
        .map_err(|e| format!("key error: {e}"))?;
    let mut nonce_bytes = [0u8; 12];
    rand::thread_rng().fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);
    let ciphertext = cipher
        .encrypt(nonce, plain.as_bytes())
        .map_err(|e| format!("encrypt error: {e}"))?;
    // Store nonce + ciphertext as base64
    let mut out = Vec::new();
    out.extend_from_slice(&nonce_bytes);
    out.extend_from_slice(&ciphertext);
    Ok(general_purpose::STANDARD.encode(out))
}

/// Decrypts a message with AES-GCM using the provided 32-byte key.
pub fn decrypt_text(cipher_b64: &str, key_bytes: &[u8; 32]) -> Result<String, String> {
    let data = general_purpose::STANDARD.decode(cipher_b64).map_err(|e| format!("b64 decode: {e}"))?;
    if data.len() < 12 {
        return Err("ciphertext too short".to_string());
    }
    let (nonce_bytes, ciphertext) = data.split_at(12);
    let cipher = Aes256Gcm::new_from_slice(key_bytes)
        .map_err(|e| format!("key error: {e}"))?;
    let nonce = Nonce::from_slice(nonce_bytes);
    let plaintext = cipher
        .decrypt(nonce, ciphertext)
        .map_err(|e| format!("decrypt error: {e}"))?;
    String::from_utf8(plaintext).map_err(|e| format!("utf8 error: {e}"))
}
