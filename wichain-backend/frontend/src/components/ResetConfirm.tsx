// frontend/src/components/ResetConfirm.tsx
interface Props {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ResetConfirm({ open, onCancel, onConfirm }: Props) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950 bg-opacity-90 text-neutral-100">
      <div className="w-full max-w-sm rounded-xl border border-neutral-700 bg-neutral-900 p-6 text-center">
        <h2 className="mb-2 text-xl font-bold text-red-400">Reset WiChain?</h2>
        <p className="mb-6 text-sm text-neutral-300">
          This deletes your device identity and chat history on this computer.
        </p>
        <div className="flex justify-center gap-4">
          <button
            className="rounded bg-neutral-700 px-4 py-2 text-sm hover:bg-neutral-600"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className="rounded bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500"
            onClick={onConfirm}
          >
            Delete & Restart
          </button>
        </div>
      </div>
    </div>
  );
}
