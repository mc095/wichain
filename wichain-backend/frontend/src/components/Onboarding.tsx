// frontend/src/components/Onboarding.tsx
import { useState } from 'react';

interface Props {
  initialAlias: string;
  onDone: (alias: string) => void;
}

export function Onboarding({ initialAlias, onDone }: Props) {
  const [alias, setAlias] = useState(initialAlias);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="w-80 rounded-lg bg-neutral-900 p-4 shadow-lg">
        <h2 className="mb-2 text-lg font-bold text-emerald-400">Welcome to WiChain</h2>
        <p className="mb-4 text-sm text-neutral-300">
          Choose a device name (alias) other peers will see on your local network.
        </p>
        <input
          autoFocus
          className="mb-4 w-full rounded border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 focus:border-emerald-400 focus:outline-none"
          value={alias}
          onChange={(e) => setAlias(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onDone(alias.trim());
          }}
        />
        <div className="flex justify-end gap-2">
          <button
            className="rounded bg-emerald-600 px-4 py-1 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-40"
            disabled={!alias.trim()}
            onClick={() => onDone(alias.trim())}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
