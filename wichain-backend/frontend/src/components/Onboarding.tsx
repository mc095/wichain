import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';


interface Props {
  initialAlias: string;
  onDone: (alias: string) => void;
}

export function Onboarding({ initialAlias, onDone }: Props) {
  const [alias, setAlias] = useState(initialAlias);
  const [isLoading, setIsLoading] = useState(false);


  const handleSubmit = async () => {
    if (!alias.trim()) return;
    setIsLoading(true);
    
    try {
      // Save alias to backend
      const { apiSetAlias } = await import('../lib/api');
      
      const aliasSuccess = await apiSetAlias(alias.trim());
      
      if (aliasSuccess) {
        // Simulate a brief loading state for better UX
        await new Promise(resolve => setTimeout(resolve, 500));
        onDone(alias.trim());
      } else {
        alert('Failed to save profile. Please try again.');
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Profile save failed:', error);
      alert('Failed to save profile. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
      >
        <motion.div
          className="w-full max-w-sm"
          initial={{ scale: 0.8, opacity: 0, y: 50 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.8, opacity: 0, y: 50 }}
          transition={{ 
            type: "spring", 
            stiffness: 300, 
            damping: 30,
            duration: 0.5 
          }}
        >
          <div className="bg-black/90 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl">
            {/* Header */}
            <motion.div 
              className="text-center mb-8"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <motion.h2 
                className="text-3xl text-white mb-3"
                style={{ fontFamily: 'Doto, sans-serif', fontWeight: 600, letterSpacing: '0.05em' }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                Welcome to WiChain
              </motion.h2>
              
              <motion.p 
                className="text-gray-400 font-grotesk"
                style={{ fontSize: '15px', fontWeight: 400 }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
              >
                Choose your name to get started
              </motion.p>
            </motion.div>

            {/* Input */}
            <motion.div 
              className="mb-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <label className="block text-gray-300 text-sm font-grotesk font-medium mb-2">
                Name
              </label>
              <input
                type="text"
                placeholder="Enter your name"
                value={alias}
                onChange={(e) => setAlias(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && alias.trim()) {
                    handleSubmit();
                  }
                }}
                autoFocus
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:border-white/30 focus:outline-none transition-colors font-grotesk"
              />
            </motion.div>

            {/* Submit Button */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
            >
              <button
                className="w-full px-4 py-3 bg-white text-black rounded-lg font-grotesk font-medium hover:bg-gray-100 disabled:opacity-50 transition-all duration-200 flex items-center justify-center space-x-2"
                onClick={handleSubmit}
                disabled={!alias.trim() || isLoading}
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                    <span>Setting up...</span>
                  </>
                ) : (
                  <>
                    <span>Continue</span>
                    <span>→</span>
                  </>
                )}
              </button>
            </motion.div>

          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}