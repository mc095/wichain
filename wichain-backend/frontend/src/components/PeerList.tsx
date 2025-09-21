import { motion, AnimatePresence } from 'framer-motion';
import { 
  MessageCircle, 
  Users, 
  MoreVertical,
  Pin
} from 'lucide-react';
import type { PeerInfo, GroupInfo } from '../lib/api';

interface Props {
  peers: PeerInfo[];
  groups: GroupInfo[];
  aliasMap: Record<string, string>;
  myPub: string;
  selected: { kind: 'peer' | 'group'; id: string } | null;
  onSelectPeer: (id: string) => void;
  onSelectGroup: (id: string) => void;
}

export function PeerList({ 
  peers, 
  groups, 
  aliasMap, 
  myPub, 
  selected, 
  onSelectPeer, 
  onSelectGroup 
}: Props) {
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 60000) return 'now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
    return date.toLocaleDateString();
  };

  const getLastMessage = (_peerId: string) => {
    // This would typically come from your chat history
    // For now, we'll simulate some messages
    const messages = [
      "Hey, how are you doing?",
      "Let's discuss this tomorrow",
      "You: Ok, see you soon!",
      "Thanks for the update",
      "Can we schedule a meeting?"
    ];
    return messages[Math.floor(Math.random() * messages.length)];
  };

  const getConnectionStatus = (_peer: PeerInfo) => {
    // For now, assume all peers are online
    return { color: 'bg-green-500', text: 'Online' };
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="space-y-1 p-2">
        {/* Direct Messages */}
        {peers.length > 0 && (
          <>
            <motion.div 
              className="px-3 py-2"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <div className="flex items-center space-x-2 text-slate-400 text-xs font-medium uppercase tracking-wider">
                <MessageCircle size={12} />
                <span>Direct Messages</span>
              </div>
            </motion.div>
            
            <AnimatePresence>
              {peers.map((peer, index) => {
                const isSelected = selected?.kind === 'peer' && selected.id === peer.id;
                const status = getConnectionStatus(peer);
                
                return (
                  <motion.div
                    key={peer.id}
                    className={`p-3 rounded-xl cursor-pointer transition-all duration-200 ${
                      isSelected 
                        ? 'bg-blue-500/20 border border-blue-500/30' 
                        : 'hover:bg-slate-700/30'
                    }`}
                    onClick={() => onSelectPeer(peer.id)}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ delay: index * 0.05 }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="relative">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          isSelected ? 'ring-2 ring-blue-500/50' : ''
                        }`}>
                          <span className="text-white font-semibold text-sm">
                            {peer.alias.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className={`absolute -bottom-1 -right-1 w-3 h-3 ${status.color} rounded-full border-2 border-slate-800`}></div>
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h4 className="text-white font-medium text-sm truncate">
                            {peer.alias}
                          </h4>
                          <div className="flex items-center space-x-1">
                            <span className={`px-2 py-1 rounded-full text-xs ${status.color} text-white`}>
                              {status.text}
                            </span>
                            <button className="text-slate-400 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity">
                              <MoreVertical size={14} />
                            </button>
                          </div>
                        </div>
                        
                        <p className="text-slate-400 text-xs truncate mt-1">
                          {getLastMessage(peer.id)}
                        </p>
                        
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-slate-500 text-xs">
                            {formatTime(peer.last_seen_ms || Date.now())}
                          </span>
                          {Math.random() > 0.7 && (
                            <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                              <span className="text-white text-xs font-bold">1</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </>
        )}

        {/* Groups */}
        {groups.length > 0 && (
          <>
            <div className="h-px bg-slate-700/50 my-4"></div>
            
            <motion.div 
              className="px-3 py-2"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <div className="flex items-center space-x-2 text-slate-400 text-xs font-medium uppercase tracking-wider">
                <Users size={12} />
                <span>Groups</span>
              </div>
            </motion.div>
            
            <AnimatePresence>
              {groups.map((group, index) => {
                const isSelected = selected?.kind === 'group' && selected.id === group.id;
                const groupName = groupDisplayName(group, aliasMap, myPub);
                
                return (
                  <motion.div
                    key={group.id}
                    className={`p-3 rounded-xl cursor-pointer transition-all duration-200 ${
                      isSelected 
                        ? 'bg-blue-500/20 border border-blue-500/30' 
                        : 'hover:bg-slate-700/30'
                    }`}
                    onClick={() => onSelectGroup(group.id)}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ delay: (peers.length * 0.05) + (index * 0.05) }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="relative">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          isSelected ? 'ring-2 ring-blue-500/50' : ''
                        }`}>
                          <span className="text-white font-semibold text-sm">
                            {groupName.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-slate-800 flex items-center justify-center">
                          <Users size={8} className="text-white" />
                        </div>
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h4 className="text-white font-medium text-sm truncate">
                            {groupName}
                          </h4>
                          <div className="flex items-center space-x-1">
                            <span className="px-2 py-1 bg-green-500/20 text-green-300 text-xs rounded-full">
                              {group.members.length}
                            </span>
                            <button className="text-slate-400 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity">
                              <MoreVertical size={14} />
                            </button>
                          </div>
                        </div>
                        
                        <p className="text-slate-400 text-xs truncate mt-1">
                          {getLastMessage(group.id)}
                        </p>
                        
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-slate-500 text-xs">
                            {formatTime(Date.now() - Math.random() * 86400000)}
                          </span>
                          {Math.random() > 0.8 && (
                            <div className="flex items-center space-x-1">
                              <Pin size={10} className="text-slate-500" />
                              <div className="w-5 h-5 bg-yellow-500 rounded-full flex items-center justify-center">
                                <span className="text-white text-xs font-bold">2</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </>
        )}

        {/* Empty State */}
        {peers.length === 0 && groups.length === 0 && (
          <motion.div 
            className="text-center py-12"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <div className="w-16 h-16 bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-4">
              <MessageCircle size={24} className="text-slate-400" />
            </div>
            <h3 className="text-slate-400 font-medium mb-2">No conversations yet</h3>
            <p className="text-slate-500 text-sm">Start a new chat to begin messaging</p>
          </motion.div>
        )}
      </div>
    </div>
  );
}

function groupDisplayName(
  g: GroupInfo,
  aliasMap: Record<string, string>,
  myPub: string,
): string {
  const names = g.members
    .filter((m) => m !== myPub)
    .map((m) => aliasMap[m] ?? m.slice(0, 8) + '…');
  if (names.length === 0) return 'Just Me';
  if (names.length === 1) return `You + ${names[0]}`;
  if (names.length === 2) return `${names[0]}, ${names[1]}, You`;
  if (names.length === 3) return `${names[0]}, ${names[1]}, +1`;
  return `${names[0]}, ${names[1]}, +${names.length - 2}`;
}