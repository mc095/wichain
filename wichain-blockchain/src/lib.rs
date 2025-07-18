//! WiChain Blockchain crate.
//!
//! Provides a *very* lightweight append‑only ledger used by the WiChain demo.
//! Blocks contain an opaque `data: String`; helper constructors let higher‑level
//! code embed structured chat payloads (serialized `SignedMessage`s) or plain
//! text. The chain is validated by hash linking; apps may perform deeper
//! validation (e.g., verifying embedded signatures).
//!
//! Re‑exports the public surface from the `block` and `blockchain` modules.

pub mod block;
pub mod blockchain;

pub use block::{current_timestamp_ms, Block};
pub use blockchain::{BlockSummary, Blockchain, ChainSummary};

#[cfg(test)]
mod tests {
    use super::*;
    use ed25519_dalek::SigningKey;
    use rand::rngs::OsRng;
    use wichain_core::SignedMessage;

    #[test]
    fn add_text_and_message_blocks() {
        let mut bc = Blockchain::new();
        bc.add_text_block("Hello");
        let sk = SigningKey::generate(&mut OsRng);
        let sm = SignedMessage::new_now("Hi from signed msg".into(), &sk, None);
        bc.add_message_block(sm);
        assert!(bc.is_valid());
        assert!(!bc.all_messages().is_empty());
    }
}
