//! Minimal in‑memory group registry used by WiChain.
//!
//! Groups are *ephemeral* (not persisted). A group is identified by a
//! deterministic ID derived from the **sorted list of member pubkeys**.
//! That same sorted member list is also used to derive the **group AES key**.
//!
//! Because we include the `group_members` list in every encrypted group
//! payload, a receiving node can decrypt even if it never explicitly
//! registered the group locally (stateless decrypt). The registry is mainly
//! used so *we* (the local node) can offer group selection UI and filter
//! history.

use std::collections::HashMap;
use std::sync::Mutex;

use aes_gcm::{Aes256Gcm, Key};
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

    /// Deterministic group id = hex(SHA3_256("gid|" + join(sorted_members,"|")))
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

    /// Derive AES key from sorted member list (same bytes as id input, but no prefix).
    pub fn compute_group_aes_key(sorted_members: &[String]) -> Key<Aes256Gcm> {
        let mut hasher = Sha3_256::new();
        let mut first = true;
        for m in sorted_members {
            if !first {
                hasher.update(b"|");
            }
            hasher.update(m.as_bytes());
            first = false;
        }
        let digest = hasher.finalize();
        Key::<Aes256Gcm>::from_slice(&digest[..32]).clone()
    }

    /// Create or return existing group id for `members`.
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
