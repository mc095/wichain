import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Mic, MicOff, Video, VideoOff, Phone } from 'lucide-react';

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
  const [peerConnection, setPeerConnection] = useState<RTCPeerConnection | null>(null);
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [connectionState, setConnectionState] = useState<'connecting' | 'connected' | 'failed'>('connecting');
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const hasCreatedOffer = useRef(false);

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
  }, [isOpen, onClose]);

  // Initialize WebRTC peer connection
  useEffect(() => {
    if (!localStream || peerConnection) return;

    const config: RTCConfiguration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' }
      ]
    };

    const pc = new RTCPeerConnection(config);

    // Add local stream tracks to connection
    localStream.getTracks().forEach(track => {
      pc.addTrack(track, localStream);
    });

    // Handle incoming tracks (remote video/audio)
    pc.ontrack = (event) => {
      console.log('📹 Received remote track!');
      if (remoteVideoRef.current && event.streams[0]) {
        remoteVideoRef.current.srcObject = event.streams[0];
        setConnectionState('connected');
      }
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('📡 Sending ICE candidate');
        onSignal({
          type: 'candidate',
          candidate: event.candidate
        });
      }
    };

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      console.log('🔄 Connection state:', pc.connectionState);
      switch (pc.connectionState) {
        case 'connected':
          setConnectionState('connected');
          break;
        case 'failed':
        case 'disconnected':
          setConnectionState('failed');
          break;
      }
    };

    // Handle ICE connection state
    pc.oniceconnectionstatechange = () => {
      console.log('🧊 ICE state:', pc.iceConnectionState);
      if (pc.iceConnectionState === 'failed') {
        setConnectionState('failed');
      }
    };

    setPeerConnection(pc);

    // If initiator, create offer
    if (isInitiator && !hasCreatedOffer.current) {
      hasCreatedOffer.current = true;
      pc.createOffer()
        .then(offer => {
          console.log('📤 Created offer');
          return pc.setLocalDescription(offer);
        })
        .then(() => {
          onSignal({
            type: 'offer',
            sdp: pc.localDescription
          });
        })
        .catch(err => {
          console.error('❌ Error creating offer:', err);
          setConnectionState('failed');
        });
    }

    return () => {
      pc.close();
    };
  }, [localStream, peerConnection, isInitiator, onSignal]);

  // Handle incoming signaling data
  useEffect(() => {
    if (!incomingSignal || !peerConnection) return;

    const handleSignal = async () => {
      try {
        if (incomingSignal.type === 'offer') {
          console.log('📥 Received offer');
          await peerConnection.setRemoteDescription(new RTCSessionDescription(incomingSignal.sdp));
          
          const answer = await peerConnection.createAnswer();
          await peerConnection.setLocalDescription(answer);
          
          console.log('📤 Sending answer');
          onSignal({
            type: 'answer',
            sdp: peerConnection.localDescription
          });
        } else if (incomingSignal.type === 'answer') {
          console.log('📥 Received answer');
          await peerConnection.setRemoteDescription(new RTCSessionDescription(incomingSignal.sdp));
        } else if (incomingSignal.type === 'candidate' && incomingSignal.candidate) {
          console.log('📥 Received ICE candidate');
          await peerConnection.addIceCandidate(new RTCIceCandidate(incomingSignal.candidate));
        }
      } catch (error) {
        console.error('❌ Error handling signal:', error);
      }
    };

    handleSignal();
  }, [incomingSignal, peerConnection, onSignal]);

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
    if (peerConnection) {
      peerConnection.close();
    }
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    onClose();
  }, [peerConnection, localStream, onClose]);

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
            🎥 Native WebRTC P2P • ✅ End-to-End Encrypted • 🌐 Offline LAN Mode
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
