import { useEffect, useMemo, useRef } from 'react';
import type { ChatPayload } from '../lib/api';

interface Props {
  chat: ChatPayload[];
  myId: string;
  peerFilter: string | null;
}

interface ChatItem {
  key: string;
  from: string;
  to?: string | null;
  text: string;
  ts: number;
  mine: boolean;
}

export function ChatView({ chat, myId, peerFilter }: Props) {
  const items: ChatItem[] = useMemo(() => {
    return chat.map((m, i) => ({
      key: `${i}:${m.ts_ms}`,
      from: m.from,
      to: m.to ?? null,
      text: m.text,
      ts: Number(m.ts_ms),
      mine: m.from === myId,
    }));
  }, [chat, myId]);

  // Scrolling
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [items.length]);

  // If direct peer view, filter again here (defensive)
  const filtered = peerFilter
    ? items.filter(
        (m) =>
          (m.from === peerFilter && (m.to === myId || m.to == null)) ||
          (m.to === peerFilter && m.from === myId)
      )
    : items;

  return (
    <div className="w-full h-full p-3 flex flex-col gap-2">
      {filtered.map((m) => (
        <div
          key={m.key}
          className={`max-w-[70%] px-3 py-2 rounded text-sm ${
            m.mine
              ? 'self-end bg-indigo-600 text-white'
              : 'self-start bg-zinc-800 text-zinc-100'
          }`}
          title={new Date(m.ts).toLocaleString()}
        >
          {!m.mine && peerFilter === null && (
            <div className="text-[10px] text-zinc-400 mb-0.5">
              {m.from.slice(0, 8)}{m.to ? ` → ${m.to.slice(0, 8)}` : ''}
            </div>
          )}
          {m.text}
        </div>
      ))}
      <div ref={endRef} />
    </div>
  );
}
