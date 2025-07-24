//! Signed chat message type used across WiChain.
//!
//! Historical context: an earlier version used a minimal JSON payload with
//! fields { id, sender, content, signature }. To preserve backward compatibility
//! with messages already logged to disk or broadcast by older peers, we still
//! support deserializing that shape via `LegacyMessageJson` and converting into
//! [`SignedMessage`] when possible.

use ed25519_dalek::{Signer, Verifier, SigningKey, VerifyingKey, Signature};
use rand::rngs::OsRng;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use uuid::Uuid;
use std::convert::TryInto;

// bring base64 trait into scope
use base64::{engine::general_purpose, Engine as _};

use crate::{encode_pubkey_b64, decode_pubkey_b64};

/// Canonical WiChain signed chat message.
///
/// Fields:
/// - `id`: random UUID per message.
/// - `from`: base64 sender public key (32 bytes).
/// - `to`: optional recipient pubkey (base64) for future direct mode; empty = broadcast.
/// - `timestamp_ms`: sender clock (millis since UNIX epoch) for ordering UX; not trusted consensus.
/// - `content`: message body text (UTF‑8).
/// - `sig`: base64(64 bytes) Ed25519 signature over canonical digest.
///
/// Digest = SHA256( id || from || to || timestamp_ms || content_bytes )
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SignedMessage {
    pub id: String,
    pub from: String,
    #[serde(default)]
    pub to: Option<String>,
    pub timestamp_ms: u64,
    pub content: String,
    pub sig: String,
}

impl SignedMessage {
    /// Create + sign a new message.
    pub fn new(
        content: String,
        signing_key: &SigningKey,
        to: Option<String>,
        timestamp_ms: u64,
    ) -> Self {
        let id = Uuid::new_v4().to_string();
        let from = encode_pubkey_b64(&signing_key.verifying_key().to_bytes());
        let digest_bytes = Self::digest_bytes_static(&id, &from, to.as_deref(), timestamp_ms, &content);
        let sig = signing_key.sign(&digest_bytes);
        let sig_b64 = general_purpose::STANDARD.encode(sig.to_bytes());
        Self {
            id,
            from,
            to,
            timestamp_ms,
            content,
            sig: sig_b64,
        }
    }

    /// Convenience: create with current system time (best‑effort; not trusted).
    pub fn new_now(content: String, signing_key: &SigningKey, to: Option<String>) -> Self {
        let ts = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis() as u64)
            .unwrap_or_default();
        Self::new(content, signing_key, to, ts)
    }

    /// Verify signature.
    pub fn verify(&self) -> bool {
        // decode sender pubkey
        let pubkey = match decode_pubkey_b64(&self.from) {
            Ok(pk) => pk,
            Err(_) => return false,
        };
        // reconstruct verifying key
        let vk = match VerifyingKey::try_from(pubkey.as_slice()) {
            Ok(v) => v,
            Err(_) => return false,
        };
        // decode sig
        let sig_bytes = match general_purpose::STANDARD.decode(&self.sig) {
            Ok(b) => b,
            Err(_) => return false,
        };
        let arr: [u8; 64] = match sig_bytes.as_slice().try_into() {
            Ok(a) => a,
            Err(_) => return false,
        };
        let sig = match Signature::try_from(arr) {
            Ok(s) => s,
            Err(_) => return false,
        };
        // digest
        let digest_bytes =
            Self::digest_bytes_static(&self.id, &self.from, self.to.as_deref(), self.timestamp_ms, &self.content);
        vk.verify(&digest_bytes, &sig).is_ok()
    }

    /// Compute the message digest used for signing.
    fn digest_bytes_static(
        id: &str,
        from: &str,
        to: Option<&str>,
        timestamp_ms: u64,
        content: &str,
    ) -> [u8; 32] {
        let mut hasher = Sha256::new();
        hasher.update(id.as_bytes());
        hasher.update(from.as_bytes());
        if let Some(t) = to {
            hasher.update(t.as_bytes());
        }
        hasher.update(timestamp_ms.to_le_bytes());
        hasher.update(content.as_bytes());
        let out = hasher.finalize();
        out.into()
    }

    /// Return the canonical digest for this instance.
    pub fn digest_bytes(&self) -> [u8; 32] {
        Self::digest_bytes_static(&self.id, &self.from, self.to.as_deref(), self.timestamp_ms, &self.content)
    }
}

/// Legacy v0 JSON message shape (for backward compatibility).
///
/// ```json
/// { "id": "...", "sender": "<b64pub>", "content": "...", "signature": "<b64sig>" }
/// ```
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LegacyMessageJson {
    pub id: String,
    pub sender: String,
    pub content: String,
    pub signature: String,
}

impl LegacyMessageJson {
    /// Attempt to verify the legacy message signature (old digest: SHA256(content || id)).
    pub fn verify(&self) -> bool {
        // decode pubkey
        let pk = match crate::decode_pubkey_b64(&self.sender) {
            Ok(pk) => pk,
            Err(_) => return false,
        };
        let vk = match VerifyingKey::try_from(pk.as_slice()) {
            Ok(vk) => vk,
            Err(_) => return false,
        };
        // sig
        let sig_bytes = match general_purpose::STANDARD.decode(&self.signature) {
            Ok(b) => b,
            Err(_) => return false,
        };
        let arr: [u8; 64] = match sig_bytes.as_slice().try_into() {
            Ok(a) => a,
            Err(_) => return false,
        };
        let sig = match Signature::try_from(arr) {
            Ok(s) => s,
            Err(_) => return false,
        };
        // digest (legacy)
        let mut hasher = Sha256::new();
        hasher.update(self.content.as_bytes());
        hasher.update(self.id.as_bytes());
        let digest = hasher.finalize();
        vk.verify(&digest, &sig).is_ok()
    }

    /// Convert (if verified) into a `SignedMessage` approx. representation.
    /// Legacy format has no timestamp or recipient; we fill with best‑effort defaults.
    pub fn into_signed(self) -> Option<SignedMessage> {
        if !self.verify() {
            return None;
        }
        Some(SignedMessage {
            id: self.id,
            from: self.sender,
            to: None,
            timestamp_ms: 0,
            content: self.content,
            sig: self.signature,
        })
    }
}

/// Generate a new Ed25519 signing key (helper).
pub fn generate_key() -> SigningKey {
    SigningKey::generate(&mut OsRng)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn signed_message_roundtrip() {
        let sk = generate_key();
        let m = SignedMessage::new_now("hello".into(), &sk, None);
        assert!(m.verify());
    }

    #[test]
    fn legacy_message_verify() {
        // Build a legacy message and confirm conversion works.
        let sk = generate_key();
        let id = uuid::Uuid::new_v4().to_string();
        let sender = super::encode_pubkey_b64(&sk.verifying_key().to_bytes());
        let content = "legacy test";
        // legacy digest
        let mut h = Sha256::new();
        h.update(content.as_bytes());
        h.update(id.as_bytes());
        let dig = h.finalize();
        let sig = sk.sign(&dig);
        let sig_b64 = general_purpose::STANDARD.encode(sig.to_bytes());

        let legacy = LegacyMessageJson {
            id,
            sender,
            content: content.into(),
            signature: sig_b64,
        };
        assert!(legacy.verify());
        let sm = legacy.into_signed().unwrap();
        // For legacy -> SignedMessage we don't assert verify() because digest scheme differs; we
        // just assert conversion worked.
        let _ = sm;
    }
}
// message.rs