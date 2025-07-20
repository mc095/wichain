// frontend/src/components/PeerList.tsx
import type { PeerInfo } from '../lib/api';

export interface Props {
  peers: PeerInfo[];
  selected: string | null;
  onSelect: (id: string | null) => void;
}

export function PeerList({ peers, selected, onSelect }: Props) {
  if (!peers.length) {
    return (
      <div className="peer-list empty text-xs text-neutral-500 p-2">
        No peers found.
      </div>
    );
  }

  return (
    <ul className="peer-list text-sm space-y-1">
      {peers.map((p) => {
        const sel = selected === p.id;
        return (
          <li
            key={p.id}
            className={`cursor-pointer rounded px-2 py-1 ${
              sel
                ? 'bg-emerald-600 text-white'
                : 'bg-transparent text-neutral-200 hover:bg-neutral-800'
            }`}
            onClick={() => onSelect(sel ? null : p.id)}
            title={p.pubkey}
          >
            {p.alias || p.id.slice(0, 8)}
          </li>
        );
      })}
    </ul>
  );
}
