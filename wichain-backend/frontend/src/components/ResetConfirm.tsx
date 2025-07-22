  // frontend/src/components/ResetConfirm.tsx
  interface Props {
    open: boolean;
    label: string; // Changed from 'what'
    body: string;  // Added this prop
    onCancel: () => void;
    onConfirm: () => void;
  }

  export function ResetConfirm({ open, label, body, onCancel, onConfirm }: Props) {
    if (!open) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
        <div className="w-80 rounded-lg bg-neutral-900 p-4 shadow-lg">
          {/* Use the 'label' prop for the heading */}
          <h2 className="mb-2 text-lg font-bold text-red-400">{label}</h2>
          {/* Use the 'body' prop for the paragraph content */}
          <p className="mb-4 text-sm text-neutral-300">
            {body}
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