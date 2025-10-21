import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Mic, MicOff, Video, VideoOff, Phone } from 'lucide-react';
// @ts-ignore - Install with: npm install simple-peer @types/simple-peer
import SimplePeer from 'simple-peer';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  peerAlias: string;
  isInitiator: boolean;
  onSignal: (signalData: any) => void;
  incomingSignal?: any;
}

export function VideoCallWindow({
  isOpen,
  onClose,
  peerAlias,
  isInitiator,
  onSignal,
  incomingSignal
}: Props) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [peer, setPeer] = useState<SimplePeer.Instance | null>(null);
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [connectionState, setConnectionState] = useState<'connecting' | 'connected' | 'failed'>('connecting');
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  // Initialize local media stream
  useEffect(() => {
    if (!isOpen) return;

    const initMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 1280, height: 720 },
          audio: true
        });
        
        setLocalStream(stream);
        
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      } catch (error) {
        console.error('Failed to get media stream:', error);
        alert('❌ Could not access camera/microphone!\n\nPlease grant permissions and try again.');
        onClose();
      }
    };

    initMedia();

    return () => {
      // Cleanup
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [isOpen]);

  // Initialize WebRTC peer connection
  useEffect(() => {
    if (!localStream || peer) return;

    try {
      const newPeer = new SimplePeer({
        initiator: isInitiator,
        stream: localStream,
        trickle: true,
        config: {
          // LAN-only config (no STUN/TURN servers needed for same network!)
          iceServers: [
            // Optional: Can work without this on LAN
            { urls: 'stun:stun.l.google.com:19302' }
          ]
        }
      });

      // Send signaling data to peer via WiChain messages
      newPeer.on('signal', (data: SimplePeer.SignalData) => {
        console.log('📡 Sending signal data:', data.type);
        onSignal(data);
      });

      // Receive remote video stream
      newPeer.on('stream', (remoteStream: MediaStream) => {
        console.log('📹 Received remote stream!');
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStream;
        }
        setConnectionState('connected');
      });

      // Handle connection state
      newPeer.on('connect', () => {
        console.log('✅ WebRTC connection established!');
        setConnectionState('connected');
      });

      newPeer.on('error', (err: Error) => {
        console.error('❌ WebRTC error:', err);
        setConnectionState('failed');
      });

      newPeer.on('close', () => {
        console.log('📴 WebRTC connection closed');
        onClose();
      });

      setPeer(newPeer);
    } catch (error) {
      console.error('Failed to create peer:', error);
      setConnectionState('failed');
    }
  }, [localStream, isInitiator, onSignal]);

  // Handle incoming signaling data
  useEffect(() => {
    if (incomingSignal && peer && !peer.destroyed) {
      try {
        console.log('📡 Received signal data:', incomingSignal.type);
        peer.signal(incomingSignal);
      } catch (error) {
        console.error('Error processing signal:', error);
      }
    }
  }, [incomingSignal, peer]);

  // Toggle microphone
  const toggleMic = useCallback(() => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setMicEnabled(audioTrack.enabled);
      }
    }
  }, [localStream]);

  // Toggle camera
  const toggleCamera = useCallback(() => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setCameraEnabled(videoTrack.enabled);
      }
    }
  }, [localStream]);

  // End call
  const endCall = useCallback(() => {
    if (peer) {
      peer.destroy();
    }
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    onClose();
  }, [peer, localStream, onClose]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="relative w-full h-full max-w-7xl max-h-screen p-4 flex flex-col"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: "spring", duration: 0.5 }}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-4 px-4 py-3 bg-slate-900/80 backdrop-blur-xl rounded-2xl border border-slate-700/50">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold">
                {peerAlias[0]?.toUpperCase() || 'P'}
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">{peerAlias}</h2>
                <p className="text-xs text-slate-400">
                  {connectionState === 'connecting' && '📡 Connecting...'}
                  {connectionState === 'connected' && '✅ Connected'}
                  {connectionState === 'failed' && '❌ Connection Failed'}
                </p>
              </div>
            </div>
            
            <button
              onClick={endCall}
              className="p-2 rounded-full hover:bg-slate-800 transition-colors"
              title="Close"
            >
              <X className="w-6 h-6 text-slate-400" />
            </button>
          </div>

          {/* Video Container */}
          <div className="flex-1 relative rounded-2xl overflow-hidden bg-slate-900 border border-slate-700/50">
            {/* Remote Video (Full Screen) */}
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="absolute inset-0 w-full h-full object-cover"
            />
            
            {/* Connection overlay */}
            {connectionState === 'connecting' && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4"></div>
                  <p className="text-white text-lg">Establishing connection...</p>
                  <p className="text-slate-400 text-sm mt-2">WebRTC P2P • Offline LAN</p>
                </div>
              </div>
            )}

            {/* Local Video (Picture-in-Picture) */}
            <motion.div
              className="absolute top-4 right-4 w-64 h-48 rounded-xl overflow-hidden border-2 border-slate-700 shadow-2xl"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover transform -scale-x-100"
              />
              {!cameraEnabled && (
                <div className="absolute inset-0 bg-slate-900 flex items-center justify-center">
                  <VideoOff className="w-12 h-12 text-slate-400" />
                </div>
              )}
              <div className="absolute bottom-2 left-2 bg-black/60 px-2 py-1 rounded text-xs text-white">
                You
              </div>
            </motion.div>
          </div>

          {/* Controls */}
          <motion.div
            className="mt-4 flex items-center justify-center space-x-4 px-4 py-4 bg-slate-900/80 backdrop-blur-xl rounded-2xl border border-slate-700/50"
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            {/* Microphone Toggle */}
            <motion.button
              onClick={toggleMic}
              className={`p-4 rounded-full transition-all ${
                micEnabled
                  ? 'bg-slate-700 hover:bg-slate-600 text-white'
                  : 'bg-red-600 hover:bg-red-700 text-white'
              }`}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              title={micEnabled ? 'Mute' : 'Unmute'}
            >
              {micEnabled ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
            </motion.button>

            {/* Camera Toggle */}
            <motion.button
              onClick={toggleCamera}
              className={`p-4 rounded-full transition-all ${
                cameraEnabled
                  ? 'bg-slate-700 hover:bg-slate-600 text-white'
                  : 'bg-red-600 hover:bg-red-700 text-white'
              }`}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              title={cameraEnabled ? 'Turn off camera' : 'Turn on camera'}
            >
              {cameraEnabled ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
            </motion.button>

            {/* End Call */}
            <motion.button
              onClick={endCall}
              className="p-4 rounded-full bg-red-600 hover:bg-red-700 text-white transition-all"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              title="End call"
            >
              <Phone className="w-6 h-6 transform rotate-135" />
            </motion.button>
          </motion.div>

          {/* Status Info */}
          <div className="mt-2 text-center text-xs text-slate-500">
            🎥 WebRTC P2P Video Call • ✅ End-to-End Encrypted • 🌐 Offline LAN Mode
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
