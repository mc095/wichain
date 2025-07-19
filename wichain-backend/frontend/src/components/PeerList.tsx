// frontend/src/components/PeerList.tsx
import type { PeerInfo } from '../lib/api';

export interface Props {
  peers: PeerInfo[];
  selected: string | null;
  onSelect: (id: string | null) => void;
  onFindPeers?: () => void;
}

export function PeerList({ peers, selected, onSelect, onFindPeers }: Props) {
  return (
    <div className="peer-list flex h-full flex-col">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-neutral-200">Peers</h3>
        {onFindPeers && (
          <button
            className="rounded bg-neutral-700 px-2 py-1 text-xs text-neutral-100 hover:bg-neutral-600"
            onClick={onFindPeers}
          >
            Find Peers
          </button>
        )}
      </div>
      {peers.length === 0 ? (
        <div className="mt-4 text-xs text-neutral-500">No peers found.</div>
      ) : (
        <ul className="flex-1 overflow-y-auto text-sm">
          {peers.map((p) => {
            const sel = selected === p.id;
            return (
              <li
                key={p.id}
                className={`cursor-pointer rounded px-2 py-1 ${
                  sel ? 'bg-emerald-600 text-white' : 'hover:bg-neutral-700'
                }`}
                onClick={() => onSelect(sel ? null : p.id)}
                title={p.pubkey}
              >
                {p.alias || p.id.slice(0, 8)}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
