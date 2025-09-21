import { motion, AnimatePresence } from 'framer-motion';
import { 
  MessageCircle, 
  Users, 
  MoreVertical,
  Pin,
  Trash2,
  X,
  Edit3,
  Image
} from 'lucide-react';
import type { PeerInfo, GroupInfo } from '../lib/api';
import { apiDeletePeerMessages, apiDeleteGroup, apiUpdateGroupName, apiUpdateGroupProfilePicture } from '../lib/api';
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
  onDeletePeer?: (id: string) => void;
  onDeleteGroup?: (id: string) => void;
}

export function PeerList({ 
  peers, 
  groups, 
  aliasMap, 
  myPub, 
  selected, 
  onSelectPeer, 
  onSelectGroup,
  messages,
  onDeletePeer,
  onDeleteGroup
}: Props) {
  const [editingGroup, setEditingGroup] = useState<string | null>(null);
  const [editGroupName, setEditGroupName] = useState('');
  const [selectedGroupImage, setSelectedGroupImage] = useState<File | null>(null);
  const [groupImagePreview, setGroupImagePreview] = useState<string | null>(null);
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
      return "No messages yet";
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
    return { color: 'bg-green-500', text: 'Online' };
  };

  const handleDeletePeer = async (peerId: string, peerAlias: string) => {
    if (window.confirm(`Are you sure you want to delete all messages with ${peerAlias}? This action cannot be undone.`)) {
      const success = await apiDeletePeerMessages(peerId);
      if (success) {
        onDeletePeer?.(peerId);
      } else {
        alert('Failed to delete messages. Please try again.');
      }
    }
  };

  const handleDeleteGroup = async (groupId: string, groupName: string) => {
    if (window.confirm(`Are you sure you want to delete the group "${groupName}" and all its messages? This action cannot be undone.`)) {
      const success = await apiDeleteGroup(groupId);
      if (success) {
        onDeleteGroup?.(groupId);
      } else {
        alert('Failed to delete group. Please try again.');
      }
    }
  };

  const handleGroupImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      // Check file size (limit to 2MB)
      const MAX_SIZE = 2 * 1024 * 1024; // 2MB
      if (file.size > MAX_SIZE) {
        alert(`Image too large! Maximum size is ${MAX_SIZE / (1024 * 1024)}MB. Your image is ${(file.size / (1024 * 1024)).toFixed(1)}MB.`);
        return;
      }
      
      setSelectedGroupImage(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setGroupImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveGroup = async (groupId: string) => {
    try {
      let profilePictureData = null;
      
      // If new image selected, convert to base64
      if (selectedGroupImage) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const base64 = e.target?.result as string;
          profilePictureData = base64;
          
          // Save both name and profile picture
          Promise.all([
            apiUpdateGroupName(groupId, editGroupName || null),
            apiUpdateGroupProfilePicture(groupId, profilePictureData)
          ]).then(([nameSuccess, pictureSuccess]) => {
            if (nameSuccess && pictureSuccess) {
              setEditingGroup(null);
              setEditGroupName('');
              setSelectedGroupImage(null);
              setGroupImagePreview(null);
            } else {
              alert('Failed to save group. Please try again.');
            }
          });
        };
        reader.readAsDataURL(selectedGroupImage);
      } else {
        // Just save name
        const success = await apiUpdateGroupName(groupId, editGroupName || null);
        if (success) {
          setEditingGroup(null);
          setEditGroupName('');
        } else {
          alert('Failed to save group. Please try again.');
        }
      }
    } catch (error) {
      console.error('Group save failed:', error);
      alert('Failed to save group. Please try again.');
    }
  };

  const handleCancelGroupEdit = () => {
    setEditingGroup(null);
    setEditGroupName('');
    setSelectedGroupImage(null);
    setGroupImagePreview(null);
  };

  const startGroupEdit = (group: GroupInfo) => {
    setEditingGroup(group.id);
    setEditGroupName(group.name || '');
    setSelectedGroupImage(null);
    setGroupImagePreview(null);
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
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeletePeer(peer.id, peer.alias);
                              }}
                              className="text-red-400 hover:text-red-300 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-red-900/20"
                              title="Delete conversation"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                        
                        <p className="text-slate-400 text-xs truncate mt-1">
                          {getLastMessage(peer.id)}
                        </p>
                        
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-slate-500 text-xs">
                            {(() => {
                              const lastMsgTime = getLastMessageTime(peer.id);
                              return lastMsgTime ? formatTime(lastMsgTime) : 'No messages';
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
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center overflow-hidden ${
                          isSelected ? 'ring-2 ring-blue-500/50' : ''
                        }`}>
                          {editingGroup === group.id && groupImagePreview ? (
                            <img 
                              src={groupImagePreview} 
                              alt="Group Preview" 
                              className="w-full h-full object-cover"
                            />
                          ) : group.profile_picture ? (
                            <img 
                              src={group.profile_picture} 
                              alt="Group" 
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-white font-semibold text-sm">
                              {groupName.charAt(0).toUpperCase()}
                            </span>
                          )}
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
                              className="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-sm placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                              autoFocus
                            />
                            <div className="flex items-center space-x-2">
                              <label className="flex items-center space-x-1 text-blue-400 hover:text-blue-300 cursor-pointer text-xs">
                                <Image size={12} />
                                <span>Change photo</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={handleGroupImageSelect}
                                  className="hidden"
                                />
                              </label>
                              <div className="flex space-x-1">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSaveGroup(group.id);
                                  }}
                                  className="px-2 py-1 bg-blue-500 hover:bg-blue-600 text-white text-xs rounded transition-colors"
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
                                className="text-blue-400 hover:text-blue-300 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-blue-900/20"
                                title="Edit group"
                              >
                                <Edit3 size={14} />
                              </button>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteGroup(group.id, groupName);
                                }}
                                className="text-red-400 hover:text-red-300 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-red-900/20"
                                title="Delete group"
                              >
                                <Trash2 size={14} />
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