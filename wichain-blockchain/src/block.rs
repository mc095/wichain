//! Block type used in the WiChain local ledger.
//!
//! **Backward compatibility note:**
//! Older WiChain prototypes stored only an opaque text `data` field per block.
//! We retain that shape so previously serialized chains continue to load.
//!
//! Newer code can embed *structured signed chat messages* in a block by
//! JSON‑serializing a `Vec<SignedMessage>` into the `data` field. Helper
//! constructors (`Block::new_messages`) and accessors (`as_messages`) are
//! provided. If parsing fails, callers can still fall back to raw text via
//! `raw_data()`.

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fmt;

use wichain_core::SignedMessage;

/// A single block in the chain.
///
/// Fields intentionally mirror the original prototype to preserve on‑disk
/// compatibility. `data` is an opaque UTF‑8 string; high‑level helpers let you
/// embed and recover structured payloads (SignedMessage list) as JSON.
///
/// Hash is computed as:
/// ```text
/// SHA256(index || timestamp_ms || previous_hash || nonce || data)
/// ```
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Block {
    pub index: u64,
    pub timestamp_ms: u128,
    pub previous_hash: String,
    pub nonce: u64,
    pub data: String,
    pub hash: String,
}

impl Block {
    /// General constructor; caller supplies `data`.
    pub fn new(
        index: u64,
        timestamp_ms: u128,
        previous_hash: String,
        nonce: u64,
        data: String,
    ) -> Self {
        let mut b = Self {
            index,
            timestamp_ms,
            previous_hash,
            nonce,
            data,
            hash: String::new(),
        };
        b.hash = b.calculate_hash();
        b
    }

    /// Convenience: create a block containing **text** data.
    pub fn new_text(
        index: u64,
        timestamp_ms: u128,
        previous_hash: String,
        text: impl Into<String>,
    ) -> Self {
        Self::new(index, timestamp_ms, previous_hash, 0, text.into())
    }

    /// Convenience: create a block containing **one signed message**.
    pub fn new_message(
        index: u64,
        timestamp_ms: u128,
        previous_hash: String,
        msg: &SignedMessage,
    ) -> Self {
        Self::new_messages(index, timestamp_ms, previous_hash, &[msg.clone()])
    }

    /// Convenience: create a block containing **multiple signed messages**.
    pub fn new_messages(
        index: u64,
        timestamp_ms: u128,
        previous_hash: String,
        msgs: &[SignedMessage],
    ) -> Self {
        let data = serde_json::to_string(msgs).unwrap_or_else(|_| "[]".to_string());
        Self::new(index, timestamp_ms, previous_hash, 0, data)
    }

    /// Recompute the block hash.
    pub fn calculate_hash(&self) -> String {
        let input = format!(
            "{}{}{}{}{}",
            self.index, self.timestamp_ms, self.previous_hash, self.nonce, self.data
        );
        let mut hasher = Sha256::new();
        hasher.update(input.as_bytes());
        format!("{:x}", hasher.finalize())
    }

    /// Raw (opaque) payload string.
    pub fn raw_data(&self) -> &str {
        &self.data
    }

    /// Attempt to parse this block's `data` into a list of `SignedMessage`s.
    /// Returns `None` if `data` is not valid JSON array or if any element fails
    /// to deserialize.
    pub fn as_messages(&self) -> Option<Vec<SignedMessage>> {
        match serde_json::from_str::<Vec<SignedMessage>>(&self.data) {
            Ok(v) => Some(v),
            Err(_) => None,
        }
    }

    /// Parse messages *and* verify signatures. Returns only verified messages.
    /// If parsing fails, returns empty vec.
    pub fn verified_messages(&self) -> Vec<SignedMessage> {
        self.as_messages()
            .unwrap_or_default()
            .into_iter()
            .filter(|m| m.verify())
            .collect()
    }
}

impl fmt::Display for Block {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let preview = if let Some(msgs) = self.as_messages() {
            format!("{} msgs", msgs.len())
        } else {
            let d = self.data.replace('\n', " ");
            if d.len() > 32 {
                format!("{}...", &d[..32])
            } else {
                d
            }
        };
        write!(f, "#{} [{}] {}", self.index, self.hash, preview)
    }
}

/// Utility: current system timestamp (ms).
pub fn current_timestamp_ms() -> u128 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or_default()
}
