import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  User, 
  CheckCheck,
  ArrowDown
} from 'lucide-react';
import type { ChatBody, GroupInfo } from '../lib/api';
import { getRandomProfilePicture, getRandomGroupProfilePicture } from '../utils/profilePictures';

interface Props {
  messages: ChatBody[];
  myPubkeyB64: string;
  selectedTarget: { kind: 'peer' | 'group'; id: string } | null;
  aliasMap: Record<string, string>;
  groups: GroupInfo[];
  searchQuery: string;
}

export function ChatView({
  messages,
  myPubkeyB64,
  selectedTarget,
  aliasMap,
  groups,
  searchQuery
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [randomWallpaper, setRandomWallpaper] = useState('');

  // Generate random wallpaper on component mount
  useEffect(() => {
    const wallpapers = ['wall-1.png', 'wall-2.png', 'wall-3.png'];
    const randomIndex = Math.floor(Math.random() * wallpapers.length);
    setRandomWallpaper(`/wallpapers/${wallpapers[randomIndex]}`);
  }, [selectedTarget]);

  // Filter messages for the selected target and search
  const filteredMessages = messages.filter((msg) => {
    if (!selectedTarget) return false;
    
    let matchesTarget = false;
    if (selectedTarget.kind === 'peer') {
      matchesTarget = (
        (msg.from === myPubkeyB64 && msg.to === selectedTarget.id) ||
        (msg.from === selectedTarget.id && msg.to === myPubkeyB64)
      );
    } else {
      matchesTarget = msg.to === selectedTarget.id;
    }
    
    if (!matchesTarget) return false;
    
    // Apply search filter
    if (searchQuery.trim()) {
      const searchLower = searchQuery.toLowerCase();
      const messageText = msg.text.toLowerCase();
      
      // Check if message contains search query
      if (messageText.includes(searchLower)) {
        return true;
      }
      
      // Check if it's an image message and search matches filename
      const imageMatch = msg.text.match(/\[IMAGE_DATA:(.+?)\]/);
      if (imageMatch) {
        try {
          const imageData = JSON.parse(imageMatch[1]);
          return imageData.filename.toLowerCase().includes(searchLower);
        } catch (error) {
          return false;
        }
      }
      
      return false;
    }
    
    return true;
  });

  // Auto-scroll to bottom when new messages arrive (only if not searching)
  useEffect(() => {
    if (scrollRef.current && !searchQuery.trim()) {
      const scrollContainer = scrollRef.current;
      // Only scroll if user is near bottom (within 100px)
      const isNearBottom = scrollContainer.scrollHeight - scrollContainer.scrollTop - scrollContainer.clientHeight < 100;
      
      if (isNearBottom) {
        // Use requestAnimationFrame for smooth scroll
        requestAnimationFrame(() => {
          scrollContainer.scrollTop = scrollContainer.scrollHeight;
        });
      }
    }
  }, [filteredMessages, searchQuery]);

  // Force scroll to bottom when component mounts or target changes
  useEffect(() => {
    if (scrollRef.current) {
      const scrollContainer = scrollRef.current;
      // Use multiple methods to ensure scroll works
      const scrollToBottom = () => {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      };
      
      // Immediate scroll
      scrollToBottom();
      
      // Delayed scrolls to handle dynamic content
      setTimeout(scrollToBottom, 100);
      setTimeout(scrollToBottom, 300);
      setTimeout(scrollToBottom, 500);
    }
  }, [selectedTarget]);

  // Handle scroll events to show/hide scroll button
  const handleScroll = () => {
    if (scrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
      setShowScrollButton(!isNearBottom);
    }
  };

  // Add scroll event listener
  useEffect(() => {
    const scrollContainer = scrollRef.current;
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', handleScroll);
      // Initial check
      handleScroll();
      return () => scrollContainer.removeEventListener('scroll', handleScroll);
    }
  }, [filteredMessages]);

  // Scroll to bottom function
  const scrollToBottom = () => {
    if (scrollRef.current) {
      const container = scrollRef.current;
      // Force immediate scroll to bottom
      container.scrollTop = container.scrollHeight;
    }
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString();
    }
  };

  const groupMessagesByDate = (messages: ChatBody[]) => {
    const groups: { [key: string]: ChatBody[] } = {};
    
    messages.forEach((msg) => {
      const date = formatDate(msg.ts_ms);
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(msg);
    });
    
    return groups;
  };

  const groupedMessages = groupMessagesByDate(filteredMessages);

  if (!selectedTarget) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <motion.div 
          className="text-center"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <User size={40} className="text-white" />
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">Welcome to WiChain</h3>
          <p className="text-slate-400 mb-6">Select a conversation to start messaging</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Chat Header with Banner */}
        <motion.div
        className="relative h-48 bg-gradient-to-br from-blue-600/20 to-purple-600/20 overflow-hidden"
        initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* Random Wallpaper Background */}
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: randomWallpaper ? `url(${randomWallpaper})` : 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(147, 51, 234, 0.1) 100%)'
          }}
        >
          <div className="absolute inset-0 bg-black/40"></div>
          <div className="absolute inset-0 opacity-20" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%239C92AC' fill-opacity='0.1'%3E%3Ccircle cx='30' cy='30' r='2'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
          }}></div>
        </div>
        
        {/* Content */}
        <div className="relative z-10 p-6 h-full flex items-end">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center ring-4 ring-white/20 overflow-hidden">
              {selectedTarget.kind === 'group' ? (
                <img 
                  src={getRandomGroupProfilePicture(selectedTarget.id)} 
                  alt="Group" 
                  className="w-full h-full object-cover"
                />
              ) : (
                <img 
                  src={getRandomProfilePicture(selectedTarget.id)} 
                  alt="User" 
                  className="w-full h-full object-cover"
                />
              )}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">
                {selectedTarget.kind === 'group' 
                  ? groupDisplayName(groups.find(g => g.id === selectedTarget.id)!, aliasMap, myPubkeyB64)
                  : aliasMap[selectedTarget.id] || selectedTarget.id.slice(0, 8) + '...'
                }
              </h2>
              <p className="text-blue-100">
                {selectedTarget.kind === 'group' 
                  ? `${groups.find(g => g.id === selectedTarget.id)?.members.length || 0} members`
                  : ''
                }
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Messages */}
      <div 
        className="flex-1 overflow-y-auto p-4 relative" 
        ref={scrollRef}
        style={{ 
          scrollBehavior: 'auto',
          WebkitOverflowScrolling: 'touch',
          height: '100%',
          maxHeight: 'calc(100vh - 280px)',
          overscrollBehavior: 'contain',
          marginBottom: '80px'
        }}
      >
        <div className="space-y-6 pb-32 mobile-messages">
          <AnimatePresence>
            {Object.entries(groupedMessages).map(([date, dateMessages], dateIndex) => (
              <motion.div
                key={date}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: dateIndex * 0.1 }}
              >
                {/* Date Separator */}
                <div className="flex items-center justify-center my-6">
                  <div className="flex items-center space-x-4">
                    <div className="h-px bg-slate-700/50 flex-1 w-20"></div>
                    <span className="px-3 py-1 bg-slate-700/50 text-slate-300 text-xs rounded-full">
                      {date}
                    </span>
                    <div className="h-px bg-slate-700/50 flex-1 w-20"></div>
                  </div>
                </div>

                {/* Messages for this date */}
                <div className="space-y-4">
                  {dateMessages.map((message, messageIndex) => {
                    const isMe = message.from === myPubkeyB64;
                    const senderName = aliasMap[message.from] || message.from.slice(0, 8) + '...';
                    
                    return (
                      <motion.div
                        key={`${message.ts_ms}-${messageIndex}`}
                        className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ 
                          delay: (dateIndex * 0.1) + (messageIndex * 0.05),
                          type: "spring",
                          stiffness: 300,
                          damping: 30
                        }}
                      >
                        <div className={`flex items-end space-x-2 max-w-xs lg:max-w-md ${isMe ? 'flex-row-reverse space-x-reverse' : ''}`}>
                          {!isMe && (
                            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center ring-2 ring-slate-600/50 overflow-hidden">
                              <img 
                                src={getRandomProfilePicture(message.from)} 
                                alt="User" 
                                className="w-full h-full object-cover"
                              />
                            </div>
                          )}
                          
                          <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                            {!isMe && (
                              <span className="text-xs text-slate-400 mb-1 px-2">
                                {senderName}
                              </span>
                            )}
                            
                            <motion.div
                              className={`px-4 py-3 rounded-2xl ${
                                isMe 
                                  ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white' 
                                  : 'bg-slate-700/50 text-white'
                              }`}
                              whileHover={{ scale: 1.02 }}
                              transition={{ type: "spring", stiffness: 400 }}
                            >
                              {(() => {
                                // Check if message contains image data
                                const imageMatch = message.text.match(/\[IMAGE_DATA:(.+?)\]/);
                                if (imageMatch) {
                                  try {
                                    const imageData = JSON.parse(imageMatch[1]);
                                    const textWithoutImage = message.text.replace(/\[IMAGE_DATA:.+?\]/, '').trim();
                                    
                                    return (
                                      <div className="space-y-2">
                                        {textWithoutImage && (
                                          <p className="text-sm leading-relaxed">{textWithoutImage}</p>
                                        )}
                                        <div className="relative">
                                          <img 
                                            src={imageData.data} 
                                            alt={imageData.filename}
                                            className="max-w-xs max-h-64 rounded-lg object-cover cursor-pointer hover:opacity-90 transition-opacity"
                                            onClick={() => {
                                              // Open image in new tab
                                              const newWindow = window.open();
                                              if (newWindow) {
                                                newWindow.document.write(`
                                                  <html>
                                                    <head><title>${imageData.filename}</title></head>
                                                    <body style="margin:0;padding:20px;background:#000;display:flex;justify-content:center;align-items:center;min-height:100vh;">
                                                      <img src="${imageData.data}" style="max-width:100%;max-height:100%;object-fit:contain;" />
                                                    </body>
                                                  </html>
                                                `);
                                              }
                                            }}
                                          />
                                          <div className="text-xs text-white/70 mt-1">
                                            📷 {imageData.filename} 
                                            {imageData.compressedSize ? 
                                              ` (${Math.round(imageData.compressedSize / 1024)}KB compressed from ${Math.round(imageData.originalSize / 1024)}KB)` :
                                              ` (${Math.round(imageData.size / 1024)}KB)`
                                            }
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  } catch (error) {
                                    console.error('Error parsing image data:', error);
                                    return <p className="text-sm leading-relaxed">{message.text}</p>;
                                  }
                                }
                                
                                return <p className="text-sm leading-relaxed">{message.text}</p>;
                              })()}
                            </motion.div>
                            
                            <div className={`flex items-center space-x-1 mt-1 ${isMe ? 'flex-row-reverse space-x-reverse' : ''}`}>
                              <span className="text-xs text-slate-500">
                                {formatTime(message.ts_ms)}
                              </span>
                              {isMe && (
                                <div className="flex items-center">
                                  <CheckCheck size={12} className="text-blue-400" />
                </div>
              )}
              </div>
            </div>
                        </div>
                      </motion.div>
                    );
                  })}
          </div>
        </motion.div>
      ))}
          </AnimatePresence>

          {/* Empty State */}
          {filteredMessages.length === 0 && (
            <motion.div 
              className="text-center py-12"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              <div className="w-16 h-16 bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-4">
                <User size={24} className="text-slate-400" />
              </div>
              <h3 className="text-slate-400 font-medium mb-2">Text now!</h3>
              <p className="text-slate-500 text-sm">Start the conversation by sending a message</p>
            </motion.div>
          )}

          {/* Bottom Spacer to prevent overlap with input */}
          <div className="h-20"></div>
        </div>

        {/* Scroll to Bottom Button */}
        {showScrollButton && (
          <motion.button
            onClick={scrollToBottom}
            className="absolute bottom-4 right-4 w-12 h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg flex items-center justify-center transition-colors z-10"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <ArrowDown size={20} />
          </motion.button>
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
  if (g.name && g.name.trim()) {
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