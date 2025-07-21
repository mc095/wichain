use sha2::{Sha512, Digest};
use base64::{encode as b64_encode, decode as b64_decode};

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
