// frontend/src/components/PeerList.tsx
import type { PeerInfo } from '../lib/api';

export interface Props {
  peers: PeerInfo[];
  selected: string | null;  // currently selected peer id
  onSelect: (id: string | null) => void;
}

export function PeerList({ peers, selected, onSelect }: Props) {
  if (!peers.length) {
    return <div className="peer-list empty text-xs text-gray-500 px-2 py-1">No peers found.</div>;
  }

  return (
    <ul className="space-y-1 text-sm">
      {peers.map((p) => {
        const sel = selected === p.id;
        return (
          <li
            key={p.id}
            className={`cursor-pointer rounded px-2 py-1 truncate ${
              sel
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 hover:bg-gray-700 text-gray-200'
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
