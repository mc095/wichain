import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  apiGetIdentity,
  apiSetAlias,
  apiGetPeers,
  apiGetChatHistory,
  apiAddPeerMessage,
  apiAddGroupMessage,
  apiResetData,
  apiCreateGroup,
  apiListGroups,
  type Identity,
  type PeerInfo,
  type ChatBody,
  type GroupInfo,
} from './lib/api';
import { PeerList } from './components/PeerList';
import { ChatView } from './components/ChatView';
import { GroupModal } from './components/GroupModal';
import { Onboarding } from './components/Onboarding';
import { OnboardingSlideshow } from './components/OnboardingSlideShow';
import { ResetConfirm } from './components/ResetConfirm';
import { listen } from '@tauri-apps/api/event';
import { exit } from '@tauri-apps/plugin-process';
import { motion } from 'framer-motion';

type Target =
  | { kind: 'peer'; id: string }
  | { kind: 'group'; id: string }
  | null;

export default function App() {
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [showSlideshow, setShowSlideshow] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [imageB64, setImageB64] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const loadIdentity = useCallback(async () => {
    const id = await apiGetIdentity();
    setIdentity(id);
    if (id.alias.startsWith('Anon-')) {
      setShowSlideshow(true);
    }
  }, []);

  useEffect(() => {
    loadIdentity();
  }, [loadIdentity]);

  // Groups
  const [groups, setGroups] = useState<GroupInfo[]>([]);
  const refreshGroups = useCallback(() => {
    apiListGroups()
      .then((gs) => {
        setGroups(gs);
        setTarget((t) =>
          t?.kind === 'group' && !gs.some((g) => g.id === t.id) ? null : t,
        );
      })
      .catch(console.error);
  }, []);

  const [target, setTarget] = useState<Target>(null);

  useEffect(() => {
    const un = listen('alias_update', () => {
      console.log('alias_update event');
      loadIdentity();
      refreshGroups();
    });
    return () => {
      un.then((f) => f());
    };
  }, [loadIdentity, refreshGroups]);

  // Peers
  const [peers, setPeers] = useState<PeerInfo[]>([]);
  const refreshPeers = useCallback(() => {
    apiGetPeers()
      .then((p) => {
        setPeers(p);
        setTarget((t) =>
          t?.kind === 'peer' && !p.some((peer) => peer.id === t.id) ? null : t,
        );
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    refreshPeers();
    const unlistenPromise = listen('peer_update', () => {
      console.log('peer_update event');
      refreshPeers();
    });
    const interval = setInterval(refreshPeers, 5_000);
    return () => {
      clearInterval(interval);
      unlistenPromise.then((un) => un());
    };
  }, [refreshPeers]);

  // Groups effect
  useEffect(() => {
    refreshGroups();
    const unlistenPromise = listen('group_update', () => {
      console.log('group_update event');
      refreshGroups();
    });
    return () => {
      unlistenPromise.then((un) => un());
    };
  }, [refreshGroups]);

  // Chat History
  const [messages, setMessages] = useState<ChatBody[]>([]);
  const refreshMessages = useCallback(() => {
    apiGetChatHistory().then(setMessages).catch(console.error);
  }, []);
  useEffect(() => {
    refreshMessages();
    const unlistenPromise = listen('chat_update', () => {
      console.log('chat_update event');
      refreshMessages();
    });
    const interval = setInterval(refreshMessages, 10_000);
    return () => {
      clearInterval(interval);
      unlistenPromise.then((un) => un());
    };
  }, [refreshMessages]);

  // Compose / Send
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const send = useCallback(async () => {
    const msg = text.trim();
    if ((!msg && !imageB64) || !target) {
      console.warn('send(): no message, no image, or no target');
      return;
    }
    if (!identity) {
      console.warn('Send aborted: identity not yet loaded.');
      return;
    }
    console.log('Send function: imageB64 length =', imageB64 ? imageB64.length : 0);
    // Debug log for outgoing payload
    console.log('Sending payload:', { msg, imageB64 });
    setSending(true);
    let ok = false;
    if (target.kind === 'peer') {
      ok = await apiAddPeerMessage(msg, target.id, imageB64 ?? null);
    } else if (target.kind === 'group') {
      ok = await apiAddGroupMessage(msg, target.id, imageB64 ?? null);
    }
    setSending(false);
    if (ok) {
      setText('');
      setImageB64(null);
      setImagePreview(null);
      refreshMessages();
    } else {
      console.warn('Send failed (see backend log).');
    }
  }, [text, target, identity, refreshMessages, imageB64]);

  // Handle file input change
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 16 * 1024) {
      alert('Image too large (max 16KB)');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      let base64: string;
      if (result.startsWith('data:')) {
        const parts = result.split(',');
        base64 = parts.length > 1 ? parts[1] : parts[0];
      } else {
        base64 = result;
      }
      if (!base64 || base64.length < 10) {
        alert('Failed to read image data.');
        setImageB64(null);
        setImagePreview(null);
        return;
      }
      console.log('File input handler: imageB64 length =', base64.length);
      setImageB64(base64);
      setImagePreview(result);
    };
    reader.readAsDataURL(file);
  };

  // Reset chat
  const [resetOpen, setResetOpen] = useState(false);
  async function doReset() {
    setResetOpen(false);
    const ok = await apiResetData();
    if (ok) {
      refreshMessages();
    }
  }

  // Onboarding
  async function onboardingDone(alias: string) {
    await apiSetAlias(alias);
    setShowOnboarding(false);
    setShowSlideshow(false);
    loadIdentity();
  }

  // Group modal
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const openGroupModal = () => setGroupModalOpen(true);
  const closeGroupModal = () => setGroupModalOpen(false);
  const createGroup = async (memberIds: string[]) => {
    const myPub = identity?.public_key_b64;
    if (!myPub) return;
    const full = Array.from(new Set([myPub, ...memberIds]));
    const gid = await apiCreateGroup(full);
    if (gid) {
      await refreshGroups();
      setTarget({ kind: 'group', id: gid });
    }
  };

  // Exit application
  const exitApp = async () => {
    try {
      await exit(0);
    } catch (error) {
      console.error('Failed to exit application:', error);
    }
  };

  // Derived data
  const myPub = identity?.public_key_b64 ?? '';
  const myAlias = identity?.alias ?? '(unknown)';

  const aliasMap = useMemo(() => {
    const m: Record<string, string> = {};
    if (identity) m[identity.public_key_b64] = identity.alias;
    for (const p of peers) {
      m[p.id] = p.alias;
    }
    return m;
  }, [identity, peers]);

  const displayedPeers = peers.filter((p) => p.id !== myPub);

  const targetLabel = (() => {
    if (!target) return 'Select a peer or group…';
    if (target.kind === 'peer') {
      return aliasMap[target.id] ?? target.id.slice(0, 8) + '…';
    } else {
      const g = groups.find((gr) => gr.id === target.id);
      if (!g) return 'Group?';
      return groupDisplayName(g, aliasMap, myPub);
    }
  })();

  // Render
  if (showSlideshow && identity) {
    return (
      <OnboardingSlideshow
        onGetStarted={() => {
          setShowSlideshow(false);
          setShowOnboarding(true);
        }}
      />
    );
  }

  return (
    <motion.div
      className="flex h-screen flex-col bg-[var(--background)] text-[var(--foreground)]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <header className="header">
        <div className="flex items-center gap-4">
          <motion.button
            className="p-2 text-[var(--foreground)] hover:text-[var(--primary)]"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </motion.button>
          <h1 className="text-2xl font-bold text-[var(--primary)]">WiChain</h1>
          <span className="text-sm text-[var(--text-muted)]">{myAlias}</span>
        </div>
        <div className="flex items-center gap-3">
          <motion.button
            className="rounded-lg bg-[var(--primary-dark)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--primary)]"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={openGroupModal}
          >
            New Group
          </motion.button>
          <motion.button
            className="rounded-lg bg-[var(--primary-dark)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--primary)]"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setResetOpen(true)}
          >
            Reset Chat
          </motion.button>
          <motion.button
            className="exit-button"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={exitApp}
          >
            Exit
          </motion.button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <motion.aside
          className="sidebar"
          initial={{ width: sidebarOpen ? '18rem' : '0' }}
          animate={{ width: sidebarOpen ? '18rem' : '0' }}
          transition={{ duration: 0.3 }}
        >
          {sidebarOpen && (
            <PeerList
              peers={displayedPeers}
              groups={groups}
              aliasMap={aliasMap}
              myPub={myPub}
              selected={target}
              onSelectPeer={(id) => {
                console.log('Peer selected:', id);
                setTarget({ kind: 'peer', id });
              }}
              onSelectGroup={(id) => {
                console.log('Group selected:', id);
                setTarget({ kind: 'group', id });
              }}
            />
          )}
        </motion.aside>

        <section className="flex flex-1 flex-col">
          <ChatView
            messages={messages}
            myPubkeyB64={myPub}
            selectedTarget={target}
            aliasMap={aliasMap}
            groups={groups}
          />
          <div className="input-container flex flex-col gap-2">
            {imagePreview && (
              <div className="mb-2 flex items-center gap-2">
                <img src={imagePreview} alt="preview" className="max-h-24 rounded border" />
                <button
                  className="text-xs text-red-500 underline"
                  onClick={() => { setImageB64(null); setImagePreview(null); }}
                >
                  Remove
                </button>
              </div>
            )}
            <div className="flex gap-2">
              <motion.input
                type="text"
                placeholder={target ? targetLabel : 'Select a peer or group to start'}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                disabled={sending || !target || !identity}
                className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--neutral)] px-4 py-3 text-sm text-[var(--foreground)] placeholder-[var(--text-muted)] focus:border-[var(--primary)] focus:outline-none"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
              />
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                disabled={sending || !target || !identity}
                className="file-input"
                style={{ display: 'none' }}
                id="image-upload-input"
              />
              <label htmlFor="image-upload-input" className="cursor-pointer px-2 py-2 bg-[var(--primary-dark)] text-white rounded-lg hover:bg-[var(--primary)] text-sm flex items-center">
                📷
              </label>
              <motion.button
                className="rounded-lg bg-[var(--primary-dark)] px-4 py-3 text-sm font-semibold text-white hover:bg-[var(--primary)] disabled:opacity-50"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={send}
                disabled={sending || (!text.trim() && !imageB64) || !target || !identity}
              >
                Send
              </motion.button>
            </div>
          </div>
        </section>
      </div>

      {showOnboarding && identity && (
        <Onboarding initialAlias={identity.alias} onDone={onboardingDone} />
      )}
      <ResetConfirm
        open={resetOpen}
        onCancel={() => setResetOpen(false)}
        onConfirm={doReset}
        label="Reset Chat"
        body="This will clear your local chat history. Your device identity will be preserved."
      />
      <GroupModal
        open={groupModalOpen}
        onClose={closeGroupModal}
        peers={displayedPeers}
        aliasMap={aliasMap}
        onCreateGroup={createGroup}
      />
    </motion.div>
  );
}

function groupDisplayName(
  g: GroupInfo,
  aliasMap: Record<string, string>,
  myPub: string,
): string {
  const names = g.members
    .filter((m) => m !== myPub)
    .map((m) => aliasMap[m] ?? m.slice(0, 8) + '…');
  if (names.length === 0) return 'Just Me';
  if (names.length === 1) return `You + ${names[0]}`;
  if (names.length === 2) return `${names[0]}, ${names[1]}, You`;
  if (names.length === 3) return `${names[0]}, ${names[1]}, +1`;
  return `${names[0]}, ${names[1]}, +${names.length - 2}`;
}