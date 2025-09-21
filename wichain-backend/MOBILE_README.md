# WiChain Mobile App Development

This guide explains how to build and run WiChain as a mobile app using Tauri's mobile support.

## Prerequisites

### For Android Development
1. Install Android Studio
2. Install Android SDK (API level 21+)
3. Set up Android emulator or connect physical device
4. Enable Developer Options and USB Debugging on your device

### For iOS Development (macOS only)
1. Install Xcode (latest version)
2. Install Xcode Command Line Tools
3. Set up iOS Simulator or connect physical device
4. Sign in with Apple Developer account

## Installation

1. Install Tauri CLI with mobile support:
```bash
cargo install tauri-cli --version "^2.0.0-alpha" --locked
```

2. Install dependencies:
```bash
npm install
```

3. Build the frontend:
```bash
cd frontend && npm run build
```

## Development

### Android Development
```bash
# Start Android development server
npm run dev:android

# Build Android APK
npm run build:android
```

### iOS Development
```bash
# Start iOS development server
npm run dev:ios

# Build iOS app
npm run build:ios
```

## Mobile-Specific Features

### Responsive Design
- The app automatically adapts to mobile screens
- Touch-friendly interface with proper touch targets
- Mobile-optimized navigation and layouts

### Mobile CSS Classes
- `.mobile-hidden` - Hide elements on mobile
- `.mobile-full` - Full width/height on mobile
- `.sidebar-mobile` - Mobile sidebar layout
- `.message-input-mobile` - Fixed mobile input
- `.safe-area-top/bottom` - iOS safe area support
- `.mobile-scroll` - Optimized mobile scrolling

### Platform-Specific Features
- **iOS**: Safe area support, native scrolling
- **Android**: Touch optimization, keyboard handling

## Configuration

The mobile configuration is in `src-tauri/tauri.conf.json`:

```json
{
  "mobile": {
    "ios": {
      "bundleId": "com.wichain.app",
      "displayName": "WiChain",
      "minimumSystemVersion": "13.0"
    },
    "android": {
      "packageName": "com.wichain.app",
      "displayName": "WiChain",
      "minSdkVersion": 21,
      "targetSdkVersion": 34
    }
  }
}
```

## Building for Production

### Android
```bash
npm run build:android
```
This creates an APK in `src-tauri/gen/android/app/build/outputs/apk/`

### iOS
```bash
npm run build:ios
```
This creates an Xcode project in `src-tauri/gen/ios/`

## Troubleshooting

### Common Issues

1. **Android build fails**: Ensure Android SDK is properly installed
2. **iOS build fails**: Ensure Xcode is installed and updated
3. **Device not detected**: Check USB debugging settings
4. **App crashes on mobile**: Check console logs for errors

### Debug Commands
```bash
# Check Tauri version
npx tauri --version

# Check mobile targets
npx tauri android doctor
npx tauri ios doctor
```

## Features

- ✅ Cross-platform (iOS & Android)
- ✅ Native performance
- ✅ Offline-first messaging
- ✅ P2P networking
- ✅ Image sharing
- ✅ Group chats
- ✅ Responsive design
- ✅ Touch-optimized UI

## Next Steps

1. Test on physical devices
2. Optimize for different screen sizes
3. Add push notifications
4. Implement native features (camera, contacts)
5. Submit to app stores

For more information, visit the [Tauri Mobile Documentation](https://v2.tauri.app/blog/tauri-mobile-alpha/).
