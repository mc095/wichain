// frontend/src/App.tsx
import { useEffect, useState, useCallback } from 'react';
import './App.css';
import {
  apiGetIdentity,
  apiGetPeers,
  apiGetBlockchain,
  apiAddMessage,
  apiSetAlias,
  apiResetData,
  type Identity,
  type PeerInfo,
  type Blockchain,
} from './lib/api';
import { PeerList } from './components/PeerList';
import { ChatView } from './components/ChatView';
import { Onboarding } from './components/Onboarding';
import { ResetConfirm } from './components/ResetConfirm';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';

export default function App() {
  /* ---------------- Identity ---------------- */
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [onboarding, setOnboarding] = useState(false);

  const loadIdentity = useCallback(async () => {
    const id = await apiGetIdentity();
    setIdentity(id);
    if (id.alias.startsWith('Anon-')) {
      // first run; show onboarding wizard
      setOnboarding(true);
    }
  }, []);

  useEffect(() => {
    loadIdentity();
  }, [loadIdentity]);

  // React to alias changes from backend
  useEffect(() => {
    const un = listen('alias_update', loadIdentity);
    return () => {
      un.then((f) => f());
    };
  }, [loadIdentity]);

  /* ---------------- Peers ---------------- */
  const [peers, setPeers] = useState<PeerInfo[]>([]);
  const refreshPeers = useCallback(() => {
    apiGetPeers().then(setPeers).catch(console.error);
  }, []);
  useEffect(() => {
    refreshPeers();
    const unlistenPromise = listen('peer_update', refreshPeers);
    const interval = setInterval(refreshPeers, 5_000);
    return () => {
      clearInterval(interval);
      unlistenPromise.then((un) => un());
    };
  }, [refreshPeers]);

  /* ---------------- Blockchain / Chat ---------------- */
  const [blockchain, setBlockchain] = useState<Blockchain>({ chain: [] });
  const refreshChain = useCallback(() => {
    apiGetBlockchain().then(setBlockchain).catch(console.error);
  }, []);
  useEffect(() => {
    refreshChain();
    const unlistenPromise = listen('chat_update', refreshChain);
    const interval = setInterval(refreshChain, 5_000); // tighter since per-message
    return () => {
      clearInterval(interval);
      unlistenPromise.then((un) => un());
    };
  }, [refreshChain]);

  // Listen for reset_done event and refresh identity/blockchain
  useEffect(() => {
    const unlisten = listen('reset_done', async () => {
      const newId = await apiGetIdentity();
      setIdentity(newId);
      const newChain = await apiGetBlockchain();
      setBlockchain(newChain);
    });
    return () => { unlisten.then((f) => f()); };
  }, []); // Empty dependency array as it only needs to set up the listener once


  /* ---------------- Selected peer ---------------- */
  const [selectedPeer, setSelectedPeer] = useState<string | null>(null);

  /* ---------------- Compose / Send ---------------- */
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
      refreshChain(); // optimistic
    }
  }, [text, selectedPeer, refreshChain]);

  /* ---------------- Reset data ---------------- */
  const [resetOpen, setResetOpen] = useState(false);
  async function doReset() {
    setResetOpen(false);
    const ok = await apiResetData();
    if (ok) {
      // reload the app; new identity will be generated
      const current = getCurrentWindow();
      await current.hide();
      window.location.reload();
    }
  }

  /* ---------------- Onboarding -> save alias ---------------- */
  async function onboardingDone(alias: string) {
    await apiSetAlias(alias);
    setOnboarding(false);
    loadIdentity();
  }

  const myPub = identity?.public_key_b64 ?? '';
  const myAlias = identity?.alias ?? '(unknown)';

  // Remove self from displayed peers
  const displayedPeers = peers.filter((p) => p.id !== myPub);

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
            onClick={() => setResetOpen(true)}
          >
            Reset Data
          </button>
        </div>
      </header>

      {/* Main */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-52 border-r border-neutral-800 p-2">
          <PeerList
            peers={displayedPeers}
            selected={selectedPeer}
            onSelect={setSelectedPeer}
            // onFindPeers={refreshPeers} // This prop is not defined in PeerList component
          />
        </aside>

        {/* Chat */}
        <section className="flex flex-1 flex-col">
          <ChatView
            blockchain={blockchain}
            myPubkeyB64={myPub}
            peerFilter={selectedPeer}
          />
          <div className="flex items-center gap-2 border-t border-neutral-800 p-2">
            <input
              type="text"
              placeholder={
                selectedPeer ? 'Message peer…' : 'Message everyone on LAN…'
              }
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              disabled={sending}
              className="flex-1 rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-500 focus:border-emerald-400 focus:outline-none"
            />
            <button
              className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
              onClick={send}
              disabled={sending || !text.trim()}
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
      />
    </div>
  );
}