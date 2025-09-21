import { motion, AnimatePresence } from 'framer-motion';
import { 
  AlertTriangle, 
  Trash2, 
  Shield,
  RotateCcw
} from 'lucide-react';

interface Props {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  label: string;
  body: string;
}

export function ResetConfirm({ open, onCancel, onConfirm, label, body }: Props) {
  if (!open) return null;

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
          className="w-full max-w-md bg-slate-800/90 backdrop-blur-xl border border-slate-700/50 rounded-2xl"
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        >
          {/* Header */}
          <div className="p-6 border-b border-slate-700/50">
            <div className="flex items-center space-x-3">
              <motion.div 
                className="w-12 h-12 bg-gradient-to-br from-red-500 to-orange-500 rounded-xl flex items-center justify-center"
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ 
                  type: "spring", 
                  stiffness: 300, 
                  damping: 20,
                  delay: 0.2 
                }}
              >
                <AlertTriangle size={24} className="text-white" />
              </motion.div>
              <div>
                <h3 className="text-xl font-semibold text-white">{label}</h3>
                <p className="text-slate-400 text-sm">This action cannot be undone</p>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="p-6 space-y-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <div className="bg-slate-700/30 border border-slate-600/50 rounded-xl p-4">
                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
                    <Shield size={16} className="text-blue-400" />
                  </div>
                  <div>
                    <p className="text-slate-300 text-sm leading-relaxed">
                      {body}
                    </p>
                  </div>
                </div>
              </div>

              <motion.div 
                className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4 }}
              >
                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 bg-red-500/20 rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
                    <Trash2 size={16} className="text-red-400" />
                  </div>
                  <div>
                    <h4 className="text-red-300 font-medium text-sm mb-1">
                      What will be deleted:
                    </h4>
                    <ul className="text-slate-400 text-sm space-y-1">
                      <li>• All chat messages and history</li>
                      <li>• Group conversations</li>
                      <li>• Message attachments and files</li>
                    </ul>
                  </div>
                </div>
              </motion.div>

              <motion.div 
                className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.5 }}
              >
                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
                    <Shield size={16} className="text-green-400" />
                  </div>
                  <div>
                    <h4 className="text-green-300 font-medium text-sm mb-1">
                      What will be preserved:
                    </h4>
                    <ul className="text-slate-400 text-sm space-y-1">
                      <li>• Your device identity and keys</li>
                      <li>• Network connections and peers</li>
                      <li>• Application settings</li>
                    </ul>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-slate-700/50 flex items-center justify-between">
            <button
              className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
              onClick={onCancel}
            >
              Cancel
            </button>
            
            <button
              className="px-6 py-3 bg-gradient-to-r from-red-500 to-orange-500 text-white rounded-lg font-semibold hover:from-red-600 hover:to-orange-600 transition-all duration-200 flex items-center space-x-2"
              onClick={onConfirm}
            >
              <RotateCcw size={16} />
              <span>Reset Chat History</span>
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}