// frontend/src/components/ChatView.tsx
import { useMemo, useRef, useEffect } from 'react';
import type { ChatBody, GroupInfo } from '../lib/api';

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

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

/** Flattened UI item */
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

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/** True if this message belongs in the selected conversation. */
function messageMatchesTarget(
  m: ChatBody,
  myPub: string,
  target: Target,
  groups: GroupInfo[],
): boolean {
  if (!target) return false;
  if (!myPub) return false; // cannot match without identity

  if (target.kind === 'peer') {
    const peer = target.id;
    // one-to-one: either direction
    return (
      (m.from === myPub && m.to === peer) ||
      (m.from === peer && m.to === myPub)
    );
  } else {
    // group
    const gid = target.id;
    // group messages have `to = gid`
    if (m.to !== gid) return false;
    // sanity: ensure we are a member of gid
    const g = groups.find((gr) => gr.id === gid);
    if (!g) return false;
    if (!g.members.includes(myPub)) return false;
    return true;
  }
}

/** Convert ChatBody[] -> ChatItem[] filtered & sorted. */
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

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function ChatView({
  messages,
  myPubkeyB64,
  selectedTarget,
  aliasMap,
  groups,
}: Props) {
  // If identity not yet loaded, nothing meaningful to show.
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
      <div className="flex flex-1 items-center justify-center text-neutral-500">
        Select a peer or group to start chatting.
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
            {/* In group chats, always show sender alias. In peer chats, show only if not mine. */}
            {(c.isGroup || !c.mine) && (
              <div className="mb-0.5 text-xs opacity-80">
                {c.fromAlias}
                {c.isGroup ? ' · grp' : ''}
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
