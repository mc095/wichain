import { motion } from 'framer-motion';
import type { PeerInfo, GroupInfo } from '../lib/api';

type Target =
  | { kind: 'peer'; id: string }
  | { kind: 'group'; id: string }
  | null;

interface Props {
  peers: PeerInfo[];
  groups: GroupInfo[];
  aliasMap: Record<string, string>;
  myPub: string;
  selected: Target;
  onSelectPeer: (peerId: string) => void;
  onSelectGroup: (groupId: string) => void;
}

export function PeerList({
  peers,
  groups,
  aliasMap,
  myPub,
  selected,
  onSelectPeer,
  onSelectGroup,
}: Props) {
  return (
    <div className="flex flex-col gap-6 text-sm">
      <div>
        <h2 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
          Peers
        </h2>
        <ul className="space-y-1">
          {peers.length === 0 && (
            <li className="px-3 py-2 text-xs text-[var(--text-muted)]">No peers yet…</li>
          )}
          {peers.map((p) => {
            const sel = selected?.kind === 'peer' && selected.id === p.id;
            const label = p.alias || p.id.slice(0, 8) + '…';
            return (
              <motion.li
                key={p.id}
                className={`peer-item ${sel ? 'selected' : ''}`}
                whileHover={{ x: 5 }}
                transition={{ duration: 0.2 }}
              >
                <button
                  className="flex w-full items-center gap-3"
                  onClick={() => onSelectPeer(p.id)}
                  title={label}
                >
                  <div className="avatar">{label.charAt(0).toUpperCase()}</div>
                  <span className="truncate">{label}</span>
                </button>
              </motion.li>
            );
          })}
        </ul>
      </div>

      <div>
        <h2 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
          Groups
        </h2>
        <ul className="space-y-1">
          {groups.length === 0 && (
            <li className="px-3 py-2 text-xs text-[var(--text-muted)]">No groups yet…</li>
          )}
          {groups.map((g) => {
            const sel = selected?.kind === 'group' && selected.id === g.id;
            return (
              <motion.li
                key={g.id}
                className={`group-item ${sel ? 'selected' : ''}`}
                whileHover={{ x: 5 }}
                transition={{ duration: 0.2 }}
              >
                <button
                  className="flex w-full items-center gap-3"
                  onClick={() => onSelectGroup(g.id)}
                  title={groupTooltip(g, aliasMap, myPub)}
                >
                  <div className="avatar">G</div>
                  <span className="truncate">{groupLabel(g, aliasMap, myPub)}</span>
                </button>
              </motion.li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function groupLabel(
  g: GroupInfo,
  aliasMap: Record<string, string>,
  myPub: string,
): string {
  const names = g.members
    .filter((m) => m !== myPub)
    .map((m) => aliasMap[m] ?? m.slice(0, 8) + '…');
  if (names.length === 0) return 'Just Me';
  if (names.length === 1) return `You + ${names[0]}`;
  if (names.length === 2) return `${names[0]}, ${names[1]}, You`;
  if (names.length === 3) return `${names[0]}, ${names[1]}, +1`;
  return `${names[0]}, ${names[1]}, +${names.length - 2}`;
}

function groupTooltip(
  g: GroupInfo,
  aliasMap: Record<string, string>,
  myPub: string,
): string {
  return g.members
    .map((m) =>
      m === myPub
        ? `(you) ${aliasMap[m] ?? m.slice(0, 8) + '…'}`
        : aliasMap[m] ?? m.slice(0, 8) + '…',
    )
    .join(', ');
}