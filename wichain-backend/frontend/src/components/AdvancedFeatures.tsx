// 🚀 REVOLUTIONARY ADVANCED FEATURES FOR WICHAIN
// Location Sharing, Voice Messages, File Sharing, Screen Capture & MORE!

import { useState, useRef, useCallback } from 'react';
import { MapPin, Mic, File, Camera, Monitor, Video, Zap, Shield } from 'lucide-react';
import { motion } from 'framer-motion';

interface AdvancedFeaturesProps {
  onSendLocation: (location: GeolocationPosition) => void;
  onSendVoice: (audioBlob: Blob, duration: number) => void;
  onSendFile: (file: File) => void;
  onSendScreenshot: (imageData: string) => void;
  onSendPhoto: (imageData: string) => void;
  onStartVideoCall?: () => void;
  darkMode?: boolean;
}

export function AdvancedFeatures({ 
  onSendLocation, 
  onSendVoice, 
  onSendFile,
  onSendScreenshot,
  onSendPhoto,
  onStartVideoCall,
  darkMode = true 
}: AdvancedFeaturesProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // 📍 DEVICE GPS LOCATION SHARING (NOT IP-BASED!)
  const shareLocation = useCallback(() => {
    if (!navigator.geolocation) {
      alert('❌ Geolocation not supported by your browser!');
      return;
    }

    // Request permission first
    if (navigator.permissions) {
      navigator.permissions.query({ name: 'geolocation' }).then((result) => {
        console.log('📍 Geolocation permission:', result.state);
      });
    }

    // FORCE device GPS with high accuracy
    navigator.geolocation.getCurrentPosition(
      (position) => {
        console.log('✅ GPS Position:', position.coords);
        console.log('📍 Accuracy:', position.coords.accuracy, 'meters');
        console.log('🛰️ Altitude:', position.coords.altitude, 'meters');
        console.log('⚡ Speed:', position.coords.speed, 'm/s');
        
        onSendLocation(position);
        alert(`✅ GPS Location Shared!\nLat: ${position.coords.latitude.toFixed(6)}\nLon: ${position.coords.longitude.toFixed(6)}\nAccuracy: ±${Math.round(position.coords.accuracy)}m`);
      },
      (error) => {
        console.error('❌ Geolocation error:', error);
        let errorMsg = 'Failed to get GPS location: ';
        switch(error.code) {
          case error.PERMISSION_DENIED:
            errorMsg += 'Permission denied! Please allow location access.';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMsg += 'GPS unavailable! Make sure GPS is enabled.';
            break;
          case error.TIMEOUT:
            errorMsg += 'GPS timeout! Taking too long to get position.';
            break;
        }
        alert(`❌ ${errorMsg}`);
      },
      {
        enableHighAccuracy: true,  // FORCE GPS, not WiFi/IP
        timeout: 30000,            // 30 seconds for GPS to lock
        maximumAge: 0              // Don't use cached location
      }
    );
  }, [onSendLocation]);

  // 📷 CAMERA PHOTO CAPTURE (NOT SCREENSHOT!)
  const capturePhoto = useCallback(async () => {
    try {
      // Request camera access (front camera by default)
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'user',  // Front camera
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } 
      });
      
      const video = document.createElement('video');
      video.srcObject = stream;
      video.play();

      video.onloadedmetadata = () => {
        setTimeout(() => {
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(video, 0, 0);
            const imageData = canvas.toDataURL('image/jpeg', 0.9);
            onSendPhoto(imageData);
            
            // Stop camera
            stream.getTracks().forEach(track => track.stop());
            alert('✅ Photo captured from camera!');
          }
        }, 500); // Wait for camera to warm up
      };
    } catch (error) {
      console.error('Camera error:', error);
      alert('❌ Failed to access camera! Please allow camera permission.');
    }
  }, [onSendPhoto]);

  // 🎤 VOICE MESSAGES
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        onSendVoice(audioBlob, recordingDuration);
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
        
        // Reset state
        setIsRecording(false);
        setRecordingDuration(0);
        if (durationIntervalRef.current) {
          clearInterval(durationIntervalRef.current);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingDuration(0);

      // Start duration counter
      durationIntervalRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);

    } catch (error) {
      console.error('Error starting recording:', error);
      alert('❌ Failed to access microphone!');
    }
  }, [onSendVoice, recordingDuration]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
  }, [isRecording]);

  // 📁 FILE SHARING
  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Check file size (max 25MB for files)
      const MAX_SIZE = 25 * 1024 * 1024;
      if (file.size > MAX_SIZE) {
        alert(`❌ File too large! Max ${MAX_SIZE / (1024 * 1024)}MB. Your file: ${(file.size / (1024 * 1024)).toFixed(1)}MB`);
        return;
      }
      onSendFile(file);
      event.target.value = ''; // Reset input
    }
  }, [onSendFile]);

  // 📸 SCREEN CAPTURE
  const captureScreen = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ 
        video: true
      });
      
      const video = document.createElement('video');
      video.srcObject = stream;
      video.play();

      video.onloadedmetadata = () => {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0);
          const imageData = canvas.toDataURL('image/jpeg', 0.8);
          onSendScreenshot(imageData);
          
          // Stop all tracks
          stream.getTracks().forEach(track => track.stop());
          alert('✅ Screenshot captured!');
        }
      };
    } catch (error) {
      console.error('Screen capture error:', error);
      alert('❌ Screen capture cancelled or not supported');
    }
  }, [onSendScreenshot]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center space-x-2">
      {/* Location Share Button */}
      <motion.button
        onClick={shareLocation}
        className={`p-2 rounded-lg transition-colors ${
          darkMode 
            ? 'text-green-400 hover:text-green-300 hover:bg-green-900/20' 
            : 'text-green-600 hover:text-green-500 hover:bg-green-100'
        }`}
        title="Share Location 📍"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
      >
        <MapPin size={20} />
      </motion.button>

      {/* Voice Message Button */}
      <motion.button
        onClick={isRecording ? stopRecording : startRecording}
        className={`p-2 rounded-lg transition-colors ${
          isRecording
            ? 'text-red-400 hover:text-red-300 bg-red-900/20 animate-pulse'
            : darkMode
            ? 'text-blue-400 hover:text-blue-300 hover:bg-blue-900/20'
            : 'text-blue-600 hover:text-blue-500 hover:bg-blue-100'
        }`}
        title={isRecording ? `Recording... ${formatDuration(recordingDuration)}` : 'Record Voice Message 🎤'}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
      >
        <Mic size={20} />
      </motion.button>

      {/* File Share Button */}
      <div className="relative">
        <input
          type="file"
          onChange={handleFileSelect}
          className="hidden"
          id="advanced-file-upload"
        />
        <motion.label
          htmlFor="advanced-file-upload"
          className={`p-2 rounded-lg transition-colors cursor-pointer inline-block ${
            darkMode 
              ? 'text-purple-400 hover:text-purple-300 hover:bg-purple-900/20' 
              : 'text-purple-600 hover:text-purple-500 hover:bg-purple-100'
          }`}
          title="Share File 📁"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
        >
          <File size={20} />
        </motion.label>
      </div>

      {/* Camera Photo Button (Front Camera!) */}
      <motion.button
        onClick={capturePhoto}
        className={`p-2 rounded-lg transition-colors ${
          darkMode 
            ? 'text-pink-400 hover:text-pink-300 hover:bg-pink-900/20' 
            : 'text-pink-600 hover:text-pink-500 hover:bg-pink-100'
        }`}
        title="Take Photo 📷 (Front Camera)"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
      >
        <Camera size={20} />
      </motion.button>

      {/* Screen Capture Button */}
      <motion.button
        onClick={captureScreen}
        className={`p-2 rounded-lg transition-colors ${
          darkMode 
            ? 'text-orange-400 hover:text-orange-300 hover:bg-orange-900/20' 
            : 'text-orange-600 hover:text-orange-500 hover:bg-orange-100'
        }`}
        title="Capture Screenshot 🖥️"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
      >
        <Monitor size={20} />
      </motion.button>

      {/* Video Call Button */}
      {onStartVideoCall && (
        <motion.button
          onClick={onStartVideoCall}
          className={`p-2 rounded-lg transition-colors ${
            darkMode 
              ? 'text-red-400 hover:text-red-300 hover:bg-red-900/20' 
              : 'text-red-600 hover:text-red-500 hover:bg-red-100'
          }`}
          title="Start Video Call 📹"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
        >
          <Video size={20} />
        </motion.button>
      )}

      {/* Recording Indicator */}
      {isRecording && (
        <motion.div
          className="flex items-center space-x-2 px-3 py-1 bg-red-900/30 rounded-full text-red-400"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          <span className="text-xs font-mono">{formatDuration(recordingDuration)}</span>
        </motion.div>
      )}
    </div>
  );
}

// 🎯 TYPING INDICATOR
export function TypingIndicator({ userName }: { userName: string }) {
  return (
    <motion.div
      className="flex items-center space-x-2 px-4 py-2 bg-slate-700/30 rounded-full text-slate-400"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
    >
      <span className="text-xs">{userName} is typing</span>
      <div className="flex space-x-1">
        <motion.div
          className="w-2 h-2 bg-blue-400 rounded-full"
          animate={{ y: [0, -5, 0] }}
          transition={{ duration: 0.6, repeat: Infinity, delay: 0 }}
        />
        <motion.div
          className="w-2 h-2 bg-blue-400 rounded-full"
          animate={{ y: [0, -5, 0] }}
          transition={{ duration: 0.6, repeat: Infinity, delay: 0.2 }}
        />
        <motion.div
          className="w-2 h-2 bg-blue-400 rounded-full"
          animate={{ y: [0, -5, 0] }}
          transition={{ duration: 0.6, repeat: Infinity, delay: 0.4 }}
        />
      </div>
    </motion.div>
  );
}

// ⚡ MESSAGE REACTIONS
export function MessageReactions({ reactions, onReact }: { 
  reactions: { [emoji: string]: number }, 
  onReact: (emoji: string) => void 
}) {
  const quickReactions = ['❤️', '👍', '😂', '😮', '😢', '🔥'];

  return (
    <div className="flex items-center space-x-1 flex-wrap gap-1">
      {quickReactions.map(emoji => (
        <motion.button
          key={emoji}
          onClick={() => onReact(emoji)}
          className={`px-2 py-1 rounded-full text-sm hover:bg-slate-600/50 transition-colors ${
            reactions[emoji] ? 'bg-blue-900/30' : 'bg-slate-700/30'
          }`}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
        >
          {emoji} {reactions[emoji] || ''}
        </motion.button>
      ))}
    </div>
  );
}

// 🔐 BLOCKCHAIN VERIFICATION BADGE
export function BlockchainBadge({ verified }: { verified: boolean }) {
  return (
    <motion.div
      className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-xs ${
        verified 
          ? 'bg-green-900/30 text-green-400' 
          : 'bg-slate-700/30 text-slate-400'
      }`}
      whileHover={{ scale: 1.05 }}
      title={verified ? 'Verified on blockchain' : 'Verification pending'}
    >
      <Shield size={12} />
      <span>{verified ? 'Verified' : 'Pending'}</span>
    </motion.div>
  );
}

// ⏱️ DISAPPEARING MESSAGE TIMER
export function DisappearingTimer({ expiresIn }: { expiresIn: number }) {
  const percentage = (expiresIn / 60) * 100; // Assuming 60s max

  return (
    <motion.div
      className="flex items-center space-x-2 text-xs text-yellow-400"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <Zap size={12} />
      <span>Expires in {expiresIn}s</span>
      <div className="w-20 h-1 bg-slate-700 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-yellow-400"
          initial={{ width: '100%' }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 1 }}
        />
      </div>
    </motion.div>
  );
}
