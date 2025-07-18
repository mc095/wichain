// frontend/src/App.tsx
import { useEffect, useState, useCallback } from 'react';
import './App.css';
import {
  apiGetIdentity,
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

export default function App() {
  //
  // ── Identity (load once) ───────────────────────────────────────────────
  //
  const [identity, setIdentity] = useState<Identity | null>(null);
  useEffect(() => {
    apiGetIdentity()
      .then((id) => setIdentity(id))
      .catch(console.error);
  }, []);

  //
  // ── Peers (event + poll) ───────────────────────────────────────────────
  //
  const [peers, setPeers] = useState<PeerInfo[]>([]);
  const refreshPeers = useCallback(() => {
    apiGetPeers()
      .then((p) => setPeers(p))
      .catch(console.error);
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

  //
  // ── Blockchain (event + poll) ──────────────────────────────────────────
  //
  const [blockchain, setBlockchain] = useState<Blockchain>({ chain: [] });
  const refreshChain = useCallback(() => {
    apiGetBlockchain()
      .then((bc) => setBlockchain(bc))
      .catch(console.error);
  }, []);
  useEffect(() => {
    refreshChain(); // initial
    const unlistenPromise = listen('chain_update', () => {
      refreshChain();
    });
    const interval = setInterval(refreshChain, 10_000);
    return () => {
      clearInterval(interval);
      unlistenPromise.then((un) => un());
    };
  }, [refreshChain]);

  //
  // ── Selected peer (optional filter) ─────────────────────────────────────
  //
  const [selectedPeer, setSelectedPeer] = useState<string | null>(null);

  //
  // ── Sending messages ───────────────────────────────────────────────────
  //
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const send = useCallback(async () => {
    const msg = text.trim();
    if (!msg) return;
    setSending(true);
    const ok = await apiAddMessage(msg);
    setSending(false);
    if (ok) {
      setText('');
      refreshChain(); // optimistic
    }
  }, [text, refreshChain]);

  //
  // ── Render ─────────────────────────────────────────────────────────────
  //
  const myPub = identity?.public_key ?? ''; // matches backend StoredIdentity

  return (
    <div className="app-root">
      <header className="app-header">
        <h1>WiChain</h1>
        <div className="id-box">
          <div className="id-alias">{identity?.alias ?? '(unknown alias)'}</div>
          <div className="id-key">{myPub ? myPub.slice(0, 20) + '…' : '(no key)'}</div>
        </div>
      </header>

      <div className="app-main">
        <aside className="sidebar">
          <h2>Peers</h2>
          <PeerList peers={peers} selected={selectedPeer} onSelect={setSelectedPeer} />
        </aside>

        <section className="chat-section">
          <ChatView
            blockchain={blockchain}
            myPubkeyB64={myPub}
            peerFilter={selectedPeer}
          />
          <div className="chat-input-row">
            <input
              type="text"
              placeholder="Type message…"
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
            <button onClick={send} disabled={sending || !text.trim()}>
              Send
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
