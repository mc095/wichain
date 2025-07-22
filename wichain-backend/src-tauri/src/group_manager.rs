//! Minimal in‑memory group registry used by WiChain.
//!
//! Groups are *ephemeral* (not persisted). A group is identified by a
//! deterministic ID derived from the **sorted list of member pubkeys**.
//!
//! Transport "confidentiality" in the current build is **per‑member SHA3‑512 XOR
//! obfuscation** that happens in `add_group_message` inside `main.rs`; we do *not*
//! derive or store a persistent group key here. We *only* provide:
//!   • deterministic group IDs
//!   • membership tracking for UI / history filtering

use std::collections::HashMap;
use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use sha3::{Digest, Sha3_256};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GroupInfo {
    pub id: String,
    pub members: Vec<String>, // b64 pubkeys (sorted)
}

#[derive(Debug)]
pub struct GroupManager {
    inner: Mutex<HashMap<String, GroupInfo>>,
}

impl GroupManager {
    pub fn new() -> std::sync::Arc<Self> {
        std::sync::Arc::new(Self {
            inner: Mutex::new(HashMap::new()),
        })
    }

    /// Deterministic group id = hex(SHA3_256("gid|" + join(sorted_members,"|"))).
    fn compute_group_id(sorted_members: &[String]) -> String {
        let mut hasher = Sha3_256::new();
        hasher.update(b"gid|");
        let mut first = true;
        for m in sorted_members {
            if !first {
                hasher.update(b"|");
            }
            hasher.update(m.as_bytes());
            first = false;
        }
        let digest = hasher.finalize();
        hex::encode(digest)
    }

    /// Create or return existing group id for `members` (unsorted input OK).
    pub fn create_group(self: &std::sync::Arc<Self>, members: Vec<String>) -> String {
        let mut sorted = members;
        sorted.sort_unstable();
        let gid = Self::compute_group_id(&sorted);
        let mut guard = self.inner.lock().unwrap();
        guard.entry(gid.clone()).or_insert(GroupInfo {
            id: gid.clone(),
            members: sorted.clone(),
        });
        gid
    }

    /// List all local groups.
    pub fn list_groups(&self) -> Vec<GroupInfo> {
        let guard = self.inner.lock().unwrap();
        guard.values().cloned().collect()
    }

    /// Get full group info.
    pub fn get_group(&self, gid: &str) -> Option<GroupInfo> {
        let guard = self.inner.lock().unwrap();
        guard.get(gid).cloned()
    }

    /// Just the member list.
    pub fn get_members(&self, gid: &str) -> Option<Vec<String>> {
        self.get_group(gid).map(|g| g.members)
    }

    /// Membership test.
    pub fn is_member(&self, gid: &str, member: &str) -> bool {
        self.get_group(gid)
            .map(|g| g.members.iter().any(|m| m == member))
            .unwrap_or(false)
    }
}