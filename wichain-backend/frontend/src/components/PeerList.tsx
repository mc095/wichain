// frontend/src/components/PeerList.tsx
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
    <div className="flex flex-col gap-4 text-sm">
      {/* Peers */}
      <div>
        <h2 className="mb-1 px-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Peers
        </h2>
        <ul className="space-y-0.5">
          {peers.length === 0 && (
            <li className="px-2 py-1 text-xs text-neutral-500">No peers yet…</li>
          )}
          {peers.map((p) => {
            const sel = selected?.kind === 'peer' && selected.id === p.id;
            const label = p.alias || p.id.slice(0, 8) + '…';
            return (
              <li key={p.id}>
                <button
                  className={`w-full truncate rounded px-2 py-1 text-left transition-colors ${
                    sel
                      ? 'bg-emerald-600 text-white'
                      : 'bg-neutral-800 text-neutral-100 hover:bg-neutral-700'
                  }`}
                  onClick={() => onSelectPeer(p.id)}
                  title={label}
                >
                  {label}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Groups */}
      <div>
        <h2 className="mb-1 px-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Groups
        </h2>
        <ul className="space-y-0.5">
          {groups.length === 0 && (
            <li className="px-2 py-1 text-xs text-neutral-500">No groups yet…</li>
          )}
          {groups.map((g) => {
            const sel = selected?.kind === 'group' && selected.id === g.id;
            return (
              <li key={g.id}>
                <button
                  className={`w-full truncate rounded px-2 py-1 text-left transition-colors ${
                    sel
                      ? 'bg-emerald-600 text-white'
                      : 'bg-neutral-800 text-neutral-100 hover:bg-neutral-700'
                  }`}
                  onClick={() => onSelectGroup(g.id)}
                  title={groupTooltip(g, aliasMap, myPub)}
                >
                  {groupLabel(g, aliasMap, myPub)}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

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
