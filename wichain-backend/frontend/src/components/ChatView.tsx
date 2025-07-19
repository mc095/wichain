// frontend/src/components/ChatView.tsx
import React, { useMemo, useRef, useEffect } from 'react';
import type { Blockchain, Block } from '../lib/api';

interface Props {
  blockchain: Blockchain;
  myPubkeyB64?: string;
  peerFilter: string; // required
}

interface ChatItem {
  key: string;
  from: string;
  to?: string | null;
  text: string;
  ts: number;
  mine: boolean;
}

interface CanonPayload {
  from?: string;
  to?: string | null;
  text?: string;
  ts?: number;
}

function parseTaggedText(s: string): { to?: string; text: string } {
  const tag = '@peer:';
  if (s.startsWith(tag)) {
    const rest = s.slice(tag.length);
    const sep = rest.indexOf(':::');
    if (sep >= 0) {
      return { to: rest.slice(0, sep), text: rest.slice(sep + 3) };
    }
  }
  return { text: s };
}

function tryParseJson(s: string | undefined): unknown {
  if (!s) return null;
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}

function itemsFromBlock(b: Block, myPub: string | undefined, peer: string): ChatItem[] {
  const items: ChatItem[] = [];
  const ts = b.timestamp_ms ?? 0;

  // legacy data
  if (typeof b.data === 'string') {
    const tagged = parseTaggedText(b.data);
    if (tagged.to !== peer) return items;
    items.push({
      key: `${b.index}:data`,
      from: b.hash.slice(0, 8),
      to: tagged.to,
      text: tagged.text,
      ts,
      mine: false,
    });
    return items;
  }

  // canonical / raw JSON
  const raw = b.raw_data ?? b.data ?? '';
  const payload = tryParseJson(raw);

  if (typeof payload === 'string') {
    const tagged = parseTaggedText(payload);
    if (tagged.to !== peer) return items;
    items.push({
      key: `${b.index}:rawstr`,
      from: b.hash.slice(0, 8),
      to: tagged.to,
      text: tagged.text,
      ts,
      mine: false,
    });
    return items;
  }

  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const p = payload as CanonPayload;
    const from = p.from ?? b.hash.slice(0, 8);
    const to = p.to ?? null;
    if (to !== peer && from !== peer) return items;
    items.push({
      key: `${b.index}:canon`,
      from,
      to,
      text: p.text ?? '',
      ts: typeof p.ts === 'number' ? p.ts : ts,
      mine: !!myPub && from === myPub,
    });
    return items;
  }

  return items;
}

function extractChatItems(bc: Blockchain, myPub: string | undefined, peer: string): ChatItem[] {
  const list: ChatItem[] = [];
  for (const b of bc.chain) {
    list.push(...itemsFromBlock(b, myPub, peer));
  }
  list.sort((a, b) => a.ts - b.ts);
  return list;
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
    <div className="p-4 space-y-2">
      {chatItems.map((c) => (
        <div
          key={c.key}
          className={`flex ${c.mine ? 'justify-end' : 'justify-start'}`}
          title={new Date(c.ts).toLocaleString()}
        >
          {!c.mine && (
            <div className="mr-2 text-[10px] text-gray-500 self-end max-w-[8rem] truncate">
              {c.from.slice(0, 10)}{c.to ? `→${c.to.slice(0, 6)}…` : ''}
            </div>
          )}
          <div
            className={`px-3 py-2 rounded-lg max-w-[75%] break-words text-sm ${
              c.mine ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-100'
            }`}
          >
            {c.text}
          </div>
        </div>
      ))}
      <div ref={endRef} />
    </div>
  );
};
