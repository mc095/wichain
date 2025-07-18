// src/components/ChatView.tsx
import React, { useMemo, useRef, useEffect } from 'react';
import type { Blockchain, SignedMessage } from '../lib/api';

interface Props {
  blockchain: Blockchain;
  myPubkeyB64?: string;
  peerFilter?: string | null; // peer id (pubkey string)
}

interface ChatItem {
  key: string;
  from: string;
  text: string;
  ts: number;
  mine: boolean;
}

function extractChatItems(bc: Blockchain, myPub?: string, filter?: string | null): ChatItem[] {
  const items: ChatItem[] = [];
  for (const b of bc.chain) {
    // If payload serialized as JSON inside raw_data we try to parse:
    let added = false;
    try {
      const pd = b.payload ?? JSON.parse(b.raw_data);
      // if messages
      if (pd?.messages) {
        for (const m of pd.messages as SignedMessage[]) {
          if (filter && m.from !== filter && m.to !== filter) continue;
          items.push({
            key: `${b.index}:${m.id}`,
            from: m.from,
            text: m.content,
            ts: m.timestamp_ms ?? b.timestamp_ms,
            mine: myPub ? m.from === myPub : false,
          });
        }
        added = true;
      } else if (pd?.text) {
        if (!filter) {
          items.push({
            key: `${b.index}:text`,
            from: b.hash.slice(0, 8),
            text: pd.text as string,
            ts: b.timestamp_ms,
            mine: false,
          });
        }
        added = true;
      }
    } catch {
      /* fallthrough */
    }

    if (!added) {
      // fallback: show raw_data only if no filter
      if (!filter && b.raw_data) {
        items.push({
          key: `${b.index}:raw`,
          from: b.hash.slice(0, 8),
          text: b.raw_data,
          ts: b.timestamp_ms,
          mine: false,
        });
      }
    }
  }
  // sort by timestamp
  items.sort((a, b) => a.ts - b.ts);
  return items;
}

export const ChatView: React.FC<Props> = ({ blockchain, myPubkeyB64, peerFilter }) => {
  const chatItems = useMemo(
    () => extractChatItems(blockchain, myPubkeyB64, peerFilter),
    [blockchain, myPubkeyB64, peerFilter]
  );

  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatItems.length]);

  return (
    <div className="chat-view">
      {chatItems.map((c) => (
        <div
          key={c.key}
          className={`chat-msg ${c.mine ? 'mine' : 'theirs'}`}
          title={new Date(c.ts).toLocaleString()}
        >
          {!c.mine && <div className="chat-from">{c.from.slice(0, 10)}…</div>}
          <div className="chat-bubble">{c.text}</div>
        </div>
      ))}
      <div ref={endRef} />
    </div>
  );
};
