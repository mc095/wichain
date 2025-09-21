import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  apiGetIdentity,
  apiSetAlias,
  apiGetPeers,
  apiGetChatHistory,
  apiAddPeerMessage,
  apiAddGroupMessage,
  apiResetData,
  apiCreateGroup,
  apiListGroups,
  apiGetWifiName,
  type Identity,
  type PeerInfo,
  type ChatBody,
  type GroupInfo,
} from './lib/api';
import { PeerList } from './components/PeerList';
import { ChatView } from './components/ChatView';
import { GroupModal } from './components/GroupModal';
import { Onboarding } from './components/Onboarding';
import { ResetConfirm } from './components/ResetConfirm';
import { listen } from '@tauri-apps/api/event';

import { motion, AnimatePresence } from 'framer-motion';
import { 
  MessageCircle, 
  Users, 
  Settings, 
  Plus, 
  Search, 
  Send,
  Hash,
  X,
  BarChart3,
  Power,
  Image,
  Paperclip,
  Menu,
  Phone,
  Video,
  Pin,
  MoreVertical,
  Lock
} from 'lucide-react';

type Target =
  | { kind: 'peer'; id: string }
  | { kind: 'group'; id: string }
  | null;

const onboardingSlides = [
  {
    id: 1,
    title: "Welcome to WiChain",
    subtitle: "The future of secure, decentralized messaging",
    icon: MessageCircle,
    description: "Experience the next generation of private communication with military-grade encryption and zero-knowledge architecture.",
    features: ["Decentralized Network", "End-to-End Encryption", "Zero-Knowledge Architecture"]
  },
  {
    id: 2,
    title: "End-to-End Encryption",
    subtitle: "Your messages are protected with military-grade AES-256-GCM encryption",
    icon: Lock as any,
    description: "Only you and your recipients can read your messages. Not even we can access your private conversations.",
    features: ["AES-256-GCM encryption", "Perfect forward secrecy", "Zero-knowledge architecture"]
  },
  {
    id: 3,
    title: "Decentralized Network",
    subtitle: "No central servers, no single point of failure",
    icon: Hash,
    description: "Built on a peer-to-peer network that ensures your messages are always available and never censored.",
    features: ["Peer-to-peer messaging", "No central servers", "Censorship resistant"]
  },
  {
    id: 4,
    title: "Ready to Start",
    subtitle: "Create your secure identity and begin messaging",
    icon: Users,
    description: "Set up your alias and start connecting with friends and colleagues in complete privacy.",
    features: ["Secure identity", "Group messaging", "File sharing"]
  }
];

export default function App() {
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [showSlideshow, setShowSlideshow] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [darkMode, setDarkMode] = useState(true);
  const [showStats, setShowStats] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAccountDialog, setShowAccountDialog] = useState(false);
  const [messagesSent, setMessagesSent] = useState(0);
  const [appStartTime] = useState(Date.now());
  const [wifiName, setWifiName] = useState('Unknown');

  const nextSlide = () => {
    if (currentSlide < onboardingSlides.length - 1) {
      setCurrentSlide(currentSlide + 1);
    } else {
      setShowSlideshow(false);
      setShowOnboarding(true);
    }
  };

  const prevSlide = () => {
    if (currentSlide > 0) {
      setCurrentSlide(currentSlide - 1);
    }
  };

  // Get WiFi name using real system API
  const getWifiName = useCallback(async () => {
    try {
      const wifiName = await apiGetWifiName();
      setWifiName(wifiName);
    } catch (error) {
      console.error('Failed to get WiFi name:', error);
      setWifiName('Unknown');
    }
  }, []);

  // Calculate uptime
  const getUptime = useCallback(() => {
    const now = Date.now();
    const uptimeMs = now - appStartTime;
    const hours = Math.floor(uptimeMs / (1000 * 60 * 60));
    const minutes = Math.floor((uptimeMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  }, [appStartTime]);


  const handleExit = useCallback(async () => {
    try {
      // In a real Tauri app, you'd use the exit command
      // For now, we'll just close the window
      if (window.confirm('Do you want to exit WiChain?')) {
        window.close();
      }
    } catch (error) {
      console.error('Failed to exit:', error);
    }
  }, []);

  const handleImageSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      // Check file size (limit to 5MB original, ~6.5MB base64)
      const MAX_SIZE = 5 * 1024 * 1024; // 5MB
      if (file.size > MAX_SIZE) {
        alert(`Image too large! Maximum size is ${MAX_SIZE / (1024 * 1024)}MB. Your image is ${(file.size / (1024 * 1024)).toFixed(1)}MB.`);
        return;
      }
      
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const removeImage = useCallback(() => {
    setSelectedImage(null);
    setImagePreview(null);
  }, []);

  const loadIdentity = useCallback(async () => {
    const id = await apiGetIdentity();
    setIdentity(id);
    if (id.alias.startsWith('Anon-')) {
      setShowSlideshow(true);
      setCurrentSlide(0);
    }
    // Load real-time data
    await getWifiName();
  }, [getWifiName]);

  useEffect(() => {
    loadIdentity();
  }, [loadIdentity]);

  // Update statistics periodically

  // Groups
  const [groups, setGroups] = useState<GroupInfo[]>([]);
  const refreshGroups = useCallback(() => {
    apiListGroups()
      .then((gs) => {
        setGroups(gs);
        setTarget((t) =>
          t?.kind === 'group' && !gs.some((g) => g.id === t.id) ? null : t,
        );
      })
      .catch(console.error);
  }, []);

  const [target, setTarget] = useState<Target>(null);

  useEffect(() => {
    const un = listen('alias_update', () => {
      loadIdentity();
      refreshGroups();
    });
    return () => {
      un.then((f) => f());
    };
  }, [loadIdentity, refreshGroups]);

  // Peers
  const [peers, setPeers] = useState<PeerInfo[]>([]);
  const refreshPeers = useCallback(() => {
    apiGetPeers()
      .then((p) => {
        setPeers(p);
        setTarget((t) =>
          t?.kind === 'peer' && !p.some((peer) => peer.id === t.id) ? null : t,
        );
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    refreshPeers();
    const unlistenPromise = listen('peer_update', () => {
      refreshPeers();
    });
    const interval = setInterval(refreshPeers, 5_000);
    return () => {
      clearInterval(interval);
      unlistenPromise.then((un) => un());
    };
  }, [refreshPeers]);

  // Groups effect
  useEffect(() => {
    refreshGroups();
    const unlistenPromise = listen('group_update', () => {
      refreshGroups();
    });
    return () => {
      unlistenPromise.then((un) => un());
    };
  }, [refreshGroups]);

  // Chat History
  const [messages, setMessages] = useState<ChatBody[]>([]);
  const refreshMessages = useCallback(() => {
    apiGetChatHistory().then(setMessages).catch(console.error);
  }, []);
  useEffect(() => {
    refreshMessages();
    const unlistenPromise = listen('chat_update', () => {
      refreshMessages();
    });
    const interval = setInterval(refreshMessages, 10_000);
    return () => {
      clearInterval(interval);
      unlistenPromise.then((un) => un());
    };
  }, [refreshMessages]);

  // Compose / Send
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const send = useCallback(async () => {
    const msg = text.trim();
    const hasImage = selectedImage !== null;
    
    if ((!msg && !hasImage) || !target) {
      return;
    }
    if (!identity) {
      return;
    }
    setSending(true);
    let ok = false;
    
    try {
      // Create message content
      let messageContent = msg;
      
      if (hasImage && selectedImage) {
        // Compress image before sending
        const compressImage = (file: File, maxWidth: number = 800, quality: number = 0.8): Promise<string> => {
          return new Promise((resolve) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new window.Image();
            
            img.onload = () => {
              // Calculate new dimensions
              let { width, height } = img;
              if (width > maxWidth) {
                height = (height * maxWidth) / width;
                width = maxWidth;
              }
              
              canvas.width = width;
              canvas.height = height;
              
              // Draw and compress
              ctx?.drawImage(img, 0, 0, width, height);
              const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
              resolve(compressedDataUrl);
            };
            
            img.src = URL.createObjectURL(file);
          });
        };
        
        try {
          const compressedImage = await compressImage(selectedImage);
          const imageData = {
            type: 'image',
            filename: selectedImage.name,
            data: compressedImage,
            originalSize: selectedImage.size,
            compressedSize: compressedImage.length,
            mimeType: 'image/jpeg'
          };
          
          // Check if compressed image is still too large
          const MAX_BASE64_SIZE = 6 * 1024 * 1024; // 6MB base64 limit
          if (compressedImage.length > MAX_BASE64_SIZE) {
            alert('Image is too large even after compression. Please choose a smaller image.');
            setSending(false);
            return;
          }
          
          // Send image data as JSON string
          const imageMessage = msg ? `${msg}\n[IMAGE_DATA:${JSON.stringify(imageData)}]` : `[IMAGE_DATA:${JSON.stringify(imageData)}]`;
          
          if (target.kind === 'peer') {
            ok = await apiAddPeerMessage(imageMessage, target.id);
          } else if (target.kind === 'group') {
            ok = await apiAddGroupMessage(imageMessage, target.id);
          }
          
          setSending(false);
          if (ok) {
            setText('');
            setSelectedImage(null);
            setImagePreview(null);
            setMessagesSent(prev => prev + 1);
            refreshMessages();
          } else {
            console.warn('Send failed (see backend log).');
          }
        } catch (error) {
          console.error('Error compressing image:', error);
          setSending(false);
          alert('Failed to process image. Please try again.');
        }
        return; // Exit early
      }
      
      // Send text message
      if (target.kind === 'peer') {
        ok = await apiAddPeerMessage(messageContent, target.id);
      } else if (target.kind === 'group') {
        ok = await apiAddGroupMessage(messageContent, target.id);
      }
      
      setSending(false);
      if (ok) {
        setText('');
        setSelectedImage(null);
        setImagePreview(null);
        setMessagesSent(prev => prev + 1);
        refreshMessages();
      } else {
        console.warn('Send failed (see backend log).');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setSending(false);
    }
  }, [text, target, identity, refreshMessages, selectedImage]);

  // Reset chat
  const [resetOpen, setResetOpen] = useState(false);
  async function doReset() {
    setResetOpen(false);
    const ok = await apiResetData();
    if (ok) {
      refreshMessages();
    }
  }

  // Onboarding
  async function onboardingDone(alias: string) {
    await apiSetAlias(alias);
    setShowOnboarding(false);
    setShowSlideshow(false);
    loadIdentity();
  }

  // Group modal
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const openGroupModal = () => setGroupModalOpen(true);
  const closeGroupModal = () => setGroupModalOpen(false);
  const createGroup = async (memberIds: string[]) => {
    const myPub = identity?.public_key_b64;
    if (!myPub) return;
    const full = Array.from(new Set([myPub, ...memberIds]));
    const gid = await apiCreateGroup(full);
    if (gid) {
      await refreshGroups();
      setTarget({ kind: 'group', id: gid });
    }
  };

  // Derived data
  const myPub = identity?.public_key_b64 ?? '';

  const aliasMap = useMemo(() => {
    const m: Record<string, string> = {};
    if (identity) m[identity.public_key_b64] = identity.alias;
    for (const p of peers) {
      m[p.id] = p.alias;
    }
    return m;
  }, [identity, peers]);

  const displayedPeers = peers.filter((p) => p.id !== myPub);

  const targetLabel = (() => {
    if (!target) return 'Select a peer or group…';
    if (target.kind === 'peer') {
      return aliasMap[target.id] ?? target.id.slice(0, 8) + '…';
    } else {
      const g = groups.find((gr) => gr.id === target.id);
      if (!g) return 'Group?';
      return groupDisplayName(g, aliasMap, myPub);
    }
  })();

  // Render
  if (showSlideshow && identity) {
    const currentSlideData = onboardingSlides[currentSlide];
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-slate-900 to-slate-700 flex items-center justify-center p-4">
        <div className="w-full max-w-xl">

          {/* Slide Content */}
          <motion.div
            key={currentSlide}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="text-center"
          >
            {/* Icon */}
            <motion.div
              className="w-20 h-20 bg-gradient-to-br from-slate-600 to-slate-800 rounded-full flex items-center justify-center mx-auto mb-6"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
            >
              <currentSlideData.icon size={32} className="text-white" />
            </motion.div>

            {/* Title */}
            <motion.h1
              className="text-3xl md:text-4xl font-display text-white mb-3"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.5 }}
            >
              {currentSlideData.title}
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              className="text-lg text-slate-300 mb-6 max-w-lg mx-auto"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.5 }}
            >
              {currentSlideData.subtitle}
            </motion.p>

            {/* Description */}
            <motion.p
              className="text-slate-400 mb-6 max-w-lg mx-auto leading-relaxed text-sm"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.5 }}
            >
              {currentSlideData.description}
            </motion.p>

            {/* Features */}
            <motion.div
              className="space-y-2 mb-8"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.5 }}
            >
              {currentSlideData.features.map((feature, index) => (
                <motion.div
                  key={feature}
                  className="flex items-center justify-center text-slate-300"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.7 + index * 0.1, duration: 0.3 }}
                >
                  <span className="text-sm">• {feature}</span>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>

          {/* Navigation */}
          <div className="flex items-center justify-center space-x-8">
            <button
              onClick={prevSlide}
              disabled={currentSlide === 0}
              className="px-4 py-2 bg-slate-700/50 text-white rounded-lg text-sm font-medium hover:bg-slate-700/70 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            >
              Previous
            </button>

            <div className="flex space-x-2">
              {onboardingSlides.map((_, index) => (
                <div
                  key={index}
                  className={`w-2 h-2 rounded-full transition-all duration-300 ${
                    index === currentSlide
                      ? 'bg-gradient-to-r from-slate-600 to-slate-800'
                      : 'bg-slate-600'
                  }`}
                />
              ))}
            </div>

            <button
              onClick={nextSlide}
              className="px-4 py-2 bg-gradient-to-r from-slate-600 to-slate-800 text-white rounded-lg text-sm font-semibold hover:from-slate-700 hover:to-slate-900 transition-all duration-200"
            >
              {currentSlide === onboardingSlides.length - 1 ? 'Get Started' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex h-screen text-white overflow-hidden ${darkMode ? 'bg-gradient-to-br from-black via-slate-900 to-slate-700' : 'bg-gradient-to-br from-gray-50 to-gray-100'}`}>
      {/* Left Sidebar - Global Navigation */}
      <motion.div 
        className="w-16 bg-slate-800/50 backdrop-blur-xl border-r border-slate-700/50 flex flex-col items-center py-4 space-y-4"
        initial={{ x: -100, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        {/* Logo */}
        <motion.div 
          className="w-10 h-10 bg-gradient-to-br from-slate-600 to-slate-800 rounded-xl flex items-center justify-center text-white font-bold text-lg"
          whileHover={{ scale: 1.1, rotate: 5 }}
          transition={{ type: "spring", stiffness: 300 }}
        >
          W
        </motion.div>

        {/* Navigation Items */}
        <div className="flex flex-col space-y-3">
          {[
            { icon: MessageCircle, label: "Messages", active: true, onClick: () => {} },
            { icon: Users, label: "People", active: false, onClick: () => {} },
            { icon: Plus, label: "Create Group", active: false, onClick: () => setGroupModalOpen(true) },
            { icon: Hash, label: "Account", active: false, onClick: () => setShowAccountDialog(true) },
            { icon: BarChart3, label: "Statistics", active: false, onClick: () => setShowStats(!showStats) },
          ].map((item, index) => (
            <motion.button
              key={item.label}
              onClick={item.onClick}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 ${
                item.active 
                  ? 'bg-gradient-to-br from-slate-600 to-slate-800 text-white shadow-lg' 
                  : `${darkMode ? 'text-slate-400 hover:text-white hover:bg-slate-700/50' : 'text-gray-600 hover:text-gray-800 hover:bg-gray-200/50'}`
              }`}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              title={item.label}
            >
              <item.icon size={20} />
            </motion.button>
          ))}
        </div>

        {/* Settings & Exit */}
        <div className="mt-auto space-y-3">
          <motion.button
            onClick={() => setShowSettings(!showSettings)}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 ${darkMode ? 'text-slate-400 hover:text-white hover:bg-slate-700/50' : 'text-gray-600 hover:text-gray-800 hover:bg-gray-200/50'}`}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            title="Settings"
          >
            <Settings size={20} />
          </motion.button>
          
          <motion.button
            onClick={handleExit}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 ${darkMode ? 'text-red-400 hover:text-red-300 hover:bg-red-900/20' : 'text-red-600 hover:text-red-700 hover:bg-red-100'}`}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            title="Exit App"
          >
            <Power size={20} />
          </motion.button>
        </div>

        {/* New Chat Button */}
        <motion.button
          className="w-10 h-10 bg-gradient-to-br from-slate-600 to-slate-800 rounded-xl flex items-center justify-center text-white shadow-lg"
          whileHover={{ scale: 1.1, rotate: 90 }}
          whileTap={{ scale: 0.95 }}
          onClick={openGroupModal}
          title="New Chat"
        >
          <Plus size={20} />
        </motion.button>
      </motion.div>

      {/* Chat List Sidebar */}
      <motion.div 
        className={`${sidebarOpen ? 'w-80' : 'w-0'} bg-slate-800/30 backdrop-blur-xl border-r border-slate-700/50 transition-all duration-300 overflow-hidden`}
        initial={{ width: 0 }}
        animate={{ width: sidebarOpen ? 320 : 0 }}
      >
        {sidebarOpen && (
          <div className="h-full flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-slate-700/50">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white">Chats</h2>
                <button
                  className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700/50 transition-colors"
                  onClick={() => setSidebarOpen(false)}
                >
                  <X size={16} />
                </button>
              </div>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search conversations..."
                  className="w-full pl-10 pr-4 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white placeholder-slate-400 focus:border-blue-500/50 focus:outline-none transition-colors"
                />
              </div>
            </div>

            {/* Chat List */}
            <div className="flex-1 overflow-y-auto">
              <PeerList
                peers={displayedPeers}
                groups={groups}
                aliasMap={aliasMap}
                myPub={myPub}
                selected={target}
                onSelectPeer={(id) => {
                  setTarget({ kind: 'peer', id });
                }}
                onSelectGroup={(id) => {
                  setTarget({ kind: 'group', id });
                }}
                messages={messages}
              />
            </div>
          </div>
        )}
      </motion.div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {target ? (
          <>
            {/* Chat Header */}
            <motion.div 
              className="bg-slate-800/50 backdrop-blur-xl border-b border-slate-700/50 p-4 flex items-center justify-between"
              initial={{ y: -50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              <div className="flex items-center space-x-4">
                {!sidebarOpen && (
                  <button
                    className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700/50 transition-colors"
                    onClick={() => setSidebarOpen(true)}
                  >
                    <Menu size={16} />
                  </button>
                )}
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                  <span className="text-white font-semibold text-sm">
                    {targetLabel.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <h3 className="text-white font-semibold">{targetLabel}</h3>
                  <p className="text-xs text-slate-400">
                    {target.kind === 'group' ? `${groups.find(g => g.id === target.id)?.members.length || 0} members` : 'Online'}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700/50 transition-colors">
                  <Search size={16} />
                </button>
                <button className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700/50 transition-colors">
                  <Phone size={16} />
                </button>
                <button className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700/50 transition-colors">
                  <Video size={16} />
                </button>
                <button className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700/50 transition-colors">
                  <Pin size={16} />
                </button>
                <button className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700/50 transition-colors">
                  <MoreVertical size={16} />
                </button>
              </div>
            </motion.div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-hidden">
              <ChatView
                messages={messages}
                myPubkeyB64={myPub}
                selectedTarget={target}
                aliasMap={aliasMap}
                groups={groups}
              />
            </div>

            {/* Image Preview */}
            {imagePreview && (
              <motion.div 
                className="bg-slate-800/50 backdrop-blur-xl border-t border-slate-700/50 p-4"
                initial={{ y: 50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.3 }}
              >
                <div className="relative inline-block">
                  <img 
                    src={imagePreview} 
                    alt="Preview" 
                    className="max-w-xs max-h-48 rounded-lg object-cover"
                  />
                  <button
                    onClick={removeImage}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
                  >
                    <X size={12} />
                  </button>
                </div>
              </motion.div>
            )}

            {/* Message Input */}
            <motion.div 
              className="bg-slate-800/50 backdrop-blur-xl border-t border-slate-700/50 p-4"
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              <div className="flex items-center space-x-3">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="hidden"
                  id="image-upload"
                />
                <label
                  htmlFor="image-upload"
                  className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700/50 transition-colors cursor-pointer"
                  title="Attach Image"
                >
                  <Image size={16} />
                </label>
                <input
                  type="text"
                  placeholder="Write a message..."
                  value={text}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setText(e.target.value)}
                  onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  disabled={sending || !target || !identity}
                  className="flex-1 px-4 py-3 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white placeholder-slate-400 focus:border-blue-500/50 focus:outline-none transition-colors disabled:opacity-50"
                />
                <button
                  className="px-4 py-3 bg-gradient-to-r from-slate-600 to-slate-800 text-white rounded-lg font-semibold hover:from-slate-700 hover:to-slate-900 disabled:opacity-50 transition-all duration-200 flex items-center space-x-2"
                  onClick={send}
                  disabled={sending || (!text.trim() && !selectedImage) || !target || !identity}
                >
                  {sending ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Send size={16} />
                  )}
                  <span>{sending ? 'Sending...' : 'Send'}</span>
                </button>
              </div>
            </motion.div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <motion.div 
              className="text-center"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
            >
              <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <MessageCircle size={40} className="text-white" />
              </div>
              <h3 className="text-xl font-display text-white mb-2">Welcome to WiChain</h3>
              <p className="text-slate-400 mb-6">Select a conversation to start messaging</p>
              <button
                className="px-6 py-3 bg-gradient-to-r from-slate-600 to-slate-800 text-white rounded-lg font-semibold hover:from-slate-700 hover:to-slate-900 transition-all duration-200 flex items-center space-x-2 mx-auto"
                onClick={openGroupModal}
              >
                <Plus size={16} />
                <span>Start New Chat</span>
              </button>
            </motion.div>
          </div>
        )}
      </div>

      {/* Right Sidebar - Chat Details */}
      {target && (
        <motion.div 
          className="w-80 bg-slate-800/30 backdrop-blur-xl border-l border-slate-700/50 p-4"
          initial={{ x: 100, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <div className="space-y-6">
            {/* Members Section */}
            <div>
              <h4 className="text-white font-semibold mb-3 flex items-center">
                <Users size={16} className="mr-2" />
                Members
              </h4>
              <div className="space-y-2">
                {target.kind === 'group' ? (
                  groups.find(g => g.id === target.id)?.members.map((memberId, index) => (
                    <motion.div 
                      key={memberId}
                      className="flex items-center space-x-3 p-2 rounded-lg hover:bg-slate-700/30 transition-colors"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                    >
                      <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                        <span className="text-white text-xs font-semibold">
                          {(aliasMap[memberId] || memberId).charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1">
                        <p className="text-white text-sm font-medium">
                          {aliasMap[memberId] || memberId.slice(0, 8) + '...'}
                          {memberId === myPub && " (You)"}
                        </p>
                        <p className="text-xs text-slate-400">Online</p>
                      </div>
                      {memberId === myPub && (
                        <span className="px-2 py-1 bg-blue-500/20 text-blue-300 text-xs rounded-full">
                          Admin
                        </span>
                      )}
                    </motion.div>
                  ))
                ) : (
                  <motion.div 
                    className="flex items-center space-x-3 p-2 rounded-lg"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                  >
                    <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center">
                      <span className="text-white text-xs font-semibold">
                        {(aliasMap[target.id] || target.id).charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1">
                      <p className="text-white text-sm font-medium">{aliasMap[target.id] || target.id.slice(0, 8) + '...'}</p>
                      <p className="text-xs text-green-400">Online</p>
                    </div>
                  </motion.div>
                )}
              </div>
            </div>

            <div className="h-px bg-slate-700/50"></div>

            {/* Files Section */}
            <div>
              <h4 className="text-white font-semibold mb-3 flex items-center">
                <Paperclip size={16} className="mr-2" />
                Files
              </h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-700/30 transition-colors cursor-pointer">
                  <span className="text-slate-400 text-sm">115 photos</span>
                  <span className="text-slate-500 text-xs">↗</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-700/30 transition-colors cursor-pointer">
                  <span className="text-slate-400 text-sm">208 files</span>
                  <span className="text-slate-500 text-xs">↗</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-700/30 transition-colors cursor-pointer">
                  <span className="text-slate-400 text-sm">47 shared links</span>
                  <span className="text-slate-500 text-xs">↗</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Modals */}
      <AnimatePresence>
        {showOnboarding && identity && (
          <Onboarding initialAlias={identity.alias} onDone={onboardingDone} />
        )}
      </AnimatePresence>

      <ResetConfirm
        open={resetOpen}
        onCancel={() => setResetOpen(false)}
        onConfirm={doReset}
        label="Reset Chat"
        body="This will clear your local chat history. Your device identity will be preserved."
      />
      
      <GroupModal
        open={groupModalOpen}
        onClose={closeGroupModal}
        peers={displayedPeers}
        aliasMap={aliasMap}
        onCreateGroup={createGroup}
      />

      {/* Settings Modal */}
      {showSettings && (
        <motion.div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setShowSettings(false)}
        >
          <motion.div
            className={`${darkMode ? 'bg-slate-800' : 'bg-white'} rounded-2xl p-6 w-full max-w-md mx-4`}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className={`text-xl font-display ${darkMode ? 'text-white' : 'text-gray-900'}`}>Settings</h2>
              <button
                onClick={() => setShowSettings(false)}
                className={`p-2 rounded-lg ${darkMode ? 'hover:bg-slate-700' : 'hover:bg-gray-100'}`}
              >
                <X size={20} className={darkMode ? 'text-slate-400' : 'text-gray-600'} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Dark Mode Toggle */}
              <div className="flex items-center justify-between">
                <span className={`${darkMode ? 'text-slate-300' : 'text-gray-700'}`}>Dark Mode</span>
                <button
                  onClick={() => setDarkMode(!darkMode)}
                  className={`w-12 h-6 rounded-full transition-colors ${
                    darkMode ? 'bg-gradient-to-r from-slate-600 to-slate-800' : 'bg-gray-300'
                  }`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
                    darkMode ? 'translate-x-6' : 'translate-x-0.5'
                  }`} />
                </button>
              </div>

              {/* Contact Admin */}
              <button className={`w-full p-3 rounded-lg ${darkMode ? 'bg-slate-700 hover:bg-slate-600' : 'bg-gray-100 hover:bg-gray-200'} transition-colors`}>
                <span className={darkMode ? 'text-slate-300' : 'text-gray-700'}>Contact Admin</span>
              </button>

              {/* App Info */}
              <div className={`p-3 rounded-lg ${darkMode ? 'bg-slate-700' : 'bg-gray-100'}`}>
                <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-gray-600'}`}>
                  WiChain v1.0.0
                </p>
                <p className={`text-xs ${darkMode ? 'text-slate-500' : 'text-gray-500'}`}>
                  Secure Decentralized Messaging
                </p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Account Dialog */}
      {showAccountDialog && (
        <motion.div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setShowAccountDialog(false)}
        >
          <motion.div
            className={`${darkMode ? 'bg-slate-800' : 'bg-white'} rounded-2xl p-6 w-full max-w-sm mx-4`}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className={`text-xl font-display ${darkMode ? 'text-white' : 'text-gray-900'}`}>Account Info</h2>
              <button
                onClick={() => setShowAccountDialog(false)}
                className={`p-2 rounded-lg ${darkMode ? 'hover:bg-slate-700' : 'hover:bg-gray-100'}`}
              >
                <X size={20} className={darkMode ? 'text-slate-400' : 'text-gray-600'} />
              </button>
            </div>

            <div className="text-center">
              {/* Account Avatar */}
              <div className="w-20 h-20 bg-gradient-to-br from-slate-600 to-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-white text-2xl font-bold">
                  {identity?.alias ? identity.alias.charAt(0).toUpperCase() : '?'}
                </span>
              </div>

              {/* Account Name */}
              <h3 className={`text-2xl font-display mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                {identity?.alias || 'Unknown User'}
              </h3>

              {/* Account Details */}
              <div className={`p-4 rounded-lg ${darkMode ? 'bg-slate-700' : 'bg-gray-100'} space-y-2`}>
                <div className="flex justify-between">
                  <span className={`text-sm ${darkMode ? 'text-slate-400' : 'text-gray-600'}`}>User ID:</span>
                  <span className={`text-sm font-mono ${darkMode ? 'text-slate-300' : 'text-gray-800'}`}>
                    {identity?.alias ? identity.alias.slice(0, 8) + '...' : 'Unknown'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className={`text-sm ${darkMode ? 'text-slate-400' : 'text-gray-600'}`}>Status:</span>
                  <span className="text-sm text-green-400">Online</span>
                </div>
                <div className="flex justify-between">
                  <span className={`text-sm ${darkMode ? 'text-slate-400' : 'text-gray-600'}`}>Joined:</span>
                  <span className={`text-sm ${darkMode ? 'text-slate-300' : 'text-gray-800'}`}>
                    {new Date().toLocaleDateString()}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-3 mt-6">
                <button
                  className={`flex-1 px-4 py-2 rounded-lg ${darkMode ? 'bg-slate-700 hover:bg-slate-600' : 'bg-gray-200 hover:bg-gray-300'} transition-colors`}
                  onClick={() => setShowAccountDialog(false)}
                >
                  <span className={`text-sm ${darkMode ? 'text-slate-300' : 'text-gray-700'}`}>Close</span>
                </button>
                <button
                  className={`flex-1 px-4 py-2 rounded-lg bg-gradient-to-r from-slate-600 to-slate-800 text-white hover:from-slate-700 hover:to-slate-900 transition-all duration-200`}
                  onClick={() => {
                    setShowAccountDialog(false);
                    setShowSettings(true);
                  }}
                >
                  <span className="text-sm">Settings</span>
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Statistics Panel */}
      {showStats && (
        <motion.div
          className="fixed top-4 right-4 bg-slate-800/90 backdrop-blur-xl border border-slate-700/50 rounded-xl p-4 w-80 z-40"
          initial={{ opacity: 0, x: 100 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 100 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-display">Statistics</h3>
            <button
              onClick={() => setShowStats(false)}
              className="p-1 rounded hover:bg-slate-700/50"
            >
              <X size={16} className="text-slate-400" />
            </button>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-slate-400 text-sm">Messages Sent:</span>
              <span className="text-white text-sm">{messagesSent}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400 text-sm">Peers Connected:</span>
              <span className="text-white text-sm">{peers.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400 text-sm">Groups:</span>
              <span className="text-white text-sm">{groups.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400 text-sm">Uptime:</span>
              <span className="text-white text-sm">{getUptime()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400 text-sm">WiFi Network:</span>
              <span className="text-blue-400 text-sm">{wifiName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400 text-sm">Account:</span>
              <span className="text-white text-sm">{identity?.alias || 'Unknown'}</span>
            </div>
          </div>
        </motion.div>
      )}
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