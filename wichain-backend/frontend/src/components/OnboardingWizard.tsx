import { useCallback, useState } from 'react';

interface Props {
  initialAlias: string;
  soloRenameMode?: boolean;
  onAliasSave: (alias: string) => void;
  onDiscoverPeers: () => void;
  onDone: () => void;
}

export function OnboardingWizard({
  initialAlias,
  soloRenameMode = false,
  onAliasSave,
  onDiscoverPeers,
  onDone,
}: Props) {
  const [step, setStep] = useState(0);
  const [alias, setAlias] = useState(initialAlias);

  const next = useCallback(() => setStep((s) => s + 1), []);
  const prev = useCallback(() => setStep((s) => Math.max(0, s - 1)), []);

  const saveAlias = useCallback(() => {
    onAliasSave(alias.trim());
    if (soloRenameMode) {
      onDone();
    } else {
      next();
    }
  }, [alias, onAliasSave, soloRenameMode, next, onDone]);

  // Steps:
  // 0: Splash / Intro
  // 1: Alias entry
  // 2: Peer discovery
  // 3: Done

  if (soloRenameMode) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black/80 z-50">
        <div className="w-[90%] max-w-sm bg-zinc-900 border border-zinc-700 rounded p-4 space-y-4">
          <h2 className="text-lg font-semibold">Rename device</h2>
          <input
            className="w-full rounded bg-zinc-800 px-3 py-2"
            value={alias}
            autoFocus
            onChange={(e) => setAlias(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveAlias();
            }}
          />
          <div className="flex justify-end gap-2">
            <button
              className="px-3 py-1 rounded bg-zinc-700 hover:bg-zinc-600"
              onClick={onDone}
            >
              Cancel
            </button>
            <button
              className="px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50"
              disabled={!alias.trim()}
              onClick={saveAlias}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-gradient-to-b from-zinc-950 to-zinc-900 text-zinc-100 z-50">
      <div className="w-[90%] max-w-md p-6 rounded-xl bg-zinc-900/80 border border-zinc-700 shadow-xl space-y-6">
        {step === 0 && (
          <>
            <h1 className="text-3xl font-bold text-center text-indigo-400 drop-shadow">
              WiChain
            </h1>
            <p className="text-center text-zinc-300 text-sm">
              Offline‑friendly, peer‑to‑peer LAN chat secured by local cryptographic identity.
            </p>
            <div className="flex justify-center">
              <button
                className="mt-4 px-6 py-2 rounded bg-indigo-600 hover:bg-indigo-500"
                onClick={next}
              >
                Get Started
              </button>
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <h2 className="text-xl font-semibold text-center">Choose a device name</h2>
            <input
              className="w-full rounded bg-zinc-800 px-3 py-2 mt-4"
              value={alias}
              autoFocus
              onChange={(e) => setAlias(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && alias.trim()) saveAlias();
              }}
            />
            <div className="flex justify-end mt-4 gap-2">
              <button
                className="px-4 py-2 rounded bg-zinc-700 hover:bg-zinc-600"
                onClick={prev}
              >
                Back
              </button>
              <button
                className="px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50"
                disabled={!alias.trim()}
                onClick={saveAlias}
              >
                Save & Continue
              </button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h2 className="text-xl font-semibold text-center">Find peers</h2>
            <p className="text-sm text-center text-zinc-400">
              Make sure your other devices are on the same Wi‑Fi network.
            </p>
            <div className="flex justify-center">
              <button
                className="mt-4 px-6 py-2 rounded bg-indigo-600 hover:bg-indigo-500"
                onClick={onDiscoverPeers}
              >
                Discover Now
              </button>
            </div>
            <div className="flex justify-end mt-6">
              <button
                className="px-4 py-2 rounded bg-green-600 hover:bg-green-500"
                onClick={next}
              >
                Continue
              </button>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h2 className="text-xl font-semibold text-center">All set!</h2>
            <p className="text-sm text-center text-zinc-400">
              Start chatting with peers on your LAN.
            </p>
            <div className="flex justify-center mt-6">
              <button
                className="px-6 py-2 rounded bg-indigo-600 hover:bg-indigo-500"
                onClick={onDone}
              >
                Enter App
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
