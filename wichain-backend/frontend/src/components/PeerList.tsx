// frontend/src/components/PeerList.tsx
import type { PeerInfo } from '../lib/api';

export interface Props {
  peers: PeerInfo[];
  selected: string | null;
  onSelect: (id: string | null) => void;
}

export function PeerList({ peers, selected, onSelect }: Props) {
  if (!peers.length) {
    return <div className="peer-list empty">No peers.</div>;
  }

  return (
    <ul className="peer-list">
      {peers.map((p) => {
        const sel = selected === p.id;
        return (
          <li
            key={p.id}
            className={sel ? 'sel' : ''}
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
