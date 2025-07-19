import { useState } from 'react';

interface Props {
  alias: string;
  myId: string;
  onRename: () => void;
  onReset: () => void;
}

export function HeaderBar({ alias, myId, onRename, onReset }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="w-full flex items-center justify-between px-4 py-2 border-b border-zinc-800 bg-zinc-900">
      <div className="flex items-baseline gap-2">
        <h1 className="text-xl font-bold text-indigo-400 select-none">WiChain</h1>
        <span className="text-sm text-zinc-400 select-none">{alias}</span>
      </div>

      <div className="relative">
        <button
          className="px-2 py-1 rounded hover:bg-zinc-800 text-sm"
          onClick={() => setMenuOpen((v) => !v)}
        >
          ☰
        </button>
        {menuOpen && (
          <div className="absolute right-0 mt-1 w-40 rounded bg-zinc-800 border border-zinc-700 shadow-lg p-1 text-sm z-10">
            <button
              className="w-full text-left px-2 py-1 rounded hover:bg-zinc-700"
              onClick={() => {
                setMenuOpen(false);
                onRename();
              }}
            >
              Rename Device
            </button>
            <button
              className="w-full text-left px-2 py-1 rounded hover:bg-red-600 hover:text-white"
              onClick={() => {
                setMenuOpen(false);
                onReset();
              }}
            >
              Reset Data
            </button>
            <div className="px-2 py-1 text-[10px] text-zinc-500 break-all">{myId.slice(0, 24)}…</div>
          </div>
        )}
      </div>
    </header>
  );
}
