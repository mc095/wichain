// frontend/src/App.tsx
import { useEffect, useState, useCallback, useMemo } from 'react';
import './App.css';
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
import { ResetConfirm } from './components/ResetConfirm';
import { listen } from '@tauri-apps/api/event';

/* ------------------------------------------------------------------ */
/* Selection model                                                    */
/* ------------------------------------------------------------------ */

type Target =
  | { kind: 'peer'; id: string }
  | { kind: 'group'; id: string }
  | null;

/* ------------------------------------------------------------------ */
/* Component                                                          */
/* ------------------------------------------------------------------ */

export default function App() {
  /* ---------------- Identity ---------------- */
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [onboarding, setOnboarding] = useState(false);

  const loadIdentity = useCallback(async () => {
    const id = await apiGetIdentity();
    setIdentity(id);
    if (id.alias.startsWith('Anon-')) {
      setOnboarding(true);
    }
  }, []);

  useEffect(() => {
    loadIdentity();
  }, [loadIdentity]);

  /* ---------------- Target ---------------- */
  const [target, setTarget] = useState<Target>(null);

  // React to alias changes from backend
  useEffect(() => {
    const un = listen('alias_update', () => {
      console.log('alias_update event');
      loadIdentity();
      refreshGroups(); // update group labels when aliases change
    });
    return () => {
      un.then((f) => f());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------------- Peers ---------------- */
  const [peers, setPeers] = useState<PeerInfo[]>([]);
  const refreshPeers = useCallback(() => {
    apiGetPeers()
      .then((p) => {
        setPeers(p);
        // If selected peer disappeared, clear selection
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

  /* ---------------- Groups ---------------- */
  const [groups, setGroups] = useState<GroupInfo[]>([]);
  const refreshGroups = useCallback(() => {
    apiListGroups()
      .then((gs) => {
        setGroups(gs);
        // If selected group no longer exists, clear
        setTarget((t) =>
          t?.kind === 'group' && !gs.some((g) => g.id === t.id) ? null : t,
        );
      })
      .catch(console.error);
  }, []);

  // initial load and listen for group updates
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

  /* ---------------- Chat History ---------------- */
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

  /* ---------------- Compose / Send ---------------- */
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const send = useCallback(async () => {
    const msg = text.trim();
    if (!msg || !target) {
      console.warn('send(): no message or no target');
      return;
    }
    if (!identity) {
      console.warn('Send aborted: identity not yet loaded.');
      return;
    }
    console.log('send(): sending', { msg, target });
    setSending(true);
    let ok = false;
    if (target.kind === 'peer') {
      ok = await apiAddPeerMessage(msg, target.id);
    } else if (target.kind === 'group') {
      ok = await apiAddGroupMessage(msg, target.id);
    }
    setSending(false);
    if (ok) {
      setText('');
      refreshMessages();
    } else {
      console.warn('Send failed (see backend log).');
    }
  }, [text, target, identity, refreshMessages]);

  /* ---------------- Reset chat only ---------------- */
  const [resetOpen, setResetOpen] = useState(false);
  async function doReset() {
    setResetOpen(false);
    const ok = await apiResetData();
    if (ok) {
      refreshMessages();
    }
  }

  /* ---------------- Onboarding -> save alias ---------------- */
  async function onboardingDone(alias: string) {
    await apiSetAlias(alias);
    setOnboarding(false);
    loadIdentity();
  }

  /* ---------------- Group modal ---------------- */
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

  /* ---------------- Derived maps ---------------- */
  const myPub = identity?.public_key_b64 ?? '';
  const myAlias = identity?.alias ?? '(unknown)';

  /** map pubkey->alias (includes self) */
  const aliasMap = useMemo(() => {
    const m: Record<string, string> = {};
    if (identity) m[identity.public_key_b64] = identity.alias;
    for (const p of peers) {
      m[p.id] = p.alias;
    }
    return m;
  }, [identity, peers]);

  /** Filter out self from displayed peers. */
  const displayedPeers = peers.filter((p) => p.id !== myPub);

  /* ---------------- Derived target label ---------------- */
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

  /* ---------------- Render ---------------- */
  return (
    <div className="flex h-screen flex-col bg-neutral-950 text-neutral-100">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-neutral-800 px-4 py-2">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-bold text-emerald-400">WiChain</h1>
          <span className="text-xs text-neutral-400">
            {myAlias} · {myPub.slice(0, 10)}…
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="rounded bg-neutral-700 px-2 py-1 text-xs hover:bg-neutral-600"
            onClick={openGroupModal}
          >
            New Group
          </button>
          <button
            className="rounded bg-neutral-700 px-2 py-1 text-xs hover:bg-neutral-600"
            onClick={() => setResetOpen(true)}
          >
            Reset Chat
          </button>
        </div>
      </header>

      {/* Main */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 overflow-y-auto border-r border-neutral-800 p-2">
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
        </aside>

        {/* Chat */}
        <section className="flex flex-1 flex-col">
          <ChatView
            messages={messages}
            myPubkeyB64={myPub}
            selectedTarget={target}
            aliasMap={aliasMap}
            groups={groups}
          />
          <div className="flex items-center gap-2 border-t border-neutral-800 p-2">
            <input
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
              className="flex-1 rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-500 focus:border-emerald-400 focus:outline-none"
            />
            <button
              className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
              onClick={send}
              disabled={sending || !text.trim() || !target || !identity}
            >
              Send
            </button>
          </div>
        </section>
      </div>

      {/* Overlays */}
      {onboarding && identity && (
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
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Utilities                                                          */
/* ------------------------------------------------------------------ */

function groupDisplayName(
  g: GroupInfo,
  aliasMap: Record<string, string>,
  myPub: string,
): string {
  // Show up to 3 aliases (excluding self), then "+N".
  const names = g.members
    .filter((m) => m !== myPub)
    .map((m) => aliasMap[m] ?? m.slice(0, 8) + '…');
  if (names.length === 0) return 'Just Me';
  if (names.length === 1) return `You + ${names[0]}`;
  if (names.length === 2) return `${names[0]}, ${names[1]}, You`;
  if (names.length === 3) return `${names[0]}, ${names[1]}, +1`;
  return `${names[0]}, ${names[1]}, +${names.length - 2}`;
}