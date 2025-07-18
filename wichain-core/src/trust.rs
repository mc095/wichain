//! Local peer trust scoring.
//!
//! WiChain does **not** use global consensus trust. Each node locally tracks
//! peers it has seen, last seen time, and a bounded 0‑100 trust score that
//! increases when valid signed data is received and decays with inactivity.
//!
//! Use [`TrustManager::snapshot()`] to produce a UI‑friendly vector of
//! serializable peer trust records.

use std::collections::HashMap;
use std::time::{Duration, Instant};
use serde::{Serialize, Deserialize};

/// Internal representation of a peer tracked for trust.
#[derive(Debug, Clone)]
pub struct Peer {
    pub id: String,          // stable peer ID (we use base64 pubkey for now)
    pub alias: String,       // human alias (best effort / untrusted)
    pub public_key: String,  // base64 pubkey (string form for convenience)
    pub trust_score: f64,    // 0..100
    pub last_seen: Instant,
}

impl Peer {
    pub fn new(id: String, alias: String, public_key: String) -> Self {
        Self {
            id,
            alias,
            public_key,
            trust_score: 50.0, // neutral starting trust
            last_seen: Instant::now(),
        }
    }
}

/// Serializable snapshot for UI / Tauri (since `Instant` isn’t serializable).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PeerTrustSnapshot {
    pub id: String,
    pub alias: String,
    pub public_key: String,
    pub trust_score: f64,
    /// Seconds since last seen (approx).
    pub last_seen_secs: f64,
}

pub struct TrustManager {
    peers: HashMap<String, Peer>, // keyed by peer id
    decay_rate_per_hour: f64,     // trust points lost per hour of inactivity
    drop_after: Duration,         // remove peer if unseen this long
}

impl TrustManager {
    pub fn new(decay_rate_per_hour: f64) -> Self {
        Self {
            peers: HashMap::new(),
            decay_rate_per_hour,
            drop_after: Duration::from_secs(24 * 3600), // default 24h retention
        }
    }

    /// Set how long to keep unseen peers before purging.
    pub fn set_drop_after(&mut self, dur: Duration) {
        self.drop_after = dur;
    }

    /// Upsert peer (used when a hello/presence msg arrives).
    pub fn upsert_peer(&mut self, id: String, alias: String, public_key: String) {
        match self.peers.get_mut(&id) {
            Some(p) => {
                // update alias/public_key if changed, refresh last_seen
                p.alias = alias;
                p.public_key = public_key;
                p.last_seen = Instant::now();
            }
            None => {
                self.peers.insert(id.clone(), Peer::new(id, alias, public_key));
            }
        }
    }

    /// Adjust trust by `delta` (positive = reward, negative = penalty).
    pub fn update_trust(&mut self, id: &str, delta: f64) {
        if let Some(peer) = self.peers.get_mut(id) {
            peer.trust_score = (peer.trust_score + delta).clamp(0.0, 100.0);
            peer.last_seen = Instant::now();
        }
    }

    /// Called periodically (or before snapshot) to decay inactive peers.
    pub fn decay_trust(&mut self) {
        let now = Instant::now();
        self.peers.retain(|_, peer| {
            let elapsed = now.duration_since(peer.last_seen);
            if elapsed > self.drop_after {
                // drop stale peer
                return false;
            }
            let hours = elapsed.as_secs_f64() / 3600.0;
            let decay = self.decay_rate_per_hour * hours;
            peer.trust_score = (peer.trust_score - decay).clamp(0.0, 100.0);
            true
        });
    }

    /// Retrieve trust score (before decay).
    pub fn get_score(&self, id: &str) -> Option<f64> {
        self.peers.get(id).map(|p| p.trust_score)
    }

    /// Produce a UI‑friendly serializable list.
    pub fn snapshot(&mut self) -> Vec<PeerTrustSnapshot> {
        self.decay_trust(); // ensure fresh
        let now = Instant::now();
        self.peers
            .values()
            .map(|p| PeerTrustSnapshot {
                id: p.id.clone(),
                alias: p.alias.clone(),
                public_key: p.public_key.clone(),
                trust_score: p.trust_score,
                last_seen_secs: now.duration_since(p.last_seen).as_secs_f64(),
            })
            .collect()
    }

    /// Iterator over internal (non‑serializable) peers (debug/testing).
    pub fn peers(&self) -> impl Iterator<Item = &Peer> {
        self.peers.values()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn add_and_get_score() {
        let mut tm = TrustManager::new(1.0);
        tm.upsert_peer("peer1".into(), "Alice".into(), "pubkey1".into());
        assert_eq!(tm.get_score("peer1"), Some(50.0));
    }

    #[test]
    fn update_trust_positive_negative() {
        let mut tm = TrustManager::new(1.0);
        tm.upsert_peer("peer1".into(), "Alice".into(), "pubkey1".into());
        tm.update_trust("peer1", 20.0);
        assert_eq!(tm.get_score("peer1"), Some(70.0));
        tm.update_trust("peer1", -80.0);
        assert_eq!(tm.get_score("peer1"), Some(0.0));
    }

    #[test]
    fn decay_over_time() {
        let mut tm = TrustManager::new(10.0); // 10 points per hour
        tm.upsert_peer("peer1".into(), "Alice".into(), "pubkey1".into());

        // manually simulate elapsed by mutating peer Instant
        // (not ideal in prod but fine in test)
        let peer = tm.peers.get_mut("peer1").unwrap();
        peer.last_seen -= Duration::from_secs(3600); // 1 hour ago

        tm.decay_trust();
        let s = tm.get_score("peer1").unwrap();
        assert!((s - 40.0).abs() < 1e-6, "Expected ~40, got {}", s);
    }

    #[test]
    fn snapshot_serializable() {
        let mut tm = TrustManager::new(0.0);
        tm.upsert_peer("peer1".into(), "Alice".into(), "pk1".into());
        let snap = tm.snapshot();
        assert_eq!(snap.len(), 1);
        assert_eq!(snap[0].alias, "Alice");
    }
}
