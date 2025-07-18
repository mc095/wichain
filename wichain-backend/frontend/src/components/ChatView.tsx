// frontend/src/components/ChatView.tsx
import React, { useMemo, useRef, useEffect } from 'react';
import type { Blockchain, SignedMessage, Block } from '../lib/api'; // Ensure Block is imported

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

/* Inline peer tag format: @peer:<id>:::<text> */
function parseTaggedText(s: string): { to?: string; text: string } {
  const tag = '@peer:';
  if (s.startsWith(tag)) {
    const rest = s.slice(tag.length);
    const sep = rest.indexOf(':::');
    if (sep >= 0) {
      return {
        to: rest.slice(0, sep),
        text: rest.slice(sep + 3),
      };
    }
  }
  return { text: s };
}

// Define specific types for the JSON payloads if not already in api.ts
// This helps eliminate 'any' and provides better type safety.
// Adjust these if you have more precise types defined elsewhere.
interface TextMessagePayload {
    Text: string;
}

interface MessagesContainerPayload {
    Messages: SignedMessage[];
}

// Type Guards to safely check payload structures
function isTextMessagePayload(payload: unknown): payload is TextMessagePayload {
    return typeof payload === 'object' && payload !== null && 'Text' in payload && typeof (payload as TextMessagePayload).Text === 'string';
}

function isMessagesContainerPayload(payload: unknown): payload is MessagesContainerPayload {
    return typeof payload === 'object' && payload !== null && 'Messages' in payload && Array.isArray((payload as MessagesContainerPayload).Messages);
}

function extractFromBlock(
  b: Block, // 'b' is now typed as Block, which is good!
  myPub?: string,
  filter?: string | null
): ChatItem[] {
  const items: ChatItem[] = [];
  // Use optional chaining or direct access if 'timestamp_ms' is guaranteed on Block
  const ts = b.timestamp_ms ?? 0; // Removed (b as any), relying on Block type

  // ----- Source A: legacy `data` field -----
  if (typeof b.data === 'string') {
    const tagged = parseTaggedText(b.data);
    if (filter && tagged.to !== filter) return items;
    items.push({
      key: `${b.index}:data`,
      from: b.hash.slice(0, 8),
      to: tagged.to,
      text: tagged.text,
      ts,
      mine: false, // can't know sender
    });
    return items;
  }

  // ----- Source B: raw_data JSON value -----
  let payload: unknown; // Keep as unknown initially
  try {
    payload = JSON.parse(b.raw_data ?? 'null');
  } catch {
    payload = b.raw_data; // Fallback: if parse fails, keep raw_data as is (could be string)
  }

  // string
  if (typeof payload === 'string') {
    const tagged = parseTaggedText(payload);
    if (filter && tagged.to !== filter) return items;
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

  // enum { Text: "..." }
  // Use the type guard here to narrow the type of 'payload'
  if (isTextMessagePayload(payload)) {
    const txt = payload.Text; // 'payload' is now safely 'TextMessagePayload'
    const tagged = parseTaggedText(txt);
    if (filter && tagged.to !== filter) return items;
    items.push({
      key: `${b.index}:TextEnum`,
      from: b.hash.slice(0, 8),
      to: tagged.to,
      text: tagged.text,
      ts,
      mine: false,
    });
    return items;
  }

  // enum { Messages: [...] }
  // Use the type guard here to narrow the type of 'payload'
  if (isMessagesContainerPayload(payload)) {
    const msgs = payload.Messages; // 'payload' is now safely 'MessagesContainerPayload'
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
    return items;
  }

  // fallback: show raw if no peer filter
  if (!filter) {
    items.push({
      key: `${b.index}:fallback`,
      from: b.hash.slice(0, 8),
      text: JSON.stringify(payload),
      ts,
      mine: false,
    });
  }
  return items;
}

function extractChatItems(
  bc: Blockchain,
  myPub?: string,
  filter?: string | null
): ChatItem[] {
  const list: ChatItem[] = [];
  for (const b of bc.chain) {
    list.push(...extractFromBlock(b, myPub, filter));
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