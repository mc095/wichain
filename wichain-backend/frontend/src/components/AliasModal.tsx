// frontend/src/components/AliasModal.tsx
import { useState } from 'react';

interface Props {
  initialAlias: string;
  onSave: (alias: string) => void | Promise<void>;
  onCancel: () => void;
}

export function AliasModal({ initialAlias, onSave, onCancel }: Props) {
  const [alias, setAlias] = useState(initialAlias);
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!alias.trim()) return;
    setSaving(true);
    await onSave(alias.trim());
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="w-80 rounded-lg bg-neutral-900 border border-neutral-700 p-4 shadow-xl">
        <h2 className="text-lg font-semibold mb-2 text-neutral-100">
          Set Device Name
        </h2>
        <p className="text-xs text-neutral-400 mb-4">
          This name is shown to peers on your local Wi‑Fi.
        </p>
        <input
          type="text"
          className="w-full rounded-md bg-neutral-800 border border-neutral-700 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-blue-500 mb-4"
          placeholder="e.g. Laptop‑A"
          value={alias}
          onChange={(e) => setAlias(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              submit();
            }
          }}
          autoFocus
        />
        <div className="flex justify-end gap-2">
          <button
            className="px-3 py-1 rounded-md text-sm text-neutral-300 hover:text-neutral-100"
            onClick={onCancel}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            className="px-4 py-1 rounded-md text-sm font-medium bg-blue-600 hover:bg-blue-500 disabled:bg-neutral-700 disabled:text-neutral-500"
            onClick={submit}
            disabled={saving || !alias.trim()}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
