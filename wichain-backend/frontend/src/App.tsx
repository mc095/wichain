// frontend/src/App.tsx
import { useEffect, useState, useCallback } from 'react';
import {
  apiGetIdentity,
  apiSetAlias,
  apiGetPeers,
  apiGetBlockchain,
  apiAddMessage,
  type Identity,
  type PeerInfo,
  type Blockchain,
} from './lib/api';
import { PeerList } from './components/PeerList';
import { ChatView } from './components/ChatView';
import { listen } from '@tauri-apps/api/event';
import './App.css'; // legacy; Tailwind utilities imported via index.css

/* --- Alias Modal ---------------------------------------------------------- */
function AliasModal({
  initial,
  onSubmit,
}: {
  initial: string;
  onSubmit: (alias: string) => void;
}) {
  const [val, setVal] = useState(initial);
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 w-80">
        <h2 className="text-lg font-semibold mb-3 text-gray-100">Set Device Name</h2>
        <input
          autoFocus
          type="text"
          className="w-full px-3 py-2 rounded-md bg-gray-800 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="e.g. Laptop-Office"
          value={val}
          onChange={(e) => setVal(e.target.value)}
        />
        <div className="mt-4 flex justify-end gap-2">
          <button
            className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-500 text-sm font-medium disabled:opacity-40"
            disabled={!val.trim()}
            onClick={() => onSubmit(val.trim())}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

/* --- App ------------------------------------------------------------------ */
export default function App() {
  /* Identity */
  const [identity, setIdentity] = useState<Identity | null>(null);
  useEffect(() => {
    apiGetIdentity().then(setIdentity).catch(console.error);
  }, []);

  /* Peers */
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

  /* Blockchain */
  const [blockchain, setBlockchain] = useState<Blockchain>({ chain: [] });
  const refreshChain = useCallback(() => {
    apiGetBlockchain().then(setBlockchain).catch(console.error);
  }, []);
  useEffect(() => {
    refreshChain();
    const unlistenPromise = listen('chain_update', refreshChain);
    const interval = setInterval(refreshChain, 8_000);
    return () => {
      clearInterval(interval);
      unlistenPromise.then((un) => un());
    };
  }, [refreshChain]);

  /* Selected peer (required for chat) */
  const [selectedPeer, setSelectedPeer] = useState<string | null>(null);

  /* Send */
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const send = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      const msg = text.trim();
      if (!msg || !selectedPeer) return;
      setSending(true);
      const ok = await apiAddMessage(msg, selectedPeer);
      setSending(false);
      if (ok) {
        setText('');
        refreshChain();
      }
    },
    [text, selectedPeer, refreshChain]
  );

  /* Alias rename flow */
  const needsAlias =
    identity?.alias?.startsWith('Anon-') ||
    !identity?.alias ||
    identity?.alias.trim() === '';
  const [showAliasModal, setShowAliasModal] = useState(false);
  useEffect(() => {
    if (needsAlias) setShowAliasModal(true);
  }, [needsAlias]);

  const applyAlias = useCallback(
    async (alias: string) => {
      await apiSetAlias(alias);
      const updated = await apiGetIdentity();
      setIdentity(updated);
      setShowAliasModal(false);
      refreshPeers(); // network announce triggered by backend
    },
    [refreshPeers]
  );

  const myPub = identity?.public_key_b64 ?? '';

  return (
    <div className="h-screen w-screen flex flex-col bg-black text-gray-100">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-gray-800">
        <h1 className="text-xl font-semibold text-blue-400">WiChain</h1>
        <div className="flex items-center gap-3">
          <div className="flex flex-col text-xs text-gray-400 text-right">
            <span className="font-medium text-gray-100">{identity?.alias ?? '(unknown alias)'}</span>
            <span className="font-mono">
              {myPub ? myPub.slice(0, 20) + '…' : '(no key)'}
            </span>
          </div>
          <button
            onClick={() => setShowAliasModal(true)}
            className="px-2 py-1 rounded-md bg-gray-800 hover:bg-gray-700 text-xs border border-gray-600"
          >
            Rename
          </button>
        </div>
      </header>

      {/* Main layout */}
      <div className="flex-1 flex min-h-0">
        {/* Sidebar */}
        <aside className="w-56 shrink-0 border-r border-gray-800 p-2 overflow-y-auto">
          <h2 className="text-sm font-semibold mb-2 text-gray-300 uppercase tracking-wide">
            Peers
          </h2>
          <PeerList peers={peers} selected={selectedPeer} onSelect={setSelectedPeer} />
        </aside>

        {/* Chat */}
        <section className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 overflow-y-auto">
            {selectedPeer ? (
              <ChatView
                blockchain={blockchain}
                myPubkeyB64={myPub}
                peerFilter={selectedPeer}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-500">
                Select a peer to start chatting.
              </div>
            )}
          </div>
          {/* Input */}
          <form
            onSubmit={send}
            className="p-2 border-t border-gray-800 flex gap-2"
          >
            <input
              type="text"
              className="flex-1 px-3 py-2 rounded-md bg-gray-800 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={
                selectedPeer ? 'Type message…' : 'Select a peer to enable chat…'
              }
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={sending || !selectedPeer}
            />
            <button
              type="submit"
              disabled={sending || !text.trim() || !selectedPeer}
              className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium"
            >
              Send
            </button>
          </form>
        </section>
      </div>

      {showAliasModal && (
        <AliasModal
          initial={identity?.alias ?? ''}
          onSubmit={applyAlias}
        />
      )}
    </div>
  );
}
