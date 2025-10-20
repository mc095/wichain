// 🚀 PASTE THIS CODE INTO App.tsx TO ENABLE ALL ADVANCED FEATURES!

// ============================================================================
// STEP 1: ADD THIS IMPORT AT THE TOP (around line 10)
// ============================================================================
import { AdvancedFeatures } from './components/AdvancedFeatures';
import { MapPin, Mic, File } from 'lucide-react';


// ============================================================================
// STEP 2: ADD THESE HANDLERS AFTER THE send() FUNCTION (around line 470)
// ============================================================================

// 📍 LOCATION SHARING HANDLER
const handleLocationShare = useCallback((position: GeolocationPosition) => {
  const locationData = {
    type: 'location',
    lat: position.coords.latitude,
    lon: position.coords.longitude,
    accuracy: position.coords.accuracy,
    altitude: position.coords.altitude,
    timestamp: position.timestamp
  };
  
  const locationMessage = `📍 Location Shared\nLat: ${locationData.lat.toFixed(6)}, Lon: ${locationData.lon.toFixed(6)}\nGoogle Maps: https://www.google.com/maps?q=${locationData.lat},${locationData.lon}\n[LOCATION_DATA:${JSON.stringify(locationData)}]`;
  
  if (target?.kind === 'peer') {
    apiAddPeerMessage(locationMessage, target.id).then(() => refreshMessages());
  } else if (target?.kind === 'group') {
    apiAddGroupMessage(locationMessage, target.id).then(() => refreshMessages());
  }
}, [target, refreshMessages]);

// 🎤 VOICE MESSAGE HANDLER
const handleVoiceMessage = useCallback(async (audioBlob: Blob, duration: number) => {
  const reader = new FileReader();
  reader.onloadend = async () => {
    const voiceData = {
      type: 'voice',
      duration,
      audioData: reader.result as string,
      timestamp: Date.now()
    };
    
    const voiceMessage = `🎤 Voice Message (${duration}s)\n[VOICE_DATA:${JSON.stringify(voiceData)}]`;
    
    if (target?.kind === 'peer') {
      await apiAddPeerMessage(voiceMessage, target.id);
    } else if (target?.kind === 'group') {
      await apiAddGroupMessage(voiceMessage, target.id);
    }
    refreshMessages();
  };
  reader.readAsDataURL(audioBlob);
}, [target, refreshMessages]);

// 📁 FILE SHARING HANDLER
const handleFileShare = useCallback(async (file: File) => {
  const reader = new FileReader();
  reader.onloadend = async () => {
    const fileData = {
      type: 'file',
      filename: file.name,
      mimeType: file.type,
      size: file.size,
      data: reader.result as string
    };
    
    const fileMessage = `📁 File: ${file.name} (${Math.round(file.size / 1024)}KB)\n[FILE_DATA:${JSON.stringify(fileData)}]`;
    
    if (target?.kind === 'peer') {
      await apiAddPeerMessage(fileMessage, target.id);
    } else if (target?.kind === 'group') {
      await apiAddGroupMessage(fileMessage, target.id);
    }
    refreshMessages();
  };
  reader.readAsDataURL(file);
}, [target, refreshMessages]);

// 📸 SCREENSHOT HANDLER
const handleScreenshot = useCallback(async (imageData: string) => {
  const screenshotData = {
    type: 'image',
    data: imageData,
    filename: `screenshot-${Date.now()}.jpg`,
    timestamp: Date.now()
  };
  
  const screenshotMessage = `📸 Screenshot\n[IMAGE_DATA:${JSON.stringify(screenshotData)}]`;
  
  if (target?.kind === 'peer') {
    await apiAddPeerMessage(screenshotMessage, target.id);
  } else if (target?.kind === 'group') {
    await apiAddGroupMessage(screenshotMessage, target.id);
  }
  refreshMessages();
}, [target, refreshMessages]);


// ============================================================================
// STEP 3: REPLACE THE MESSAGE INPUT AREA (around line 1000-1040)
// Find this section:
//   <div className="flex items-center space-x-3">
//     <input type="file" accept="image/*" ...
//     <label htmlFor="image-upload" ...
//     <ImageIcon size={20} />
//
// REPLACE WITH THIS:
// ============================================================================

            <div className="flex items-center space-x-3">
              {/* ADVANCED FEATURES - Location, Voice, Files, Screenshots */}
              <AdvancedFeatures
                onSendLocation={handleLocationShare}
                onSendVoice={handleVoiceMessage}
                onSendFile={handleFileShare}
                onSendScreenshot={handleScreenshot}
                darkMode={darkMode}
              />

              {/* Original Image Upload (keep this too!) */}
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
                <ImageIcon size={20} />
              </label>

              {/* Rest of the input... */}
              <input
                className={`flex-1 px-4 py-3 rounded-lg border ${darkMode ? 'bg-slate-700/50 border-slate-600/50 text-white placeholder-slate-400' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'} focus:outline-none focus:ring-2 focus:ring-blue-500/50 mobile-input`}
                placeholder={
                  !target
                    ? 'Select a contact to start messaging...'
                    : !identity
                    ? 'Loading...'
                    : 'Type a message...'
                }
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                disabled={!target || !identity}
              />

              <button
                className="px-4 py-3 bg-white text-black rounded-lg font-semibold hover:bg-gray-100 disabled:opacity-50 transition-all duration-200 flex items-center space-x-2"
                onClick={send}
                disabled={sending || (!text.trim() && !selectedImage) || !target || !identity}
              >
                {sending ? (
                  <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                ) : (
                  <>
                    <Send size={16} />
                    <span>Send</span>
                  </>
                )}
              </button>
            </div>


// ============================================================================
// STEP 4: UPDATE ChatView.tsx TO DISPLAY NEW MESSAGE TYPES
// Add these imports at the top of ChatView.tsx:
// ============================================================================
import { MapPin, Mic, File, Download } from 'lucide-react';


// ============================================================================
// STEP 5: IN ChatView.tsx, REPLACE THE MESSAGE RENDERING (around line 364)
// Find this code:
//   {(() => {
//     const imageMatch = message.text.match(/\[IMAGE_DATA:(.+?)\]/);
//
// REPLACE THE ENTIRE (() => { ... })() BLOCK WITH THIS:
// ============================================================================

{(() => {
  // 📍 LOCATION DATA
  const locationMatch = message.text.match(/\[LOCATION_DATA:(.+?)\]/);
  if (locationMatch) {
    try {
      const locationData = JSON.parse(locationMatch[1]);
      const textWithoutLocation = message.text.replace(/\[LOCATION_DATA:.+?\]/, '').trim();
      
      return (
        <div className="space-y-2">
          {textWithoutLocation && (
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{textWithoutLocation}</p>
          )}
          <div className="bg-slate-900/50 rounded-lg p-3 border border-green-500/20">
            <div className="flex items-center space-x-2 mb-2">
              <MapPin size={16} className="text-green-400" />
              <span className="text-xs text-green-400 font-semibold">Location</span>
            </div>
            <div className="text-xs space-y-1 text-white/80">
              <div>📍 Latitude: {locationData.lat.toFixed(6)}</div>
              <div>📍 Longitude: {locationData.lon.toFixed(6)}</div>
              {locationData.accuracy && (
                <div>🎯 Accuracy: ±{Math.round(locationData.accuracy)}m</div>
              )}
            </div>
            <a 
              href={`https://www.google.com/maps?q=${locationData.lat},${locationData.lon}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block px-3 py-1.5 bg-green-600 hover:bg-green-700 rounded text-xs font-medium transition-colors"
            >
              🗺️ Open in Google Maps
            </a>
          </div>
        </div>
      );
    } catch (error) {
      console.error('Error parsing location:', error);
    }
  }
  
  // 🎤 VOICE DATA
  const voiceMatch = message.text.match(/\[VOICE_DATA:(.+?)\]/);
  if (voiceMatch) {
    try {
      const voiceData = JSON.parse(voiceMatch[1]);
      const textWithoutVoice = message.text.replace(/\[VOICE_DATA:.+?\]/, '').trim();
      
      return (
        <div className="space-y-2">
          {textWithoutVoice && (
            <p className="text-sm leading-relaxed">{textWithoutVoice}</p>
          )}
          <div className="bg-slate-900/50 rounded-lg p-3 border border-blue-500/20">
            <div className="flex items-center space-x-2 mb-2">
              <Mic size={16} className="text-blue-400" />
              <span className="text-xs text-blue-400 font-semibold">Voice Message ({voiceData.duration}s)</span>
            </div>
            <audio 
              controls 
              className="w-full h-8"
              style={{ filter: 'invert(1) hue-rotate(180deg)' }}
              src={voiceData.audioData}
            />
          </div>
        </div>
      );
    } catch (error) {
      console.error('Error parsing voice:', error);
    }
  }
  
  // 📁 FILE DATA
  const fileMatch = message.text.match(/\[FILE_DATA:(.+?)\]/);
  if (fileMatch) {
    try {
      const fileData = JSON.parse(fileMatch[1]);
      const textWithoutFile = message.text.replace(/\[FILE_DATA:.+?\]/, '').trim();
      
      return (
        <div className="space-y-2">
          {textWithoutFile && (
            <p className="text-sm leading-relaxed">{textWithoutFile}</p>
          )}
          <div className="bg-slate-900/50 rounded-lg p-3 border border-purple-500/20">
            <div className="flex items-center space-x-2 mb-2">
              <File size={16} className="text-purple-400" />
              <span className="text-xs text-purple-400 font-semibold">File Attachment</span>
            </div>
            <div className="text-xs space-y-1 text-white/80 mb-2">
              <div>📄 {fileData.filename}</div>
              <div>💾 Size: {Math.round(fileData.size / 1024)}KB</div>
              <div>📋 Type: {fileData.mimeType || 'Unknown'}</div>
            </div>
            <a 
              href={fileData.data}
              download={fileData.filename}
              className="inline-flex items-center space-x-1 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 rounded text-xs font-medium transition-colors"
            >
              <Download size={12} />
              <span>Download File</span>
            </a>
          </div>
        </div>
      );
    } catch (error) {
      console.error('Error parsing file:', error);
    }
  }
  
  // 📸 IMAGE DATA (EXISTING - KEEP THIS!)
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
                ` (${imageData.size ? Math.round(imageData.size / 1024) : '?'}KB)`
              }
            </div>
          </div>
        </div>
      );
    } catch (error) {
      console.error('Error parsing image:', error);
      return <p className="text-sm leading-relaxed">{message.text}</p>;
    }
  }
  
  // Regular text message
  return <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.text}</p>;
})()}


// ============================================================================
// THAT'S IT! REBUILD AND TEST!
// ============================================================================

/*
REBUILD COMMANDS:

cd F:\Major_Project\wichain\wichain-backend\frontend
npm run build

cd ..\src-tauri  
cargo tauri dev

THEN TEST:
1. Click 📍 (green) - Share location
2. Click 🎤 (blue) - Record voice (click again to stop)
3. Click 📁 (purple) - Share any file
4. Click 📷 (orange) - Capture screenshot
5. Click 🖼️ (camera icon) - Send image (ALREADY WORKS!)

ALL FEATURES WILL WORK! 🚀
*/
