import { motion, AnimatePresence } from 'framer-motion';
import { 
  MessageCircle, 
  Users, 
  Pin,
  Edit3
} from 'lucide-react';
import type { PeerInfo, GroupInfo } from '../lib/api';
import { getRandomProfilePicture, getRandomGroupProfilePicture } from '../utils/profilePictures';
import { apiUpdateGroupName } from '../lib/api';
import { useState } from 'react';

interface Props {
  peers: PeerInfo[];
  groups: GroupInfo[];
  aliasMap: Record<string, string>;
  myPub: string;
  selected: { kind: 'peer' | 'group'; id: string } | null;
  onSelectPeer: (id: string) => void;
  onSelectGroup: (id: string) => void;
  messages: any[]; // Add messages prop to get real latest messages
}

export function PeerList({ 
  peers, 
  groups, 
  aliasMap, 
  myPub, 
  selected, 
  onSelectPeer, 
  onSelectGroup,
  messages
}: Props) {
  const [editingGroup, setEditingGroup] = useState<string | null>(null);
  const [editGroupName, setEditGroupName] = useState('');
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 60000) return 'now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
    return date.toLocaleDateString();
  };

  const getLastMessage = (peerId: string) => {
    // Get the latest message for this peer
    const peerMessages = messages.filter(msg => 
      (msg.from === myPub && msg.to === peerId) || 
      (msg.from === peerId && msg.to === myPub)
    );
    
    if (peerMessages.length === 0) {
      return "Text now!";
    }
    
    // Sort by timestamp and get the latest
    const latestMessage = peerMessages.sort((a, b) => b.ts_ms - a.ts_ms)[0];
    
    // Extract text from image messages
    const imageMatch = latestMessage.text.match(/\[IMAGE_DATA:(.+?)\]/);
    if (imageMatch) {
      const textWithoutImage = latestMessage.text.replace(/\[IMAGE_DATA:.+?\]/, '').trim();
      return textWithoutImage || "📷 Image";
    }
    
    return latestMessage.text;
  };

  const getLastMessageTime = (peerId: string) => {
    const peerMessages = messages.filter(msg => 
      (msg.from === myPub && msg.to === peerId) || 
      (msg.from === peerId && msg.to === myPub)
    );
    
    if (peerMessages.length === 0) {
      return null;
    }
    
    const latestMessage = peerMessages.sort((a, b) => b.ts_ms - a.ts_ms)[0];
    return latestMessage.ts_ms;
  };

  const getConnectionStatus = (_peer: PeerInfo) => {
    // For now, assume all peers are online
    return { color: 'bg-green-500', text: '' };
  };



  const handleSaveGroup = async (groupId: string) => {
    try {
      // Just save name
      const success = await apiUpdateGroupName(groupId, editGroupName || null);
      if (success) {
        setEditingGroup(null);
        setEditGroupName('');
      } else {
        alert('Failed to save group. Please try again.');
      }
    } catch (error) {
      console.error('Group save failed:', error);
      alert('Failed to save group. Please try again.');
    }
  };

  const handleCancelGroupEdit = () => {
    setEditingGroup(null);
    setEditGroupName('');
  };

  const startGroupEdit = (group: GroupInfo) => {
    setEditingGroup(group.id);
    setEditGroupName(group.name || '');
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
                    className={`group p-3 rounded-xl cursor-pointer transition-all duration-200 ${
                      isSelected 
                        ? 'bg-white/10 border border-white/20' 
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
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center overflow-hidden ${
                          isSelected ? 'ring-2 ring-white/30' : ''
                        }`}>
                          <img 
                            src={getRandomProfilePicture(peer.id)} 
                            alt="User" 
                            className="w-full h-full object-cover"
                          />
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
                          </div>
                        </div>
                        
                        <p className="text-slate-400 text-xs truncate mt-1">
                          {getLastMessage(peer.id)}
                        </p>
                        
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-slate-500 text-xs">
                            {(() => {
                              const lastMsgTime = getLastMessageTime(peer.id);
                              return lastMsgTime ? formatTime(lastMsgTime) : 'Text now!';
                            })()}
                          </span>
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
                    className={`group p-3 rounded-xl cursor-pointer transition-all duration-200 ${
                      isSelected 
                        ? 'bg-white/10 border border-white/20' 
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
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center overflow-hidden ${
                          isSelected ? 'ring-2 ring-white/30' : ''
                        }`}>
                          <img 
                            src={getRandomGroupProfilePicture(group.id)} 
                            alt="Group" 
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-slate-800 flex items-center justify-center">
                          <Users size={8} className="text-white" />
                        </div>
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        {editingGroup === group.id ? (
                          <div className="space-y-2">
                            <input
                              type="text"
                              value={editGroupName}
                              onChange={(e) => setEditGroupName(e.target.value)}
                              placeholder="Group name"
                              className="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-sm placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-white/30"
                              autoFocus
                            />
                            <div className="flex items-center space-x-2">
                              <div className="flex space-x-1">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSaveGroup(group.id);
                                  }}
                                  className="px-2 py-1 bg-white text-black hover:bg-gray-100 text-xs rounded transition-colors font-medium"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCancelGroupEdit();
                                  }}
                                  className="px-2 py-1 bg-slate-600 hover:bg-slate-700 text-white text-xs rounded transition-colors"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between">
                            <h4 className="text-white font-medium text-sm truncate">
                              {groupName}
                            </h4>
                            <div className="flex items-center space-x-1">
                              <span className="px-2 py-1 bg-green-500/20 text-green-300 text-xs rounded-full">
                                {group.members.length}
                              </span>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  startGroupEdit(group);
                                }}
                                className="text-white/60 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-white/10"
                                title="Edit group"
                              >
                                <Edit3 size={14} />
                              </button>
                            </div>
                          </div>
                        )}
                        
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
  // If group has a name, use it
  if (g.name) {
    return g.name;
  }
  
  // Otherwise, generate name from members
  const names = g.members
    .filter((m) => m !== myPub)
    .map((m) => aliasMap[m] ?? m.slice(0, 8) + '…');
  if (names.length === 0) return 'Just Me';
  if (names.length === 1) return `You + ${names[0]}`;
  if (names.length === 2) return `${names[0]}, ${names[1]}, You`;
  if (names.length === 3) return `${names[0]}, ${names[1]}, +1`;
  return `${names[0]}, ${names[1]}, +${names.length - 2}`;
}