import { useState } from 'react';
import { motion } from 'framer-motion';

interface Props {
  initialAlias: string;
  onDone: (alias: string) => void;
}

export function Onboarding({ initialAlias, onDone }: Props) {
  const [alias, setAlias] = useState(initialAlias);

  return (
    <motion.div
      className="modal-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <motion.div
        className="modal-content"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <h2 className="mb-2 text-xl font-semibold text-[var(--foreground)]">Set Your Alias</h2>
        <p className="mb-4 text-sm text-[var(--text-muted)]">
          Choose a name others will see on the network.
        </p>
        <input
          autoFocus
          className="mb-4 w-full rounded-lg border border-[var(--neutral-light)] bg-[var(--neutral)] px-3 py-2 text-sm text-[var(--foreground)] placeholder-[var(--text-muted)] focus:border-[var(--primary)] focus:outline-none"
          value={alias}
          onChange={(e) => setAlias(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && alias.trim()) onDone(alias.trim());
          }}
          placeholder="Enter your alias"
        />
        <div className="flex justify-end">
          <button
            className="rounded-full bg-[var(--primary)] px-6 py-2 text-sm font-semibold text-white hover:bg-[var(--primary-dark)] disabled:opacity-50"
            disabled={!alias.trim()}
            onClick={() => onDone(alias.trim())}
          >
            Save
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}