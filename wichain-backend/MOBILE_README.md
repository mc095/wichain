# WiChain Mobile App Development

This guide explains how to build and run WiChain as a mobile app using Capacitor (recommended) or Tauri's mobile support.

## Current Status

**Tauri Mobile**: Currently in alpha and has compatibility issues with the current setup.
**Recommended**: Use Capacitor for mobile development (see below).

## Option 1: Capacitor (Recommended)

### Prerequisites
1. Install Node.js and npm
2. For Android: Install Android Studio and Android SDK
3. For iOS: Install Xcode (macOS only)

### Setup
```bash
# Install Capacitor
cd frontend
npm install @capacitor/core @capacitor/cli
npx cap init "WiChain" "com.wichain.app" --web-dir=dist

# Add platforms
npm install @capacitor/android @capacitor/ios
npx cap add android
npx cap add ios

# Build and sync
npm run build
npx cap sync
```

### Development
```bash
# Android
npx cap run android

# iOS
npx cap run ios
```

## Option 2: Tauri Mobile (Alpha)

**Note**: This requires Tauri 2.0 alpha which has compatibility issues.

### Prerequisites
1. Install Tauri CLI alpha version
2. Update dependencies to alpha versions
3. Configure mobile settings

### Setup
```bash
# Install alpha CLI
cargo install tauri-cli --version "^2.0.0-alpha" --locked

# Update dependencies
npm install @tauri-apps/cli@next @tauri-apps/api@next
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
