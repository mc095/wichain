import { useMemo, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import type { ChatBody, GroupInfo } from '../lib/api';

type Target =
  | { kind: 'peer'; id: string }
  | { kind: 'group'; id: string }
  | null;

interface Props {
  messages: ChatBody[];
  myPubkeyB64?: string;
  selectedTarget: Target;
  aliasMap: Record<string, string>;
  groups: GroupInfo[];
}

interface ChatItem {
  key: string;
  from: string;
  fromAlias: string;
  to?: string | null;
  text: string;
  ts: number;
  mine: boolean;
  isGroup: boolean;
}

function messageMatchesTarget(
  m: ChatBody,
  myPub: string,
  target: Target,
  groups: GroupInfo[],
): boolean {
  if (!target) return false;
  if (!myPub) return false;
  if (target.kind === 'peer') {
    const peer = target.id;
    return (
      (m.from === myPub && m.to === peer) ||
      (m.from === peer && m.to === myPub)
    );
  } else {
    const gid = target.id;
    if (m.to !== gid) return false;
    const g = groups.find((gr) => gr.id === gid);
    if (!g) return false;
    return g.members.includes(myPub);
  }
}

function buildItems(
  messages: ChatBody[],
  myPub: string,
  target: Target,
  aliasMap: Record<string, string>,
  groups: GroupInfo[],
): ChatItem[] {
  if (!myPub) return [];
  const filtered = messages.filter((m) =>
    messageMatchesTarget(m, myPub, target, groups),
  );
  filtered.sort((a, b) => a.ts_ms - b.ts_ms);
  return filtered.map((m, idx) => {
    const mine = m.from === myPub;
    const fromAlias = aliasMap[m.from] ?? m.from.slice(0, 10) + '…';
    const isGroup =
      !!m.to && groups.some((g) => g.id === m.to && g.members.includes(myPub));
    return {
      key: `${idx}:${m.ts_ms}`,
      from: m.from,
      fromAlias,
      to: m.to ?? null,
      text: m.text,
      ts: m.ts_ms,
      mine,
      isGroup,
    };
  });
}

export function ChatView({
  messages,
  myPubkeyB64,
  selectedTarget,
  aliasMap,
  groups,
}: Props) {
  const safeMyPub = myPubkeyB64 ?? '';
  const chatItems = useMemo(
    () => buildItems(messages, safeMyPub, selectedTarget, aliasMap, groups),
    [messages, safeMyPub, selectedTarget, aliasMap, groups],
  );

  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatItems.length]);

  if (!selectedTarget) {
    return (
      <div className="flex flex-1 items-center justify-center text-[var(--text-muted)] text-lg">
        Select a peer or group to start chatting
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-[var(--background)] scrollbar-none" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
      {/* Hide scrollbar for Webkit browsers */}
      <style>{`.scrollbar-none::-webkit-scrollbar { display: none; }`}</style>
      {chatItems.map((c) => (
        <motion.div
          key={c.key}
          className={`mb-4 flex w-full ${c.mine ? 'justify-end' : 'justify-start'}`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="flex items-start gap-3 max-w-[70%]">
            {!c.mine && (
              <div className="avatar">{c.fromAlias.charAt(0).toUpperCase()}</div>
            )}
            <div
              className={`message-bubble ${c.mine ? 'message-mine' : 'message-other'}`}
            >
              {(c.isGroup || !c.mine) && (
                <div className="mb-1 text-xs text-[var(--text-muted)]">
                  {c.fromAlias}
                  {c.isGroup ? ' · Group' : ''}
                </div>
              )}
              <p>{c.text}</p>
              <div className="mt-1 text-xs text-[var(--text-muted)] opacity-70">
                {new Date(c.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        </motion.div>
      ))}
      <div ref={endRef} />
    </div>
  );
}