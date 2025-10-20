import { useEffect, useState, useCallback, useMemo } from 'react';
import './mobile.css';
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
import { isMobilePlatform, isTauriAvailable, getMockIdentity, shouldShowOnboarding, markOnboardingComplete } from './lib/mobile-detection';
// Conditional Tauri import - won't crash on mobile
let tauriListen: any = null;
try {
  if (isTauriAvailable()) {
    tauriListen = require('@tauri-apps/api/event').listen;
  }
} catch (e) {
  console.warn('Tauri not available (running on mobile)');
}
import { getRandomProfilePicture } from './utils/profilePictures';

import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageCircle,
  Settings,
  Plus,
  Search,
  Send,
  Hash,
  X,
  BarChart3,
  Power,
  Image,
  Menu,
  Trash2
} from 'lucide-react';

type Target =
  | { kind: 'peer'; id: string }
  | { kind: 'group'; id: string }
  | null;

const onboardingSlides = [
  {
    id: 1,
    title: "WiChain",
    subtitle: "Secure messaging reimagined for the decentralized era.",
    icon: null,
    description: "Secure messaging reimagined for the decentralized era.",
    features: []
  },
  {
    id: 2,
    title: "",
    subtitle: "Your conversations, encrypted by design, accessible only to you.",
    icon: null,
    description: "Your conversations, encrypted by design, accessible only to you.",
    features: []
  },
  {
    id: 3,
    title: "",
    subtitle: "No servers, no surveillance—just pure peer-to-peer connection.",
    icon: null,
    description: "No servers, no surveillance—just pure peer-to-peer connection.",
    features: []
  },
  {
    id: 4,
    title: "",
    subtitle: "Your identity, your privacy, your control—always.",
    icon: null,
    description: "Your identity, your privacy, your control—always.",
    features: []
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
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editAlias, setEditAlias] = useState('');
  const [appStartTime] = useState(Date.now());

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
    try {
      let id;
      if (isMobilePlatform() && !isTauriAvailable()) {
        // Mobile without backend - use mock identity
        const stored = localStorage.getItem('mobile_identity');
        if (stored) {
          id = JSON.parse(stored);
        } else {
          id = getMockIdentity();
          localStorage.setItem('mobile_identity', JSON.stringify(id));
        }
      } else {
        // Desktop with Tauri backend
        id = await apiGetIdentity();
      }
      
      setIdentity(id);
      
      // Check if should show onboarding
      if (shouldShowOnboarding(id.alias)) {
        setShowSlideshow(true);
        setCurrentSlide(0);
      }
    } catch (error) {
      console.error('Failed to load identity:', error);
      // Fallback to mock identity on error
      const mockId = getMockIdentity();
      setIdentity(mockId);
      setShowSlideshow(true);
    }
  }, []);

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
    // Only listen to Tauri events on desktop
    if (tauriListen) {
      const un = tauriListen('alias_update', () => {
        loadIdentity();
        refreshGroups();
      });
      return () => {
        un.then((f: any) => f());
      };
    }
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
    const interval = setInterval(refreshPeers, 5_000);
    
    // Only listen to Tauri events on desktop
    let unlistenPromise: any = null;
    if (tauriListen) {
      unlistenPromise = tauriListen('peer_update', () => {
        refreshPeers();
      });
    }
    
    return () => {
      clearInterval(interval);
      if (unlistenPromise) {
        unlistenPromise.then((un: any) => un());
      }
    };
  }, [refreshPeers]);

  // Groups effect
  useEffect(() => {
    refreshGroups();
    
    // Only listen to Tauri events on desktop
    let unlistenPromise: any = null;
    if (tauriListen) {
      unlistenPromise = tauriListen('group_update', () => {
        refreshGroups();
      });
    }
    return () => {
      if (unlistenPromise) {
        unlistenPromise.then((un: any) => un());
      }
    };
  }, [refreshGroups]);

  // Chat History
  const [messages, setMessages] = useState<ChatBody[]>([]);
  const refreshMessages = useCallback(() => {
    apiGetChatHistory().then(setMessages).catch(console.error);
  }, []);
  useEffect(() => {
    refreshMessages();
    const interval = setInterval(refreshMessages, 10_000);
    
    // Only listen to Tauri events on desktop
    let unlistenPromise: any = null;
    if (tauriListen) {
      unlistenPromise = tauriListen('chat_update', () => {
        refreshMessages();
      });
    }
    
    return () => {
      clearInterval(interval);
      if (unlistenPromise) {
        unlistenPromise.then((un: any) => un());
      }
    };
  }, [refreshMessages]);

  // Compose / Send
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [leftPanelWidth, setLeftPanelWidth] = useState(320); // Increased from default
  const [isResizing, setIsResizing] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Check for mobile screen size
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 'b':
            e.preventDefault();
            setSidebarOpen(!sidebarOpen);
            break;
          case 'k':
            e.preventDefault();
            if (sidebarOpen) {
              const query = prompt('Search conversations...');
              if (query !== null) {
                setSearchQuery(query);
              }
            }
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [sidebarOpen]);
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

  // Clear current chat
  const clearCurrentChat = useCallback(async () => {
    if (!target) return;

    if (window.confirm('Are you sure you want to clear this chat? This action cannot be undone.')) {
      const ok = await apiResetData();
      if (ok) {
        refreshMessages();
        setTarget(null);
      } else {
        console.warn('Clear chat failed (see backend log).');
      }
    }
  }, [target, refreshMessages]);



  // Profile editing functions

  const handleSaveProfile = useCallback(async () => {
    if (!identity) return;

    try {
      // Just save alias
      const success = await apiSetAlias(editAlias);
      if (success) {
        loadIdentity();
        setIsEditingProfile(false);
        setEditAlias('');
      } else {
        alert('Failed to save profile. Please try again.');
      }
    } catch (error) {
      console.error('Profile save failed:', error);
      alert('Failed to save profile. Please try again.');
    }
  }, [identity, editAlias, loadIdentity]);

  const handleCancelEdit = useCallback(() => {
    setIsEditingProfile(false);
    setEditAlias('');
  }, []);

  // Resize handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isResizing || isMobile) return;

    const newWidth = e.clientX;
    const minWidth = isMobile ? 280 : 250;
    const maxWidth = isMobile ? 350 : 500;

    if (newWidth >= minWidth && newWidth <= maxWidth) {
      setLeftPanelWidth(newWidth);
    }
  };

  const handleMouseUp = () => {
    setIsResizing(false);
  };

  // Add event listeners for resizing
  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    } else {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing]);

  // Onboarding
  async function onboardingDone(alias: string) {
    markOnboardingComplete();
    setShowOnboarding(false);
    setShowSlideshow(false);
    
    if (isMobilePlatform() && !isTauriAvailable()) {
      // Update mobile mock identity
      const stored = localStorage.getItem('mobile_identity');
      if (stored) {
        const id = JSON.parse(stored);
        id.alias = alias;
        localStorage.setItem('mobile_identity', JSON.stringify(id));
        setIdentity(id);
      }
    } else {
      // Update via backend
      await apiSetAlias(alias);
      await loadIdentity();
    }
  }

  // Group modal
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const openGroupModal = () => setGroupModalOpen(true);
  const closeGroupModal = () => setGroupModalOpen(false);
  
  // Suppress unused warning - openGroupModal will be used for creating groups from peer list
  void openGroupModal;
  const createGroup = async (memberIds: string[], groupName?: string) => {
    const myPub = identity?.public_key_b64;
    if (!myPub) return;
    const full = Array.from(new Set([myPub, ...memberIds]));
    const gid = await apiCreateGroup(full, groupName);
    if (gid) {
      // Set target immediately for better UX
      setTarget({ kind: 'group', id: gid });
      // Refresh groups in background
      refreshGroups();
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
      <div className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden">
        {/* Video Background */}
        <video
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
          style={{ filter: 'brightness(0.35)' }}
        >
          <source src="/intro-vid/intro.mp4" type="video/mp4" />
        </video>

        {/* Overlay */}
        <div className="absolute inset-0 bg-black/30"></div>

        <div className="w-full h-full relative z-10 flex flex-col">

          {/* Navigation Buttons - Bottom on mobile, top on desktop */}
          <div className="fixed md:absolute bottom-8 md:top-8 md:bottom-auto left-4 right-4 md:left-8 md:right-8 flex items-center justify-between gap-2 pointer-events-none z-20">
            <button
              onClick={prevSlide}
              disabled={currentSlide === 0}
              className="px-4 py-2 md:px-6 md:py-3 bg-white/10 backdrop-blur-sm text-white rounded-full text-xs md:text-sm font-grotesk hover:bg-white/20 disabled:opacity-0 disabled:cursor-not-allowed transition-all duration-300 pointer-events-auto border border-white/20"
              style={{ fontWeight: 400 }}
            >
              ← Previous
            </button>

            <div className="flex-1 flex justify-end">
              <button
                onClick={nextSlide}
                className="px-4 py-2 md:px-6 md:py-3 bg-white text-black rounded-full text-xs md:text-sm font-grotesk hover:bg-white/90 transition-all duration-300 pointer-events-auto"
                style={{ fontWeight: 500 }}
              >
                {currentSlide === onboardingSlides.length - 1 ? 'Get Started →' : 'Next →'}
              </button>
            </div>
          </div>

          {/* Center Content */}
          <div className="flex-1 flex items-center justify-center">

            {/* Slide Content */}
            <motion.div
              key={currentSlide}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -30 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="text-center px-8 max-w-5xl w-full"
            >
              {/* Title - Only for first slide */}
              {currentSlideData.title && (
                <motion.h1
                  className="text-6xl md:text-8xl text-white mb-6"
                  style={{
                    fontFamily: 'Doto, sans-serif',
                    fontWeight: 600,
                    letterSpacing: '0.08em'
                  }}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2, duration: 0.6 }}
                >
                  {currentSlideData.title}
                </motion.h1>
              )}

              {/* Subtitle */}
              <motion.p
                className="text-2xl md:text-3xl font-grotesk text-gray-300 mb-8 max-w-4xl mx-auto leading-relaxed"
                style={{
                  fontWeight: 300,
                  letterSpacing: '-0.02em'
                }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: currentSlideData.title ? 0.4 : 0.2, duration: 0.6 }}
              >
                {currentSlideData.subtitle}
              </motion.p>
            </motion.div>
          </div>

        </div>
      </div>
    );
  }

  return (
    <div className={`flex h-screen overflow-hidden mobile-scroll ${darkMode ? 'space-background text-white' : 'light-background text-gray-900'} ${isResizing ? 'select-none' : ''}`}>
      {/* Mobile Sidebar Backdrop Overlay */}
      {isMobile && sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-[9998]"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      
      {/* Left Sidebar - Global Navigation */}
      <motion.div
        className={`w-16 backdrop-blur-xl border-r flex flex-col items-center py-4 space-y-4 ${darkMode ? 'bg-slate-800/50 border-slate-700/50' : 'bg-white/50 border-gray-200/50'}`}
        initial={{ x: -100, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        {/* Logo */}
        <motion.div
          className="w-10 h-10 bg-black rounded-xl flex items-center justify-center text-white font-bold text-lg border border-white/10"
          whileHover={{ scale: 1.1, rotate: 5 }}
          transition={{ type: "spring", stiffness: 300 }}
        >
          W
        </motion.div>

        {/* Navigation Items */}
        <div className="flex flex-col space-y-3">
          {[
            { icon: MessageCircle, label: "Messages", active: true, onClick: () => { } },
            { icon: Plus, label: "Create Group", active: false, onClick: () => setGroupModalOpen(true) },
            { icon: Hash, label: "Account", active: false, onClick: () => setShowAccountDialog(true) },
            { icon: BarChart3, label: "Statistics", active: false, onClick: () => setShowStats(!showStats) },
          ].map((item, index) => (
            <motion.button
              key={item.label}
              onClick={item.onClick}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 ${item.active
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
          className="w-10 h-10 bg-black rounded-xl flex items-center justify-center text-white border border-white/10"
          whileHover={{ scale: 1.1, rotate: 90 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setSidebarOpen(true)}
          title="New Chat"
        >
          <Plus size={20} />
        </motion.button>
      </motion.div>

      {/* Chat List Sidebar */}
      <motion.div
        className={`${sidebarOpen ? '' : 'w-0'} backdrop-blur-xl border-r transition-all duration-300 overflow-hidden relative mobile-scroll ${isMobile ? 'sidebar-mobile' : ''} ${darkMode ? 'bg-slate-800/30 border-slate-700/50' : 'bg-white/30 border-gray-200/50'}`}
        style={{ width: sidebarOpen ? `${isMobile ? 300 : leftPanelWidth}px` : '0px' }}
        initial={{ width: 0 }}
        animate={{ width: sidebarOpen ? (isMobile ? 300 : leftPanelWidth) : 0 }}
      >
        {/* Resize Handle */}
        {sidebarOpen && !isMobile && (
          <div
            className="absolute top-0 right-0 w-1 h-full bg-slate-600/50 hover:bg-slate-500/70 cursor-col-resize z-10 group"
            onMouseDown={handleMouseDown}
          >
            <div className="absolute top-1/2 right-1 transform translate-x-2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="bg-slate-800 text-white text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap">
                {leftPanelWidth}px • Drag to resize
              </div>
            </div>
          </div>
        )}

        {sidebarOpen && (
          <div className="h-full flex flex-col">
            {/* Header */}
            <div className={`p-4 border-b ${darkMode ? 'border-slate-700/50' : 'border-gray-200/50'}`}>
              <div className="flex items-center justify-between mb-4">
                <h2 className={`text-lg font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Chats</h2>
                <button
                  className={`p-2 rounded-lg transition-colors ${darkMode ? 'text-slate-400 hover:text-white hover:bg-slate-700/50' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/50'}`}
                  onClick={() => setSidebarOpen(false)}
                >
                  <X size={16} />
                </button>
              </div>
              <div className="relative">
                <Search size={16} className={`absolute left-3 top-1/2 transform -translate-y-1/2 ${darkMode ? 'text-slate-400' : 'text-gray-500'}`} />
                <input
                  type="text"
                  placeholder="Search conversations..."
                  className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none transition-colors ${darkMode ? 'bg-slate-700/50 border-slate-600/50 text-white placeholder-slate-400 focus:border-blue-500/50' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:border-blue-500'}`}
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
                  if (isMobile) setSidebarOpen(false); // Close sidebar on mobile after selection
                }}
                onSelectGroup={(id) => {
                  setTarget({ kind: 'group', id });
                  if (isMobile) setSidebarOpen(false); // Close sidebar on mobile after selection
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
              className={`backdrop-blur-xl border-b p-4 flex items-center justify-between ${darkMode ? 'bg-slate-800/50 border-slate-700/50' : 'bg-white/50 border-gray-200/50'}`}
              initial={{ y: -50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              <div className="flex items-center space-x-4">
                {!sidebarOpen && (
                  <button
                    className={`p-2 rounded-lg transition-colors ${darkMode ? 'text-slate-400 hover:text-white hover:bg-slate-700/50' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/50'}`}
                    onClick={() => setSidebarOpen(true)}
                  >
                    <Menu size={16} />
                  </button>
                )}
                <div className="w-10 h-10 bg-black rounded-full flex items-center justify-center border border-white/20">
                  <span className="text-white font-semibold text-sm">
                    {targetLabel.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <h3 className={`font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{targetLabel}</h3>
                  <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>
                    {target.kind === 'group' ? `${groups.find(g => g.id === target.id)?.members.length || 0} members` : ''}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => {
                    if (searchQuery) {
                      setSearchQuery('');
                    } else {
                      const query = prompt('Search messages...');
                      if (query !== null) {
                        setSearchQuery(query);
                      }
                    }
                  }}
                  className={`p-2 rounded-lg transition-colors ${searchQuery
                    ? 'text-blue-400 hover:text-blue-300 bg-blue-900/20 hover:bg-blue-900/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                    }`}
                  title={searchQuery ? 'Clear Search' : 'Search Messages'}
                >
                  {searchQuery ? <X size={16} /> : <Search size={16} />}
                </button>
                <button
                  onClick={clearCurrentChat}
                  className="p-2 text-red-400 hover:text-red-300 rounded-lg hover:bg-red-900/20 transition-colors"
                  title="Clear Chat"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </motion.div>

            {/* Search Results Indicator */}
            {searchQuery && (
              <div className="px-4 py-2 bg-blue-900/20 border-b border-blue-700/30">
                <p className="text-blue-300 text-sm">
                  🔍 Searching for: "{searchQuery}"
                </p>
              </div>
            )}

            {/* Chat Messages */}
            <div className="flex-1 overflow-hidden">
              <ChatView
                messages={messages}
                myPubkeyB64={myPub}
                selectedTarget={target}
                aliasMap={aliasMap}
                groups={groups}
                searchQuery={searchQuery}
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
              className={`backdrop-blur-xl border-t p-4 ${isMobile ? 'message-input-mobile safe-area-bottom' : ''} ${darkMode ? 'bg-slate-800/50 border-slate-700/50' : 'bg-white/50 border-gray-200/50'}`}
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
                  className={`p-2 rounded-lg transition-colors cursor-pointer ${darkMode ? 'text-slate-400 hover:text-white hover:bg-slate-700/50' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/50'}`}
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
                  className={`flex-1 px-4 py-3 border rounded-lg focus:outline-none transition-colors disabled:opacity-50 ${darkMode ? 'bg-slate-700/50 border-slate-600/50 text-white placeholder-slate-400 focus:border-blue-500/50' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:border-blue-500'}`}
                />
                <button
                  className="px-4 py-3 bg-white text-black rounded-lg font-semibold hover:bg-gray-100 disabled:opacity-50 transition-all duration-200 flex items-center space-x-2"
                  onClick={send}
                  disabled={sending || (!text.trim() && !selectedImage) || !target || !identity}
                >
                  {sending ? (
                    <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
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
              <h3 className={`text-xl font-display mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>Welcome to WiChain</h3>
              <p className={`mb-6 ${darkMode ? 'text-slate-400' : 'text-gray-600'}`}>Select a conversation to start messaging</p>
              <button
                className="px-6 py-3 bg-white text-black rounded-lg font-grotesk font-medium hover:bg-gray-100 transition-all duration-200 flex items-center space-x-2 mx-auto"
                onClick={() => setSidebarOpen(true)}
              >
                <Plus size={16} />
                <span>Start New Chat</span>
              </button>
            </motion.div>
          </div>
        )}
      </div>


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
                  className={`w-12 h-6 rounded-full transition-colors ${darkMode ? 'bg-gradient-to-r from-slate-600 to-slate-800' : 'bg-gray-300'
                    }`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full transition-transform ${darkMode ? 'translate-x-6' : 'translate-x-0.5'
                    }`} />
                </button>
              </div>

              {/* Contact Admin */}
              <a
                href="mailto:ganeshvahumilli@gmail.com"
                className={`w-full p-3 rounded-lg ${darkMode ? 'bg-slate-700 hover:bg-slate-600' : 'bg-gray-100 hover:bg-gray-200'} transition-colors block text-center`}
              >
                <span className={darkMode ? 'text-slate-300' : 'text-gray-700'}>Contact Admin</span>
              </a>

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
            className={`${darkMode ? 'bg-slate-800' : 'bg-white'} rounded-2xl p-6 w-full max-w-md mx-4`}
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
              <div className="relative w-24 h-24 mx-auto mb-4">
                <div className="w-24 h-24 bg-black rounded-full flex items-center justify-center overflow-hidden border border-white/20">
                  <img
                    src={getRandomProfilePicture(identity?.public_key_b64 || 'default')}
                    alt="Profile"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>

              {/* Account Name */}
              {isEditingProfile ? (
                <div className="mb-4">
                  <input
                    type="text"
                    value={editAlias}
                    onChange={(e) => setEditAlias(e.target.value)}
                    placeholder="Enter new name"
                    className={`w-full px-4 py-2 rounded-lg border ${darkMode
                      ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-400'
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                      } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  />
                </div>
              ) : (
                <h3 className={`text-2xl font-display mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                  {identity?.alias || 'Unknown User'}
                </h3>
              )}

              {/* Account Details */}
              <div className={`p-4 rounded-lg ${darkMode ? 'bg-slate-700' : 'bg-gray-100'} space-y-2 mb-6`}>
                <div className="flex justify-between">
                  <span className={`text-sm ${darkMode ? 'text-slate-400' : 'text-gray-600'}`}>User ID:</span>
                  <span className={`text-sm font-mono ${darkMode ? 'text-slate-300' : 'text-gray-800'}`}>
                    {identity?.alias ? identity.alias.slice(0, 8) + '...' : 'Unknown'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className={`text-sm ${darkMode ? 'text-slate-400' : 'text-gray-600'}`}>Joined:</span>
                  <span className={`text-sm ${darkMode ? 'text-slate-300' : 'text-gray-800'}`}>
                    {new Date().toLocaleDateString()}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-3">
                {isEditingProfile ? (
                  <>
                    <button
                      className={`flex-1 px-4 py-2 rounded-lg ${darkMode ? 'bg-slate-700 hover:bg-slate-600' : 'bg-gray-200 hover:bg-gray-300'} transition-colors`}
                      onClick={handleCancelEdit}
                    >
                      <span className={`text-sm ${darkMode ? 'text-slate-300' : 'text-gray-700'}`}>Cancel</span>
                    </button>
                    <button
                      className="flex-1 px-4 py-2 rounded-lg bg-white text-black hover:bg-gray-100 transition-all duration-200"
                      onClick={handleSaveProfile}
                    >
                      <span className="text-sm">Save</span>
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      className={`flex-1 px-4 py-2 rounded-lg ${darkMode ? 'bg-slate-700 hover:bg-slate-600' : 'bg-gray-200 hover:bg-gray-300'} transition-colors`}
                      onClick={() => setShowAccountDialog(false)}
                    >
                      <span className={`text-sm ${darkMode ? 'text-slate-300' : 'text-gray-700'}`}>Close</span>
                    </button>
                    <button
                      className="flex-1 px-4 py-2 rounded-lg bg-black text-white hover:bg-gray-900 transition-all duration-200"
                      onClick={() => {
                        setEditAlias(identity?.alias || '');
                        setIsEditingProfile(true);
                      }}
                    >
                      <span className="text-sm">Edit Profile</span>
                    </button>
                  </>
                )}
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