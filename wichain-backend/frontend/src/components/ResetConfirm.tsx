// frontend/src/components/ResetConfirm.tsx
interface Props {
  open: boolean;
  what?: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ResetConfirm({ open, what, onCancel, onConfirm }: Props) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="w-80 rounded-lg bg-neutral-900 p-4 shadow-lg">
        <h2 className="mb-2 text-lg font-bold text-red-400">Clear Chat History</h2>
        <p className="mb-4 text-sm text-neutral-300">
          {what ?? 'This will delete all local chat history. Your device identity will be kept.'}
        </p>
        <div className="flex justify-end gap-2">
          <button
            className="rounded bg-neutral-700 px-4 py-1 text-sm hover:bg-neutral-600"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className="rounded bg-red-600 px-4 py-1 text-sm font-semibold text-white hover:bg-red-500"
            onClick={onConfirm}
          >
            Clear
          </button>
        </div>
      </div>
    </div>
  );
}
