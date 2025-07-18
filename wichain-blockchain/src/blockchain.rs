//! Minimal append‑only blockchain for WiChain.
//!
//! - Genesis block created automatically.
//! - Blocks store opaque `data: String` but helpers allow:
//!   - Legacy text (`add_text_block`)
//!   - Structured signed message arrays (`add_message_block`, `add_messages_block`)
//!   - Direct peer‑to‑peer text payload (`add_direct_text_block`)
//!
//! Validation checks hash links; `validate_deep()` optionally re‑verifies
//! embedded `SignedMessage`s.

use crate::block::{current_timestamp_ms, Block, DirectTextPayload};
use serde::{Deserialize, Serialize};
use std::fs::{self, File};
use std::io::{BufReader, Write};
use std::path::Path;

use wichain_core::SignedMessage;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Blockchain {
    pub chain: Vec<Block>,
}

impl Blockchain {
    /// Create a new chain w/ genesis block.
    pub fn new() -> Self {
        let mut bc = Self { chain: Vec::new() };
        bc.push_genesis();
        bc
    }

    fn push_genesis(&mut self) {
        let genesis = Block::new_text(0, current_timestamp_ms(), "0".into(), "Genesis Block");
        self.chain.push(genesis);
    }

    /// The last block (safe; there is always at least genesis).
    pub fn last_block(&self) -> &Block {
        self.chain.last().expect("chain always has genesis")
    }

    /// Append a **text block** (legacy).
    pub fn add_text_block(&mut self, text: impl Into<String>) -> &Block {
        let prev = self.last_block();
        let b = Block::new_text(
            self.chain.len() as u64,
            current_timestamp_ms(),
            prev.hash.clone(),
            text,
        );
        self.chain.push(b);
        self.chain.last().unwrap()
    }

    /// Append a block containing **one signed message**.
    pub fn add_message_block(&mut self, msg: SignedMessage) -> &Block {
        self.add_messages_block(vec![msg])
    }

    /// Append a block containing **many signed messages**.
    pub fn add_messages_block(&mut self, messages: Vec<SignedMessage>) -> &Block {
        let prev = self.last_block();
        let b = Block::new_messages(
            self.chain.len() as u64,
            current_timestamp_ms(),
            prev.hash.clone(),
            &messages,
        );
        self.chain.push(b);
        self.chain.last().unwrap()
    }

    /// NEW: append a **direct peer‑to‑peer text** block.
    ///
    /// `from` and `to` should be base64 pubkeys (the same strings used as IDs
    /// in the network layer). This is what you'll call when the user selects a
    /// peer in the UI and sends a message.
    pub fn add_direct_text_block(&mut self, from: &str, to: &str, text: &str) -> &Block {
        let prev = self.last_block();
        let b = Block::new_direct(
            self.chain.len() as u64,
            current_timestamp_ms(),
            prev.hash.clone(),
            from,
            to,
            text,
        );
        self.chain.push(b);
        self.chain.last().unwrap()
    }

    /// Helper used when *receiving* a direct message from a peer (identical to `add_direct_text_block` but kept for intent).
    pub fn append_foreign_direct(&mut self, from: &str, to: &str, text: &str) -> &Block {
        self.add_direct_text_block(from, to, text)
    }

    /// Basic integrity check: ensure hash chain is unbroken and hashes recompute.
    pub fn is_valid(&self) -> bool {
        if self.chain.is_empty() {
            return false;
        }
        for i in 1..self.chain.len() {
            let curr = &self.chain[i];
            let prev = &self.chain[i - 1];
            if curr.previous_hash != prev.hash {
                return false;
            }
            if curr.hash != curr.calculate_hash() {
                return false;
            }
        }
        true
    }

    /// Deep validation: also parse/verify embedded signed messages.
    /// Returns `(is_valid_chain, total_msgs, bad_msgs)`.
    pub fn validate_deep(&self) -> (bool, usize, usize) {
        if !self.is_valid() {
            return (false, 0, 0);
        }
        let mut total = 0;
        let mut bad = 0;
        for b in &self.chain {
            if let Some(msgs) = b.as_messages() {
                for m in msgs {
                    total += 1;
                    if !m.verify() {
                        bad += 1;
                    }
                }
            }
        }
        (bad == 0, total, bad)
    }

    /// Save the chain to JSON.
    pub fn save_to_file(&self, path: impl AsRef<Path>) -> anyhow::Result<()> {
        let path = path.as_ref();
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }
        let json = serde_json::to_string_pretty(self)?;
        let mut f = File::create(path)?;
        f.write_all(json.as_bytes())?;
        Ok(())
    }

    /// Load a chain from JSON. If file missing, create new chain.
    pub fn load_from_file(path: impl AsRef<Path>) -> anyhow::Result<Self> {
        let path = path.as_ref();
        if !path.exists() {
            return Ok(Self::new());
        }
        let f = File::open(path)?;
        let r = BufReader::new(f);
        let bc: Self = serde_json::from_reader(r)?;
        Ok(bc)
    }

    /// Return a vector of all **verified** signed messages in the chain.
    pub fn all_verified_messages(&self) -> Vec<SignedMessage> {
        self.chain
            .iter()
            .flat_map(|b| b.verified_messages())
            .collect()
    }

    /// Return a vector of *all* parsed signed messages (no verify).
    pub fn all_messages(&self) -> Vec<SignedMessage> {
        self.chain
            .iter()
            .filter_map(|b| b.as_messages())
            .flatten()
            .collect()
    }

    /// Return all decoded **direct text messages** (local + foreign).
    pub fn all_direct_text(&self) -> Vec<DirectTextPayload> {
        self.chain
            .iter()
            .filter_map(|b| b.as_direct_text())
            .collect()
    }
}

/* ------------------------------------------------------------------------- */
/* UI Summaries                                                              */
/* ------------------------------------------------------------------------- */

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlockSummary {
    pub index: u64,
    pub timestamp_ms: u128,
    pub hash: String,
    pub previous_hash: String,
    pub message_count: usize,
    pub preview: String,
}

impl BlockSummary {
    pub fn from_block(b: &Block, preview_len: usize) -> Self {
        // message array?
        if let Some(msgs) = b.as_messages() {
            let count = msgs.len();
            let preview = if count == 1 {
                msgs[0].content.clone()
            } else {
                format!("{count} messages")
            };
            return Self {
                index: b.index,
                timestamp_ms: b.timestamp_ms,
                hash: b.hash.clone(),
                previous_hash: b.previous_hash.clone(),
                message_count: count,
                preview,
            };
        }

        // direct?
        if let Some(dt) = b.as_direct_text() {
            return Self {
                index: b.index,
                timestamp_ms: b.timestamp_ms,
                hash: b.hash.clone(),
                previous_hash: b.previous_hash.clone(),
                message_count: 1,
                preview: dt.text,
            };
        }

        // raw text fallback
        let raw = b.raw_data();
        let preview = if raw.len() > preview_len {
            format!("{}...", &raw[..preview_len])
        } else {
            raw.to_string()
        };
        Self {
            index: b.index,
            timestamp_ms: b.timestamp_ms,
            hash: b.hash.clone(),
            previous_hash: b.previous_hash.clone(),
            message_count: 0,
            preview,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChainSummary {
    pub blocks: Vec<BlockSummary>,
    pub total_messages: usize,
}

impl ChainSummary {
    pub fn from_chain(chain: &Blockchain) -> Self {
        let mut total = 0;
        let blocks = chain
            .chain
            .iter()
            .map(|b| {
                let bs = BlockSummary::from_block(b, 32);
                total += bs.message_count;
                bs
            })
            .collect();
        Self {
            blocks,
            total_messages: total,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use ed25519_dalek::SigningKey;
    use rand::rngs::OsRng;

    #[test]
    fn test_text_blocks() {
        let mut bc = Blockchain::new();
        bc.add_text_block("First");
        bc.add_text_block("Second");
        assert_eq!(bc.chain.len(), 3); // incl genesis
        assert!(bc.is_valid());
    }

    #[test]
    fn test_message_blocks() {
        let sk = SigningKey::generate(&mut OsRng);
        let msg = SignedMessage::new_now("hi".into(), &sk, None);
        let mut bc = Blockchain::new();
        bc.add_message_block(msg.clone());
        assert!(bc.is_valid());
        let all = bc.all_messages();
        assert_eq!(all.len(), 1);
        assert_eq!(all[0].content, "hi");
    }

    #[test]
    fn test_direct_text_block() {
        let mut bc = Blockchain::new();
        bc.add_direct_text_block("FROM", "TO", "hello");
        assert!(bc.is_valid());
        let d = bc.all_direct_text();
        assert_eq!(d.len(), 1);
        assert_eq!(d[0].text, "hello");
    }

    #[test]
    fn test_tamper_detect() {
        let mut bc = Blockchain::new();
        bc.add_text_block("Original");
        // tamper by editing block data *and* not recomputing hash
        if let Some(b) = bc.chain.get_mut(1) {
            b.data = "Tampered".into();
        }
        assert!(!bc.is_valid());
    }
}
