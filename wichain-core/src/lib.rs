//! Core WiChain primitives: identities, signed messages, trust scoring utilities.
//
// Modules
pub mod message;
pub mod trust;

pub use message::{
    SignedMessage,
    LegacyMessageJson,
    generate_key as generate_signing_key, // rename export; adjust if you prefer original
};
pub use trust::*; // re‑export TrustManager, Peer, etc.

use ed25519_dalek::{Signature, Signer, Verifier, SigningKey, VerifyingKey};
use rand_core::OsRng;
use serde::{Serialize, Deserialize};
use thiserror::Error;

// *** bring trait into scope for base64 encode/decode ***
use base64::{engine::general_purpose, Engine as _};

/// Errors that arise when dealing with identities, key parsing, encoding, etc.
#[derive(Debug, Error)]
pub enum IdentityError {
    #[error("invalid base64: {0}")]
    Base64(#[from] base64::DecodeError),
    #[error("invalid public key length: expected 32, got {0}")]
    BadPubLen(usize),
}

/// Helper: base64‑encode a 32‑byte Ed25519 public key.
pub fn encode_pubkey_b64(pk_bytes: &[u8; 32]) -> String {
    general_purpose::STANDARD.encode(pk_bytes)
}

/// Helper: decode a base64 Ed25519 public key into a 32‑byte array.
pub fn decode_pubkey_b64(s: &str) -> Result<[u8; 32], IdentityError> {
    let v = general_purpose::STANDARD.decode(s)?;
    if v.len() != 32 {
        return Err(IdentityError::BadPubLen(v.len()));
    }
    let mut arr = [0u8; 32];
    arr.copy_from_slice(&v);
    Ok(arr)
}

/// A locally stored identity (alias + keypair).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserIdentity {
    pub alias: String,
    pub public_key: [u8; 32],
    pub private_key: [u8; 32],
}

impl UserIdentity {
    pub fn generate(alias: String) -> Self {
        let signing_key = SigningKey::generate(&mut OsRng);
        let verifying_key = signing_key.verifying_key();

        UserIdentity {
            alias,
            public_key: verifying_key.to_bytes(),
            private_key: signing_key.to_bytes(),
        }
    }

    pub fn sign(&self, message: &[u8]) -> Signature {
        let signing_key = SigningKey::from_bytes(&self.private_key);
        signing_key.sign(message)
    }

    pub fn verify(public_key_bytes: &[u8; 32], message: &[u8], signature: &Signature) -> bool {
        if let Ok(verifying_key) = VerifyingKey::try_from(public_key_bytes.as_slice()) {
            verifying_key.verify(message, signature).is_ok()
        } else {
            false
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_keypair_generation_and_signing() {
        let identity = UserIdentity::generate("Alice".to_string());
        let message = b"Hello WiChain!";
        let signature = identity.sign(message);

        let is_valid = UserIdentity::verify(&identity.public_key, message, &signature);
        assert!(is_valid);
    }

    #[test]
    fn test_pubkey_b64_roundtrip() {
        let id = UserIdentity::generate("Bob".into());
        let enc = encode_pubkey_b64(&id.public_key);
        let dec = decode_pubkey_b64(&enc).unwrap();
        assert_eq!(dec, id.public_key);
    }
}
