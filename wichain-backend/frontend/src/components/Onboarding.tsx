// frontend/src/components/Onboarding.tsx
import { useState } from 'react';
import { apiSetAlias } from '../lib/api';

interface Props {
  initialAlias: string;
  onDone: (alias: string) => void;
}

const screens = [
  {
    title: 'Welcome to WiChain',
    desc: `Offline‑capable, secure LAN chat. No central servers. Local blockchain for tamper‑evident history.`,
  },
  {
    title: 'How it works',
    desc: `Devices on the same Wi‑Fi discover each other automatically. Select a peer and start chatting.`,
  },
  {
    title: 'Choose a Device Name',
    desc: `Pick the name others will see on the network.`,
  },
];

export function Onboarding({ initialAlias, onDone }: Props) {
  const [step, setStep] = useState(0);
  const [alias, setAlias] = useState(initialAlias);

  async function finish() {
    if (!alias.trim()) return;
    await apiSetAlias(alias.trim());
    onDone(alias.trim());
  }

  const s = screens[step];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950 bg-opacity-95 text-neutral-100">
      <div className="w-full max-w-md rounded-xl border border-neutral-700 bg-neutral-900 p-8 shadow-xl">
        <h2 className="mb-4 text-center text-2xl font-bold text-emerald-400">
          {s.title}
        </h2>
        <p className="mb-8 text-center text-neutral-300">{s.desc}</p>

        {step === 2 && (
          <input
            autoFocus
            type="text"
            value={alias}
            onChange={(e) => setAlias(e.target.value)}
            className="mb-6 w-full rounded-md border border-neutral-600 bg-neutral-800 px-3 py-2 text-neutral-100 focus:border-emerald-400 focus:outline-none"
            placeholder="Device name…"
          />
        )}

        <div className="flex justify-center gap-4">
          {step < screens.length - 1 ? (
            <button
              className="rounded-md bg-emerald-600 px-6 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
              onClick={() => setStep((s) => s + 1)}
            >
              Next
            </button>
          ) : (
            <button
              className="rounded-md bg-emerald-600 px-6 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
              onClick={finish}
              disabled={!alias.trim()}
            >
              Get Started
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
