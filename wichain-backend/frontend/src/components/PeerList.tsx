// frontend/src/components/PeerList.tsx
import type { PeerInfo } from '../lib/api';

export interface Props {
  peers: PeerInfo[];
  selected: string | null;
  onSelect: (id: string | null) => void;
  selfId: string;
  selfAlias: string;
}

export function PeerList({ peers, selected, onSelect, selfId, selfAlias }: Props) {
  const handleClick = (id: string) => {
    onSelect(selected === id ? null : id);
  };

  return (
    <ul className="space-y-1 text-sm">
      {/* Self */}
      <li
        key="self"
        className="px-2 py-1 rounded-md bg-neutral-800 text-neutral-300 cursor-default flex items-center gap-2"
        title={selfId}
      >
        <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
        {selfAlias || '(me)'}
      </li>

      {/* Peers */}
      {peers.length === 0 && (
        <li className="px-2 py-1 rounded-md text-neutral-500 italic">
          No peers discovered.
        </li>
      )}
      {peers.map((p) => {
        const sel = selected === p.id;
        return (
          <li
            key={p.id}
            className={[
              'px-2 py-1 rounded-md cursor-pointer flex items-center gap-2',
              sel
                ? 'bg-blue-600 text-neutral-50'
                : 'bg-neutral-800 text-neutral-200 hover:bg-neutral-700',
            ].join(' ')}
            title={p.pubkey}
            onClick={() => handleClick(p.id)}
          >
            <span className="inline-block w-2 h-2 rounded-full bg-blue-400" />
            {p.alias || p.id.slice(0, 8)}
          </li>
        );
      })}
    </ul>
  );
}
