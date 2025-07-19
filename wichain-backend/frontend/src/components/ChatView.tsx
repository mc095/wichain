// frontend/src/components/ChatView.tsx
import { useMemo, useRef, useEffect } from 'react';
import type { Blockchain, Block, ChatPayloadV1 } from '../lib/api';

interface Props {
  blockchain: Blockchain;
  myPubkeyB64?: string;
  peerFilter?: string | null;
}

interface ChatItem {
  key: string;
  from: string;
  to?: string | null;
  text: string;
  ts: number;
  mine: boolean;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Parse a block's string payload into ChatPayloadV1 (best effort). */
function parsePayload(data: string, fallbackTs: number): ChatPayloadV1 {
  // Preferred: JSON ChatPayloadV1
  try {
    const p = JSON.parse(data) as Partial<ChatPayloadV1>;
    if (p && typeof p.text === 'string' && typeof p.from === 'string') {
      return {
        from: p.from,
        to: p.to ?? null,
        text: p.text,
        ts_ms: p.ts_ms ?? fallbackTs,
      };
    }
  } catch {
    /* ignore */
  }

  // Legacy inline tag: @peer:<id>:::<text>
  const tag = '@peer:';
  if (data.startsWith(tag)) {
    const rest = data.slice(tag.length);
    const sep = rest.indexOf(':::');
    if (sep >= 0) {
      return {
        from: 'unknown',
        to: rest.slice(0, sep),
        text: rest.slice(sep + 3),
        ts_ms: fallbackTs,
      };
    }
  }

  // Plain broadcast text fallback
  return {
    from: 'unknown',
    to: null,
    text: data,
    ts_ms: fallbackTs,
  };
}

/** Pull chat items out of one pseudo‑block. */
function itemsFromBlock(
  b: Block,
  myPub?: string,
  filter?: string | null
): ChatItem[] {
  const out: ChatItem[] = [];
  const ts = b.timestamp_ms ?? 0;
  const raw = b.data ?? b.raw_data ?? '';
  if (!raw) return out;

  const payload = parsePayload(raw, ts);
  if (filter) {
    if (payload.to !== filter && payload.from !== filter) {
      return out;
    }
  }

  out.push({
    key: `${b.index}:${b.hash ?? b.timestamp_ms}`,
    from: payload.from,
    to: payload.to ?? null,
    text: payload.text,
    ts: payload.ts_ms ?? ts,
    mine: !!myPub && payload.from === myPub,
  });
  return out;
}

/** Flatten all blocks into a sorted chat transcript. */
function extractChatItems(
  bc: Blockchain,
  myPub?: string,
  filter?: string | null
): ChatItem[] {
  const list: ChatItem[] = [];
  for (const b of bc.chain) {
    list.push(...itemsFromBlock(b, myPub, filter));
  }
  list.sort((a, b) => a.ts - b.ts);
  return list;
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function ChatView({ blockchain, myPubkeyB64, peerFilter }: Props) {
  const chatItems = useMemo(
    () => extractChatItems(blockchain, myPubkeyB64, peerFilter),
    [blockchain, myPubkeyB64, peerFilter]
  );

  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatItems.length]);

  return (
    <div className="chat-view flex-1 overflow-y-auto p-4">
      {chatItems.map((c) => (
        <div
          key={c.key}
          className={`mb-2 flex w-full ${c.mine ? 'justify-end' : 'justify-start'}`}
        >
          <div
            className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
              c.mine
                ? 'bg-emerald-600 text-white'
                : 'bg-neutral-700 text-neutral-100'
            }`}
            title={new Date(c.ts).toLocaleString()}
          >
            {!c.mine && (
              <div className="mb-0.5 text-xs opacity-80">
                {c.from.slice(0, 10)}…
                {c.to ? `→${c.to.slice(0, 8)}…` : ''}
              </div>
            )}
            {c.text}
          </div>
        </div>
      ))}
      <div ref={endRef} />
    </div>
  );
}
