// frontend/src/components/ChatView.tsx
import { useMemo, useRef, useEffect } from 'react';
import type { Blockchain, Block, ChatBody } from '../lib/api';

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

// Define an interface for the expected structure of the parsed JSON object
interface ChatSignedPartial {
  from?: string;
  to?: string | null;
  text?: string;
  ts_ms?: number;
}

/** Parse a block's JSON string into ChatBody (best effort). */
function parseBody(data: string, fallbackTs: number): ChatBody {
  try {
    // ChatSigned is flattened; we only care about from/to/text/ts_ms fields.
    const obj: ChatSignedPartial = JSON.parse(data); // Specify the type here
    const from = typeof obj.from === 'string' ? obj.from : 'unknown';
    const to =
      typeof obj.to === 'string'
        ? obj.to
        : obj.to === null || obj.to === undefined
        ? null
        : undefined;
    const text = typeof obj.text === 'string' ? obj.text : data;
    const ts_ms =
      typeof obj.ts_ms === 'number' ? obj.ts_ms : fallbackTs;
    return { from, to, text, ts_ms };
  } catch {
    return {
      from: 'unknown',
      to: null,
      text: data,
      ts_ms: fallbackTs,
    };
  }
}

/** Pull chat item from pseudo‑block; returns empty if not in the current peer filter. */
function itemsFromBlock(
  b: Block,
  myPub?: string,
  filter?: string | null
): ChatItem[] {
  const out: ChatItem[] = [];
  const ts = b.timestamp_ms ?? 0;
  if (!b.data) return out;
  const body = parseBody(b.data, ts);

  // Filter: only show convo between me and selected peer.
  if (filter) {
    const isMyOutgoing = body.from === myPub && body.to === filter;
    const isMyIncoming = body.from === filter && body.to === myPub;
    if (!isMyOutgoing && !isMyIncoming) {
      return out;
    }
  }

  out.push({
    key: `${b.index}:${b.hash ?? b.timestamp_ms}`,
    from: body.from,
    to: body.to ?? null,
    text: body.text,
    ts: body.ts_ms ?? ts,
    mine: !!myPub && body.from === myPub,
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
/* Component                                                          */
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

  if (!peerFilter) {
    return (
      <div className="flex flex-1 items-center justify-center text-neutral-500">
        Select a peer to start chatting.
      </div>
    );
  }

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