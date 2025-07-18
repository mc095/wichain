//! WiChain Blockchain crate.
//!
//! Re-exports core types and provides a minimal append‑only ledger that can hold
//! either plain text (legacy) or signed chat messages (preferred).

pub mod block;
pub mod blockchain;

pub use block::{current_timestamp_ms, Block};
pub use blockchain::{Blockchain, BlockSummary, ChainSummary};

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
