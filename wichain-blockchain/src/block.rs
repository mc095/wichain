//! Block type used in the WiChain local ledger.
//!
//! ## Backward compatibility
//!
//! Older WiChain prototypes serialized blocks like:
//!
//! ```json
//! {
//!   "index": 2,
//!   "timestamp_ms": 1752847723210,
//!   "previous_hash": "...",
//!   "nonce": 0,
//!   "data": "hello",
//!   "hash": "..."
//! }
//! ```
//!
//! The `data` field was an *opaque UTF‑8 string*. Newer code (for
//! peer‑to‑peer direct messaging) stores structured JSON in that same `data`
//! field. Two supported structured payloads today:
//!
//! 1. **Signed messages array** – JSON array of `SignedMessage`
//! 2. **Direct text payload** – JSON object
//!    ```json
//!    {"direct":{"from":"<b64pub>","to":"<b64pub>","text":"hi","ts":12345}}
//!    ```
//!
//! If parsing either shape fails, callers can always fall back to
//! `Block::raw_data()` (original opaque text).
//!
//! Hash formula (unchanged for compatibility):
//!
//! ```text
//! SHA256(index || timestamp_ms || previous_hash || nonce || data)
//! ```

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fmt;

use wichain_core::SignedMessage;

/// A single block in the chain.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Block {
    pub index: u64,
    pub timestamp_ms: u128,
    pub previous_hash: String,
    pub nonce: u64,
    pub data: String,
    pub hash: String,
}

/// Structured "direct text" payload decoded from `data` JSON.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DirectTextPayload {
    pub from: String,
    pub to: String,
    pub text: String,
    #[serde(default)]
    pub ts: u128,
}

impl Block {
    /// General constructor; caller supplies *opaque* `data` string.
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

    /// Convenience: create a legacy **text** block.
    pub fn new_text(
        index: u64,
        timestamp_ms: u128,
        previous_hash: String,
        text: impl Into<String>,
    ) -> Self {
        Self::new(index, timestamp_ms, previous_hash, 0, text.into())
    }

    /// Convenience: create a block containing **one signed message** (JSON array len=1).
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

    /// NEW: create a block with a **direct text JSON payload** (single chat message).
    ///
    /// Shape:
    /// ```json
    /// {"direct":{"from":"...","to":"...","text":"...","ts":123}}
    /// ```
    pub fn new_direct(
        index: u64,
        timestamp_ms: u128,
        previous_hash: String,
        from: &str,
        to: &str,
        text: &str,
    ) -> Self {
        let payload = serde_json::json!({
            "direct": {
                "from": from,
                "to": to,
                "text": text,
                "ts": timestamp_ms
            }
        });
        Self::new(index, timestamp_ms, previous_hash, 0, payload.to_string())
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
    /// Returns `None` if `data` is not valid JSON array OR elements fail to deserialize.
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

    /// Attempt to parse **direct text** payload JSON.
    ///
    /// Handles both current structured JSON and a legacy inline encoding used
    /// briefly in development: `@peer:<to>:::<text>`.
    pub fn as_direct_text(&self) -> Option<DirectTextPayload> {
        // Fast path: JSON object?
        if self.data.starts_with('{') {
            // try nested {"direct":{...}} form
            #[derive(Deserialize)]
            struct Wrapper {
                direct: DirectTextPayload,
            }
            if let Ok(w) = serde_json::from_str::<Wrapper>(&self.data) {
                return Some(w.direct);
            }
            // try bare DirectTextPayload
            if let Ok(dt) = serde_json::from_str::<DirectTextPayload>(&self.data) {
                return Some(dt);
            }
        }

        // Legacy encoding: "@peer:<to>:::<text>"
        const PREFIX: &str = "@peer:";
        if let Some(rest) = self.data.strip_prefix(PREFIX) {
            if let Some((to, text)) = rest.split_once(":::") {
                return Some(DirectTextPayload {
                    from: String::new(), // unknown
                    to: to.to_string(),
                    text: text.to_string(),
                    ts: self.timestamp_ms,
                });
            }
        }

        None
    }
}

impl fmt::Display for Block {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        // Build a short preview string.
        let preview = if let Some(msgs) = self.as_messages() {
            format!("{} msgs", msgs.len())
        } else if let Some(dt) = self.as_direct_text() {
            format!("direct {}→{}: {}", &dt.from[..dt.from.len().min(6)], &dt.to[..dt.to.len().min(6)], dt.text)
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
