import type { PeerInfo } from '../lib/api';

interface Props {
  peers: PeerInfo[];
  selected: string | null;
  onSelect: (id: string | null) => void;
}

export function PeerList({ peers, selected, onSelect }: Props) {
  return (
    <div className="w-full text-sm">
      <div
        className={`cursor-pointer px-2 py-1 rounded mb-1 ${
          selected === null ? 'bg-indigo-600 text-white' : 'hover:bg-zinc-800'
        }`}
        onClick={() => onSelect(null)}
      >
        All Devices
      </div>
      {peers.map((p) => {
        const sel = selected === p.id;
        return (
          <div
            key={p.id}
            className={`cursor-pointer px-2 py-1 rounded mb-1 ${
              sel ? 'bg-indigo-600 text-white' : 'hover:bg-zinc-800'
            }`}
            onClick={() => onSelect(sel ? null : p.id)}
            title={p.pubkey}
          >
            {p.alias || p.id.slice(0, 8)}
          </div>
        );
      })}
    </div>
  );
}
