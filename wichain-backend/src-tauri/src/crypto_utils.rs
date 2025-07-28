use sha2::{Sha512, Digest};
use base64::{encode as b64_encode, decode as b64_decode};
use aes_gcm::{Aes256Gcm, Key, Nonce};
use aes_gcm::aead::{Aead, NewAead};
use rand::RngCore;

/// Derives a 64-byte XOR key from two pubkeys using SHA-512.
fn derive_simple_key(pub_a: &str, pub_b: &str) -> [u8; 64] {
    let mut hasher = Sha512::new();
    hasher.update(pub_a.as_bytes());
    hasher.update(pub_b.as_bytes());
    let result = hasher.finalize();
    let mut key = [0u8; 64];
    key.copy_from_slice(&result);
    key
}

/// XORs input with the key (repeating key as needed).
fn xor_with_key(data: &[u8], key: &[u8]) -> Vec<u8> {
    data.iter()
        .enumerate()
        .map(|(i, &b)| b ^ key[i % key.len()])
        .collect()
}

/// Encrypt using SHA512-based XOR mask
fn simple_encrypt(message: &str, my_pub: &str, peer_pub: &str) -> String {
    let key = derive_simple_key(my_pub, peer_pub);
    let encrypted = xor_with_key(message.as_bytes(), &key);
    b64_encode(encrypted)
}

/// Decrypt using SHA512-based XOR mask
fn simple_decrypt(cipher_b64: &str, my_pub: &str, peer_pub: &str) -> Option<String> {
    let key = derive_simple_key(my_pub, peer_pub);
    if let Ok(cipher) = b64_decode(cipher_b64) {
        let decrypted = xor_with_key(&cipher, &key);
        String::from_utf8(decrypted).ok()
    } else {
        None
    }
}

/// Encrypts a message with AES-GCM using the provided 32-byte key.
pub fn encrypt_text(plain: &str, key_bytes: &[u8; 32]) -> Result<String, String> {
    let key = Key::from_slice(key_bytes);
    let cipher = Aes256Gcm::new(key);
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
    Ok(base64::encode(out))
}

/// Decrypts a message with AES-GCM using the provided 32-byte key.
pub fn decrypt_text(cipher_b64: &str, key_bytes: &[u8; 32]) -> Result<String, String> {
    let data = base64::decode(cipher_b64).map_err(|e| format!("b64 decode: {e}"))?;
    if data.len() < 12 {
        return Err("ciphertext too short".to_string());
    }
    let (nonce_bytes, ciphertext) = data.split_at(12);
    let key = Key::from_slice(key_bytes);
    let cipher = Aes256Gcm::new(key);
    let nonce = Nonce::from_slice(nonce_bytes);
    let plaintext = cipher
        .decrypt(nonce, ciphertext)
        .map_err(|e| format!("decrypt error: {e}"))?;
    String::from_utf8(plaintext).map_err(|e| format!("utf8 error: {e}"))
}
