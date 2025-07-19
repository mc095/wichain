import { useState } from 'react';

export interface AliasWizardProps {
  initialAlias?: string;
  onSave: (alias: string) => Promise<void> | void;
  onCancel?: () => void;
}

export function AliasWizard({ initialAlias, onSave, onCancel }: AliasWizardProps) {
  const [alias, setAlias] = useState(initialAlias ?? '');
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [saving, setSaving] = useState(false);
  const next = () => setStep((s) => (s === 2 ? 2 : ((s + 1) as 0 | 1 | 2)));
  const back = () => setStep((s) => (s === 0 ? 0 : ((s - 1) as 0 | 1 | 2)));

  async function save() {
    const a = alias.trim();
    if (!a) return;
    setSaving(true);
    await onSave(a);
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4">
      <div className="w-full max-w-md rounded-xl bg-gray-900 p-6 shadow-lg">
        {step === 0 && (
          <>
            <h1 className="text-2xl font-bold text-white text-center mb-4">WiChain</h1>
            <p className="text-sm text-gray-300 mb-2 text-center">
              Offline‑ready local Wi‑Fi chat.
            </p>
            <p className="text-sm text-gray-300 mb-6 text-center">
              Secure. Peer to peer. Tamper‑evident.
            </p>
            <button
              className="w-full rounded-md bg-blue-600 hover:bg-blue-500 py-2 text-white font-medium"
              onClick={next}
            >
              Next
            </button>
          </>
        )}

        {step === 1 && (
          <>
            <h2 className="text-xl font-semibold mb-4 text-white text-center">Choose a Name</h2>
            <input
              autoFocus
              className="w-full rounded-md bg-gray-800 border border-gray-700 px-3 py-2 text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Your device name"
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') next();
              }}
            />
            <div className="mt-6 flex justify-between">
              <button
                className="px-3 py-1 rounded bg-gray-700 text-gray-200 hover:bg-gray-600"
                onClick={back}
              >
                Back
              </button>
              <button
                className="px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50"
                onClick={next}
                disabled={!alias.trim()}
              >
                Continue
              </button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h2 className="text-xl font-semibold mb-4 text-white text-center">Ready</h2>
            <p className="text-sm text-gray-300 mb-6 text-center">
              We’ll use <span className="font-medium text-white">{alias || '(unnamed)'}</span> on
              this network.
            </p>
            <button
              className="w-full rounded-md bg-green-600 hover:bg-green-500 py-2 text-white font-medium disabled:opacity-50"
              disabled={saving || !alias.trim()}
              onClick={save}
            >
              {saving ? 'Saving…' : 'Get Started'}
            </button>
            {onCancel && (
              <button
                className="mt-3 w-full rounded-md bg-gray-700 hover:bg-gray-600 py-2 text-gray-200"
                onClick={onCancel}
              >
                Cancel
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
