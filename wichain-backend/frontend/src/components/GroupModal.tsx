// frontend/src/components/GroupModal.tsx
import { useState, useEffect } from 'react';
import type { PeerInfo } from '../lib/api';

interface Props {
  open: boolean;
  onClose: () => void;
  peers: PeerInfo[];                     // self filtered by parent
  aliasMap: Record<string, string>;
  onCreateGroup: (selectedPeerIds: string[]) => void;
}

export function GroupModal({ open, onClose, peers, onCreateGroup }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) {
      setSelected(new Set());
    }
  }, [open]);

  if (!open) return null;

  function toggle(id: string) {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function confirm() {
    if (selected.size === 0) {
      // allow group with just self? We'll require at least one peer.
      alert('Select at least one peer.');
      return;
    }
    onCreateGroup(Array.from(selected));
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-sm rounded-lg bg-neutral-900 p-4 shadow-xl">
        <h2 className="mb-3 text-base font-semibold text-emerald-400">
          New Group
        </h2>
        <div className="mb-4 max-h-48 overflow-y-auto">
          {peers.length === 0 && (
            <div className="py-2 text-sm text-neutral-500">
              No peers available to add.
            </div>
          )}
          <ul className="space-y-1">
            {peers.map((p) => (
              <li key={p.id}>
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-emerald-500"
                    checked={selected.has(p.id)}
                    onChange={() => toggle(p.id)}
                  />
                  <span className="truncate">
                    {p.alias || p.id.slice(0, 8) + '…'}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex justify-end gap-2 text-sm">
          <button
            className="rounded bg-neutral-700 px-3 py-1 hover:bg-neutral-600"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="rounded bg-emerald-600 px-3 py-1 font-semibold text-white hover:bg-emerald-500"
            onClick={confirm}
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}
