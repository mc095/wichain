// frontend/src/App.tsx
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  apiGetIdentity,
  apiSetAlias,
  apiGetPeers,
  apiAddMessage,
  apiGetChatHistory,
  apiResetData,
  type Identity,
  type PeerInfo,
  type ChatPayload,
} from './lib/api';

import { listen } from '@tauri-apps/api/event';

import { HeaderBar } from './components/HeaderBar';
import { OnboardingWizard } from './components/OnboardingWizard';
import { PeerList } from './components/PeerList';
import { ChatView } from './components/ChatView';

import './index.css'; // tailwind base + overrides
import './App.css';   // minimal extras

export default function App() {
  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [peers, setPeers] = useState<PeerInfo[]>([]);
  const [chat, setChat] = useState<ChatPayload[]>([]);
  const [selectedPeer, setSelectedPeer] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [aliasEditOpen, setAliasEditOpen] = useState(false);

  // ---------------------------------------------------------------------------
  // Initial load
  // ---------------------------------------------------------------------------
  useEffect(() => {
    (async () => {
      const id = await apiGetIdentity();
      setIdentity(id);
      if (!id.alias || id.alias.startsWith('Anon-')) {
        setShowOnboarding(true);
      }
    })();
  }, []);

  // ---------------------------------------------------------------------------
  // Peer refresh & subscriptions
  // ---------------------------------------------------------------------------
  const refreshPeers = useCallback(async () => {
    const p = await apiGetPeers();
    setPeers(p);
  }, []);

  useEffect(() => {
    refreshPeers(); // initial
    const unlistenPromise = listen('peer_update', () => {
      refreshPeers();
    });
    const interval = setInterval(refreshPeers, 5_000);
    return () => {
      clearInterval(interval);
      unlistenPromise.then((un) => un());
    };
  }, [refreshPeers]);

  // ---------------------------------------------------------------------------
  // Chat refresh & subscriptions
  // ---------------------------------------------------------------------------
  const refreshChat = useCallback(async () => {
    const msgs = await apiGetChatHistory();
    setChat(msgs);
  }, []);

  useEffect(() => {
    refreshChat();
    const unlistenPromise = listen('chat_update', () => {
      refreshChat();
    });
    const interval = setInterval(refreshChat, 10_000);
    return () => {
      clearInterval(interval);
      unlistenPromise.then((un) => un());
    };
  }, [refreshChat]);

  // Alias changed on backend (after set_alias or reset)
  useEffect(() => {
    const unlistenPromise = listen('alias_update', async () => {
      const id = await apiGetIdentity();
      setIdentity(id);
    });
    return () => {
      unlistenPromise.then((un) => un());
    };
  }, []);

  // Reset done -> reload identity & chat, then show onboarding again
  useEffect(() => {
    const unlistenPromise = listen('reset_done', async () => {
      const id = await apiGetIdentity();
      setIdentity(id);
      setChat([]);
      setPeers([]);
      setShowOnboarding(true);
    });
    return () => {
      unlistenPromise.then((un) => un());
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Derived: current alias & my id
  // ---------------------------------------------------------------------------
  const myPub = identity?.public_key_b64 ?? '';
  const myAlias = identity?.alias ?? '(unknown)';

  // ---------------------------------------------------------------------------
  // Send message
  // ---------------------------------------------------------------------------
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const send = useCallback(async () => {
    const msg = text.trim();
    if (!msg) return;
    setSending(true);
    const ok = await apiAddMessage(msg, selectedPeer);
    setSending(false);
    if (ok) {
      setText('');
      refreshChat(); // optimistic
    }
  }, [text, selectedPeer, refreshChat]);

  // ---------------------------------------------------------------------------
  // Apply alias (used from onboarding & header rename)
  // ---------------------------------------------------------------------------
  const applyAlias = useCallback(
    async (alias: string) => {
      await apiSetAlias(alias);
      const id = await apiGetIdentity();
      setIdentity(id);
      setAliasEditOpen(false);
      setShowOnboarding(false);
    },
    []
  );

  // ---------------------------------------------------------------------------
  // Reset data (header menu)
  // ---------------------------------------------------------------------------
  const doReset = useCallback(async () => {
    if (!confirm('This will delete your local identity and chat history. Continue?')) {
      return;
    }
    await apiResetData();
    const id = await apiGetIdentity();
    setIdentity(id);
    setChat([]);
    setPeers([]);
    setSelectedPeer(null);
    setShowOnboarding(true);
  }, []);

  // ---------------------------------------------------------------------------
  // Filter chat for current view
  // ---------------------------------------------------------------------------
  const filteredChat = useMemo(() => {
    if (!selectedPeer) return chat; // group view
    return chat.filter(
      (m) =>
        (m.to === selectedPeer && m.from === myPub) ||
        (m.from === selectedPeer && (m.to === myPub || m.to === null)),
    );
  }, [chat, selectedPeer, myPub]);
  
  const displayedPeers = peers.filter((p) => p.id !== myPub);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  if (showOnboarding && identity) {
    return (
      <OnboardingWizard
        initialAlias={identity.alias}
        onAliasSave={applyAlias}
        onDone={() => setShowOnboarding(false)}
        onDiscoverPeers={refreshPeers}
      />
    );
  }

  return (
    <div className="h-full w-full flex flex-col bg-zinc-950 text-zinc-100">
      <HeaderBar
        alias={myAlias}
        myId={myPub}
        onRename={() => setAliasEditOpen(true)}
        onReset={doReset}
      />

      {/* rename inline modal */}
      {aliasEditOpen && identity && (
        <OnboardingWizard
          initialAlias={identity.alias}
          soloRenameMode
          onAliasSave={applyAlias}
          onDone={() => setAliasEditOpen(false)}
          onDiscoverPeers={() => {}}
        />
      )}

      <div className="flex-1 flex overflow-hidden">
        <aside className="w-64 border-r border-zinc-800 overflow-y-auto p-2">
          
          <PeerList peers={displayedPeers} selected={selectedPeer} onSelect={setSelectedPeer} />
        </aside>

        <main className="flex-1 flex flex-col">
          <div className="flex-1 overflow-y-auto">
            <ChatView
              chat={filteredChat}
              myId={myPub}
              peerFilter={selectedPeer}
            />
          </div>

          <div className="p-2 border-t border-zinc-800 flex gap-2">
            <input
              type="text"
              className="flex-1 rounded bg-zinc-800 text-zinc-100 px-3 py-2 outline-none focus:ring focus:ring-indigo-500/40"
              placeholder={selectedPeer ? 'Message peer…' : 'Message everyone…'}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              disabled={sending}
            />
            <button
              className="px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50"
              disabled={sending || !text.trim()}
              onClick={send}
            >
              Send
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}
