// frontend/src/components/ChatView.tsx
import React, { useMemo, useRef, useEffect } from 'react';
import type { Blockchain, Block, SignedMessage } from '../lib/api'; // Make sure Block is also imported if it's defined in api.ts

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

/* Try to interpret our inline peer tag format: @peer:<id>:::<text> */
function parseTaggedText(s: string): { to?: string; text: string } {
  const tag = '@peer:';
  if (s.startsWith(tag)) {
    const rest = s.slice(tag.length);
    const sep = rest.indexOf(':::');
    if (sep >= 0) {
      const id = rest.slice(0, sep);
      const txt = rest.slice(sep + 3);
      return { to: id, text: txt };
    }
  }
  return { text: s };
}

// Define the expected structures for your payloads
// You might already have these defined in '../lib/api' or elsewhere.
// If not, you'd define them here or in a types file.


interface TextPayload {
  Text: string;
}

interface MessagesPayload {
  Messages: SignedMessage[];
}

// Helper type guard functions for narrowing types
function isTextPayload(payload: unknown): payload is TextPayload {
  return typeof payload === 'object' && payload !== null && 'Text' in payload;
}

function isMessagesPayload(payload: unknown): payload is MessagesPayload {
  return typeof payload === 'object' && payload !== null && 'Messages' in payload && Array.isArray((payload as MessagesPayload).Messages);
}

function extractChatItems(bc: Blockchain, myPub?: string, filter?: string | null): ChatItem[] {
  const items: ChatItem[] = [];
  for (const b of bc.chain) {
    // Attempt to get timestamp_ms directly from the block if available,
    // otherwise default to 0. Casting to 'Block' type here assuming
    // Blockchain.chain contains 'Block' type objects.
    const ts = (b as Block)?.timestamp_ms ?? 0;

    let payload: unknown = undefined;
    try {
      payload = JSON.parse(b.raw_data);
    } catch {
      payload = b.raw_data;
    }

    /* Case A: payload is plain string */
    if (typeof payload === 'string') {
      const tagged = parseTaggedText(payload);
      // filter check
      if (filter && tagged.to !== filter) continue;
      items.push({
        key: `${b.index}:txt`,
        from: b.hash.slice(0, 8), // unknown sender in legacy; show block hash
        to: tagged.to,
        text: tagged.text,
        ts,
        mine: false, // legacy broadcast unknown
      });
      continue;
    }

    /* Case B: payload enum { Text: "..."} */
    if (isTextPayload(payload)) { // Use type guard here
      const txt = payload.Text; // Now `payload` is correctly typed as `TextPayload`
      const tagged = parseTaggedText(txt);
      if (filter && tagged.to !== filter) continue;
      items.push({
        key: `${b.index}:TxtEnum`,
        from: b.hash.slice(0, 8),
        to: tagged.to,
        text: tagged.text,
        ts,
        mine: false,
      });
      continue;
    }

    /* Case C: payload enum { Messages: [...] } */
    if (isMessagesPayload(payload)) { // Use type guard here
      const msgs = payload.Messages; // Now `payload` is correctly typed as `MessagesPayload`
      for (const m of msgs) {
        if (filter && m.from !== filter && m.to !== filter) continue;
        items.push({
          key: `${b.index}:${m.id}`,
          from: m.from,
          to: m.to ?? undefined,
          text: m.content,
          ts: m.timestamp_ms ?? ts,
          mine: !!myPub && m.from === myPub,
        });
      }
      continue;
    }

    /* Fallback: show raw */
    if (!filter) {
      items.push({
        key: `${b.index}:raw`,
        from: b.hash.slice(0, 8),
        text: JSON.stringify(payload),
        ts,
        mine: false,
      });
    }
  }

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
          {!c.mine && (
            <div className="chat-from">
              {c.from.slice(0, 10)}…{c.to ? `→${c.to.slice(0, 6)}…` : ''}
            </div>
          )}
          <div className="chat-bubble">{c.text}</div>
        </div>
      ))}
      <div ref={endRef} />
    </div>
  );
};