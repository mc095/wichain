import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, 
  Search, 
  X,
  UserPlus,
  Check
} from 'lucide-react';
import type { PeerInfo } from '../lib/api';

interface Props {
  open: boolean;
  onClose: () => void;
  peers: PeerInfo[];
  aliasMap: Record<string, string>;
  onCreateGroup: (memberIds: string[]) => void;
}

export function GroupModal({ open, onClose, peers, onCreateGroup }: Props) {
  const [selectedPeers, setSelectedPeers] = useState<string[]>([]);
  const [groupName, setGroupName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const filteredPeers = peers.filter(peer => 
    peer.alias.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handlePeerToggle = (peerId: string) => {
    setSelectedPeers(prev => 
      prev.includes(peerId) 
        ? prev.filter(id => id !== peerId)
        : [...prev, peerId]
    );
  };

  const handleCreateGroup = async () => {
    if (selectedPeers.length === 0) return;
    
    setIsCreating(true);
    try {
      await onCreateGroup(selectedPeers);
      setSelectedPeers([]);
      setGroupName('');
      setSearchQuery('');
      onClose();
    } catch (error) {
      console.error('Failed to create group:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleClose = () => {
    setSelectedPeers([]);
    setGroupName('');
    setSearchQuery('');
    onClose();
  };

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
          className="w-full max-w-2xl bg-slate-800/90 backdrop-blur-xl border border-slate-700/50 rounded-2xl"
          initial={{ scale: 0.9, opacity: 0, y: 50 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 50 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        >
          {/* Header */}
          <div className="p-6 border-b border-slate-700/50">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                <Users size={20} className="text-white" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-white">Create New Group</h3>
                <p className="text-slate-400 text-sm">Add members to start a group conversation</p>
              </div>
              <button
                className="ml-auto p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700/50 transition-colors"
                onClick={handleClose}
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="p-6 space-y-6">
            {/* Group Name Input */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <label className="block text-slate-300 text-sm font-medium mb-2">
                Group Name (Optional)
              </label>
              <div className="relative">
                <Users size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Enter group name"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white placeholder-slate-400 focus:border-blue-500/50 focus:outline-none transition-colors"
                />
              </div>
            </motion.div>

            {/* Search */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search contacts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white placeholder-slate-400 focus:border-blue-500/50 focus:outline-none transition-colors"
                />
              </div>
            </motion.div>

            {/* Selected Members Preview */}
            {selectedPeers.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-300">
                      Selected Members ({selectedPeers.length})
                    </span>
                    <button
                      className="text-sm text-slate-400 hover:text-white transition-colors"
                      onClick={() => setSelectedPeers([])}
                    >
                      Clear All
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selectedPeers.map(peerId => {
                      const peer = peers.find(p => p.id === peerId);
                      if (!peer) return null;
                      
                      return (
                        <motion.div
                          key={peerId}
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                          transition={{ type: "spring", stiffness: 300 }}
                        >
                          <span className="inline-flex items-center space-x-2 px-3 py-1 bg-blue-500/20 text-blue-300 rounded-full text-sm">
                            <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                              <span className="text-white text-xs font-semibold">
                                {peer.alias.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <span>{peer.alias}</span>
                            <button
                              onClick={() => handlePeerToggle(peerId)}
                              className="text-blue-300 hover:text-white transition-colors"
                            >
                              <X size={12} />
                            </button>
                          </span>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            )}

            <div className="h-px bg-slate-700/50"></div>

            {/* Contacts List */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-slate-300 mb-3">
                  Available Contacts ({filteredPeers.length})
                </h4>
                
                <div className="max-h-64 overflow-y-auto space-y-2">
                  {filteredPeers.length === 0 ? (
                    <div className="text-center py-8">
                      <div className="w-12 h-12 bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-3">
                        <Users size={20} className="text-slate-400" />
                      </div>
                      <p className="text-slate-400 text-sm">
                        {searchQuery ? 'No contacts found' : 'No contacts available'}
                      </p>
                    </div>
                  ) : (
                    filteredPeers.map((peer, index) => (
                      <motion.div
                        key={peer.id}
                        className={`flex items-center space-x-3 p-3 rounded-xl cursor-pointer transition-all duration-200 ${
                          selectedPeers.includes(peer.id)
                            ? 'bg-blue-500/20 border border-blue-500/30'
                            : 'hover:bg-slate-700/30'
                        }`}
                        onClick={() => handlePeerToggle(peer.id)}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.5 + index * 0.05 }}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                          selectedPeers.includes(peer.id)
                            ? 'bg-blue-500 border-blue-500'
                            : 'border-slate-400'
                        }`}>
                          {selectedPeers.includes(peer.id) && (
                            <Check size={12} className="text-white" />
                          )}
                        </div>
                        
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          selectedPeers.includes(peer.id) ? 'ring-2 ring-blue-500/50' : ''
                        }`}>
                          <span className="text-white font-semibold text-sm">
                            {peer.alias.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <h5 className="text-white font-medium text-sm truncate">
                            {peer.alias}
                          </h5>
                          <p className="text-slate-400 text-xs">
                            Last seen {peer.last_seen_ms ? new Date(peer.last_seen_ms).toLocaleDateString() : 'Unknown'}
                          </p>
                        </div>
                        
                        <span className="px-2 py-1 rounded-full text-xs bg-slate-500/20 text-slate-300">
                          Online
                        </span>
                      </motion.div>
                    ))
                  )}
                </div>
              </div>
            </motion.div>
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-slate-700/50 flex items-center justify-between">
            <button
              className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
              onClick={handleClose}
            >
              Cancel
            </button>
            
            <button
              className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-600 hover:to-purple-700 disabled:opacity-50 transition-all duration-200 flex items-center space-x-2"
              onClick={handleCreateGroup}
              disabled={selectedPeers.length === 0 || isCreating}
            >
              {isCreating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Creating...</span>
                </>
              ) : (
                <>
                  <UserPlus size={16} />
                  <span>Create Group ({selectedPeers.length})</span>
                </>
              )}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}