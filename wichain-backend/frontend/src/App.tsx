// frontend/src/App.tsx
import { useEffect, useState, useCallback } from 'react';
import {
  apiGetIdentity,
  apiSetAlias,
  apiGetPeers,
  apiGetBlockchain,
  apiSendMessage,
  type Identity,
  type PeerInfo,
  type Blockchain,
} from './lib/api';
import { PeerList } from './components/PeerList';
import { ChatView } from './components/ChatView';
import { AliasModal } from './components/AliasModal';
import { listen } from '@tauri-apps/api/event';
import './App.css';
import './index.css';

export default function App() {
  /* ─ Identity ─ */
  const [identity, setIdentity] = useState<Identity | null>(null);
  useEffect(() => {
    apiGetIdentity().then(setIdentity).catch(console.error);
  }, []);

  /* ─ Peers ─ */
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

  /* ─ Blockchain ─ */
  const [blockchain, setBlockchain] = useState<Blockchain>({ chain: [] });
  const refreshChain = useCallback(() => {
    apiGetBlockchain().then(setBlockchain).catch(console.error);
  }, []);
  useEffect(() => {
    refreshChain();
    const unlistenPromise = listen('chain_update', refreshChain);
    const interval = setInterval(refreshChain, 10_000);
    return () => {
      clearInterval(interval);
      unlistenPromise.then((un) => un());
    };
  }, [refreshChain]);

  /* ─ Selected peer ─ */
  const [selectedPeer, setSelectedPeer] = useState<string | null>(null);

  /* ─ Alias modal ─ */
  const [showAliasModal, setShowAliasModal] = useState(false);
  useEffect(() => {
    if (
      identity &&
      (identity.alias.trim() === '' || identity.alias.startsWith('Anon-'))
    ) {
      setShowAliasModal(true);
    }
  }, [identity]);

  const handleAliasSave = useCallback(
    async (alias: string) => {
      await apiSetAlias(alias);
      const updated = await apiGetIdentity();
      setIdentity(updated);
      setShowAliasModal(false);
      refreshPeers();
    },
    [refreshPeers]
  );

  /* ─ Message entry ─ */
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const send = useCallback(async () => {
    const msg = text.trim();
    if (!msg || !selectedPeer) return;
    setSending(true);
    const ok = await apiSendMessage(selectedPeer, msg);
    setSending(false);
    if (ok) {
      setText('');
      refreshChain();
    }
  }, [text, selectedPeer, refreshChain]);

  const myPub = identity?.public_key_b64 ?? '';

  return (
    <div className="w-full h-screen bg-neutral-950 text-neutral-100 flex flex-col">
      {showAliasModal && (
        <AliasModal
          initialAlias={identity?.alias ?? ''}
          onSave={handleAliasSave}
          onCancel={() => setShowAliasModal(false)}
        />
      )}

      <header className="flex items-center justify-between px-4 py-2 border-b border-neutral-800 bg-neutral-900">
        <h1 className="text-lg font-semibold">WiChain</h1>
        <div className="text-right">
          <div className="font-medium">{identity?.alias ?? '(unknown alias)'}</div>
          <div className="text-xs text-neutral-400">
            {myPub ? myPub.slice(0, 20) + '…' : '(no key)'}
          </div>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        <aside className="w-64 border-r border-neutral-800 overflow-y-auto p-2">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-neutral-300 uppercase tracking-wide">
              Peers
            </h2>
            <button
              className="text-xs text-blue-400 hover:text-blue-300 underline"
              onClick={refreshPeers}
            >
              Refresh
            </button>
          </div>
          <PeerList
            peers={peers}
            selected={selectedPeer}
            onSelect={setSelectedPeer}
            selfId={myPub}
            selfAlias={identity?.alias ?? ''}
          />
        </aside>

        <section className="flex flex-col flex-1 min-h-0">
          <div className="flex items-center justify-between px-4 py-2 border-b border-neutral-800 bg-neutral-900">
            <div className="text-sm text-neutral-400">
              {selectedPeer
                ? `Chat with ${peerAlias(peers, selectedPeer) ?? '(unknown peer)'}`
                : 'Select a peer to chat'}
            </div>
            <button
              className="text-xs text-blue-400 hover:text-blue-300 underline"
              onClick={() => setShowAliasModal(true)}
            >
              Rename
            </button>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-4">
            <ChatView
              blockchain={blockchain}
              myPubkeyB64={myPub}
              peerFilter={selectedPeer}
            />
          </div>

          <div className="flex items-center gap-2 p-3 border-t border-neutral-800 bg-neutral-900">
            <input
              type="text"
              className="flex-1 rounded-md bg-neutral-800 border border-neutral-700 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder={
                selectedPeer ? 'Type a message…' : 'Select a peer to enable chat'
              }
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              disabled={sending || !selectedPeer}
            />
            <button
              className="px-4 py-2 rounded-md text-sm font-medium bg-blue-600 hover:bg-blue-500 disabled:bg-neutral-700 disabled:text-neutral-500"
              onClick={send}
              disabled={sending || !selectedPeer || !text.trim()}
            >
              Send
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

function peerAlias(peers: PeerInfo[], id: string): string | undefined {
  return peers.find((p) => p.id === id)?.alias;
}
