// frontend/src/components/ChatView.tsx
import React, { useMemo, useRef, useEffect } from 'react';
import type { Blockchain, Block } from '../lib/api';

interface Props {
  blockchain: Blockchain;
  myPubkeyB64?: string;
  peerFilter?: string | null;
}

interface ChatItem {
  key: string;
  from: string;
  to: string;
  text: string;
  ts: number;
  mine: boolean;
}

/* ------------------------------------------------------------------ */
/* Parsing helpers                                                     */
/* ------------------------------------------------------------------ */

interface JsonMsg {
  from?: string;
  to?: string;
  text?: string;
  ts?: number;
}

/* legacy inline tag: @peer:<to>:::<text>  (no from info) */
function parseLegacyTag(s: string): { to?: string; text: string } {
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

/* new canonical payload: JSON string {from,to,text,ts} */
function parsePayload(s: string): { from?: string; to?: string; text: string; ts?: number } {
  try {
    const obj = JSON.parse(s) as JsonMsg;
    if (typeof obj.text === 'string') {
      return { from: obj.from, to: obj.to, text: obj.text, ts: obj.ts };
    }
  } catch {
    /* ignore */
  }
  // fallback legacy
  const leg = parseLegacyTag(s);
  return { from: undefined, to: leg.to, text: leg.text, ts: undefined };
}

/* Convert a block to zero or more chat items (we only ever store one msg/block) */
function itemsFromBlock(
  b: Block,
  myPub?: string,
  filter?: string | null
): ChatItem[] {
  const ts = b.timestamp_ms ?? 0;

  // choose payload source
  const payloadStr =
    typeof b.data === 'string'
      ? b.data
      : typeof b.raw_data === 'string'
      ? b.raw_data
      : '';

  if (!payloadStr) return [];

  const parsed = parsePayload(payloadStr);
  const from = parsed.from ?? b.hash.slice(0, 8);
  const to = parsed.to ?? '';
  const text = parsed.text;
  const msgTs = typeof parsed.ts === 'number' ? parsed.ts : ts;

  // Filter: show only messages where (from==peer || to==peer) if filter provided.
  if (filter) {
    if (from !== filter && to !== filter) return [];
  }

  const mine = !!myPub && from === myPub;
  return [
    {
      key: `${b.index}`,
      from,
      to,
      text,
      ts: msgTs,
      mine,
    },
  ];
}

/* flatten chain */
function extractChatItems(
  bc: Blockchain,
  myPub?: string,
  filter?: string | null
): ChatItem[] {
  const out: ChatItem[] = [];
  for (const b of bc.chain) {
    out.push(...itemsFromBlock(b, myPub, filter));
  }
  out.sort((a, b) => a.ts - b.ts);
  return out;
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */
export const ChatView: React.FC<Props> = ({ blockchain, myPubkeyB64, peerFilter }) => {
  const chatItems = useMemo(
    () => extractChatItems(blockchain, myPubkeyB64, peerFilter),
    [blockchain, myPubkeyB64, peerFilter]
  );

  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatItems.length]);

  if (!peerFilter) {
    return (
      <div className="text-center text-neutral-500 text-sm mt-8">
        Select a peer in the sidebar to start chatting.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {chatItems.map((c) => (
        <div
          key={c.key}
          className={[
            'max-w-xs sm:max-w-md md:max-w-lg lg:max-w-2xl',
            'px-3 py-2 rounded-lg text-sm',
            'whitespace-pre-wrap break-words',
            c.mine
              ? 'ml-auto bg-blue-600 text-neutral-50'
              : 'mr-auto bg-neutral-800 text-neutral-100',
          ].join(' ')}
          title={new Date(c.ts).toLocaleString()}
        >
          {!c.mine && (
            <div className="text-[10px] mb-0.5 text-neutral-400">
              {c.from.slice(0, 10)}…{c.to ? `→${c.to.slice(0, 6)}…` : ''}
            </div>
          )}
          {c.text}
        </div>
      ))}
      <div ref={endRef} />
    </div>
  );
};
