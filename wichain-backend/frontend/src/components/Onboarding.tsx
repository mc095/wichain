import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  User, 
  Sparkles, 
  Shield, 
  Zap,
  Check
} from 'lucide-react';

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
    
    // Simulate a brief loading state for better UX
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    onDone(alias.trim());
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
          className="w-full max-w-md"
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
          <div className="bg-slate-800/90 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-8">
            {/* Header with animated icon */}
            <motion.div 
              className="text-center mb-8"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <motion.div
                className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ 
                  type: "spring", 
                  stiffness: 300, 
                  damping: 20,
                  delay: 0.3 
                }}
              >
                <User size={32} className="text-white" />
              </motion.div>
              
              <motion.h2 
                className="text-2xl font-display text-white mb-2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
              >
                Welcome to WiChain
              </motion.h2>
              
              <motion.p 
                className="text-slate-400"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                Choose your display name to get started
              </motion.p>
            </motion.div>

            {/* Features */}
            <motion.div 
              className="space-y-3 mb-8"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
            >
              {[
                { icon: Shield, text: "End-to-end encrypted messaging" },
                { icon: Zap, text: "Lightning-fast peer-to-peer" },
                { icon: Sparkles, text: "Decentralized & secure" }
              ].map((feature, index) => (
                <motion.div 
                  key={feature.text}
                  className="flex items-center space-x-3 text-slate-300"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.7 + index * 0.1 }}
                >
                  <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center">
                    <feature.icon size={16} className="text-blue-400" />
                  </div>
                  <span className="text-sm">{feature.text}</span>
                </motion.div>
              ))}
            </motion.div>

            {/* Input */}
            <motion.div 
              className="mb-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
            >
              <label className="block text-slate-300 text-sm font-medium mb-2">
                Display Name
              </label>
              <input
                type="text"
                placeholder="Enter your alias"
                value={alias}
                onChange={(e) => setAlias(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && alias.trim()) {
                    handleSubmit();
                  }
                }}
                autoFocus
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white placeholder-slate-400 focus:border-blue-500/50 focus:outline-none transition-colors"
              />
            </motion.div>

            {/* Submit Button */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.9 }}
            >
              <button
                className="w-full px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-600 hover:to-purple-700 disabled:opacity-50 transition-all duration-200 flex items-center justify-center space-x-2"
                onClick={handleSubmit}
                disabled={!alias.trim() || isLoading}
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Setting up...</span>
                  </>
                ) : (
                  <>
                    <Check size={16} />
                    <span>Continue</span>
                  </>
                )}
              </button>
            </motion.div>

            {/* Avatar Preview */}
            <motion.div 
              className="mt-6 text-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.0 }}
            >
              <p className="text-xs text-slate-500 mb-2">Your avatar</p>
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto">
                <span className="text-white font-bold text-lg">
                  {(alias || 'default').charAt(0).toUpperCase()}
                </span>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}