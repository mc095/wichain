# 🍎 iOS APP SETUP - Complete Guide

## ⚠️ REQUIREMENTS

**You MUST have:**
- ✅ **macOS** (iOS development only works on Mac)
- ✅ **Xcode** (latest version from App Store)
- ✅ **Apple Developer Account** ($99/year for App Store, FREE for testing on your own devices)

**Can't build iOS on Windows!** You need a Mac or MacBook.

---

## 🚀 STEP-BY-STEP iOS SETUP

### **Step 1: Install Xcode**

1. Open **App Store** on Mac
2. Search for **Xcode**
3. Click **Install** (15 GB download, 30-45 min)
4. Wait for installation to complete

### **Step 2: Install Xcode Command Line Tools**

```bash
xcode-select --install
```

Click **Install** when prompt appears.

### **Step 3: Install CocoaPods**

```bash
sudo gem install cocoapods
```

Enter your Mac password when prompted.

### **Step 4: Accept Xcode License**

```bash
sudo xcodebuild -license accept
```

### **Step 5: Install iOS Rust Targets**

```bash
rustup target add aarch64-apple-ios
rustup target add aarch64-apple-ios-sim
rustup target add x86_64-apple-ios
```

### **Step 6: Verify Setup**

```bash
# Check Xcode
xcodebuild -version

# Check CocoaPods
pod --version

# Check Rust targets
rustup target list | grep ios
```

---

## 📱 INITIALIZE iOS PROJECT

### **Step 1: Navigate to Project**

```bash
cd /path/to/wichain/wichain-backend/src-tauri
```

### **Step 2: Initialize iOS**

```bash
cargo tauri ios init
```

**Answer prompts:**
- App name: `WiChain`
- Bundle identifier: `com.wichain.app`
- Deployment target: `13.0` (iOS 13+)

**Creates:**
- `src-tauri/gen/apple/` - iOS/macOS project
- Xcode workspace
- Swift bridge code

### **Step 3: Open in Xcode**

```bash
cargo tauri ios open
```

Or manually:
```bash
open gen/apple/WiChain.xcodeproj
```

---

## 🔐 CODE SIGNING (iOS)

### **For Testing on Your Own iPhone (FREE):**

1. **Open Xcode**
2. Select project in left sidebar
3. Go to **Signing & Capabilities** tab
4. Check **Automatically manage signing**
5. Select your **Apple ID** in Team dropdown
6. If no Apple ID:
   - Click **Add Account**
   - Sign in with your Apple ID (free)
   - No $99/year needed for personal device testing!

### **For App Store Distribution ($99/year):**

1. Join **Apple Developer Program**: https://developer.apple.com/programs/
2. Pay $99/year
3. In Xcode:
   - Select your **paid developer team**
   - Xcode handles signing automatically

---

## 📱 BUILD & RUN ON iPhone

### **Step 1: Connect iPhone**

1. Connect iPhone to Mac via USB
2. iPhone shows: "Trust This Computer?"
3. Tap **Trust**
4. Enter iPhone passcode

### **Step 2: Select Device in Xcode**

1. Top bar shows device selector
2. Click and select your iPhone
3. Should show: "YourName's iPhone"

### **Step 3: Trust Developer Certificate (First Time)**

After building, iPhone shows:
- Settings → General → VPN & Device Management
- Tap your Apple ID
- Tap **Trust**

### **Step 4: Build & Run**

**Option A: Xcode**
```bash
cargo tauri ios open
```
In Xcode, click ▶️ Play button (or Cmd+R)

**Option B: Command Line**
```bash
cargo tauri ios dev
```

**First build:** 10-20 minutes  
**Subsequent:** 2-5 minutes

---

## 🏗️ BUILD TYPES

### **Debug Build (Development):**

```bash
cargo tauri ios build
```

**Output:** `src-tauri/gen/apple/build/Debug-iphoneos/WiChain.app`

### **Release Build (Production):**

```bash
cargo tauri ios build --release
```

**Output:** `src-tauri/gen/apple/build/Release-iphoneos/WiChain.app`

---

## 📦 DISTRIBUTION OPTIONS

### **1. TestFlight (Beta Testing)**

**Requirements:**
- Paid Apple Developer Account ($99/year)
- App uploaded to App Store Connect

**Steps:**
1. Archive app in Xcode:
   - Product → Archive
   - Wait for archive to complete
2. Click **Distribute App**
3. Select **App Store Connect**
4. Upload to TestFlight
5. Share beta link with testers

**Pros:**
- ✅ Easy to share with testers
- ✅ Up to 10,000 testers
- ✅ Auto-updates
- ✅ Crash reports

### **2. Ad Hoc Distribution**

**Requirements:**
- Paid Apple Developer Account
- Device UDIDs registered

**For:** Limited distribution (up to 100 devices/year)

### **3. Enterprise Distribution**

**Requirements:**
- Apple Enterprise Account ($299/year)

**For:** Internal company apps (not for public)

### **4. App Store**

**Requirements:**
- Paid Apple Developer Account
- App Review approval

**Steps:**
1. Archive in Xcode
2. Upload to App Store Connect
3. Submit for review
4. Wait 1-3 days for approval
5. Release to public

---

## 🔧 DEVELOPMENT WORKFLOW

### **Hot Reload Development:**

**Terminal 1 - Start frontend:**
```bash
cd wichain-backend/frontend
npm run dev
```

**Terminal 2 - Run on iPhone:**
```bash
cd wichain-backend/src-tauri
cargo tauri ios dev
```

**OR just:**
```bash
cargo tauri ios dev
```
(Tauri auto-starts frontend)

### **Rebuild After Code Changes:**

**Rust changes:**
```bash
cargo tauri ios build
```

**Frontend changes:**
- Auto-reloads if dev server running

**iOS native changes:**
- Rebuild in Xcode (Cmd+B)

---

## 🐛 TROUBLESHOOTING

### **"No signing identity found"**

**Solution:**
1. Xcode → Preferences → Accounts
2. Add your Apple ID
3. Download Manual Profiles
4. Try again

### **"Device not registered"**

**Solution:**
1. Register device UDID in developer portal
2. Regenerate provisioning profile
3. Download new profile in Xcode

### **"Failed to code sign"**

**Solution:**
1. Clean build folder: Shift+Cmd+K
2. Delete derived data:
```bash
rm -rf ~/Library/Developer/Xcode/DerivedData
```
3. Rebuild

### **"Could not launch 'WiChain'"**

**Solution:**
1. On iPhone: Settings → General → VPN & Device Management
2. Trust your developer certificate
3. Try launching again

### **"Target specifies product type 'com.apple.product-type.application'"**

**Solution:**
- Update Xcode to latest version
- Clean and rebuild

---

## 📱 SIMULATOR VS DEVICE

### **iOS Simulator (on Mac):**

**Pros:**
- ✅ No iPhone needed
- ✅ Fast testing
- ✅ Free

**Cons:**
- ⚠️ Not real hardware
- ⚠️ Different performance
- ⚠️ Can't test camera, sensors, etc.

**Run on Simulator:**
```bash
cargo tauri ios dev --open-simulator
```

### **Physical iPhone:**

**Pros:**
- ✅ Real hardware testing
- ✅ True performance
- ✅ All sensors work

**Cons:**
- ⚠️ Need actual device
- ⚠️ Need USB cable
- ⚠️ Need to trust certificate

---

## ⚙️ CONFIGURATION FILES

### **Info.plist** (App Permissions)

**File:** `src-tauri/gen/apple/WiChain_iOS/Info.plist`

Add permissions your app needs:

```xml
<!-- Camera permission -->
<key>NSCameraUsageDescription</key>
<string>WiChain needs camera access to scan QR codes</string>

<!-- Location permission -->
<key>NSLocationWhenInUseUsageDescription</key>
<string>WiChain needs location for nearby peer discovery</string>

<!-- Microphone permission -->
<key>NSMicrophoneUsageDescription</key>
<string>WiChain needs microphone for voice messages</string>

<!-- Local Network permission (for P2P) -->
<key>NSLocalNetworkUsageDescription</key>
<string>WiChain uses local network for peer-to-peer messaging</string>

<key>NSBonjourServices</key>
<array>
    <string>_wichain._tcp</string>
    <string>_wichain._udp</string>
</array>
```

### **Capabilities**

In Xcode → Signing & Capabilities:

**Enable:**
- ✅ **Networking** (for P2P)
- ✅ **Background Modes** → Background fetch (if needed)
- ✅ **Push Notifications** (if you add later)

---

## 🎯 iOS vs Android Comparison

| Feature | Android | iOS |
|---------|---------|-----|
| **Development OS** | Windows/Mac/Linux | **Mac only** |
| **IDE** | Android Studio | **Xcode** |
| **Signing** | Manual keystore | Automatic in Xcode |
| **Testing** | USB or Emulator | USB or Simulator |
| **Free Testing** | ✅ Yes | ✅ Yes (own devices) |
| **Distribution** | Play Store, APK | App Store, TestFlight |
| **Cost** | $25 one-time | **$99/year** |
| **Build Time** | 10-20 min | 10-20 min |
| **App Size** | 40-50 MB | 40-50 MB |

---

## 🚀 QUICK COMMAND REFERENCE

```bash
# Initialize iOS
cargo tauri ios init

# Open in Xcode
cargo tauri ios open

# Build debug
cargo tauri ios build

# Build release
cargo tauri ios build --release

# Run on device (with hot reload)
cargo tauri ios dev

# Run on simulator
cargo tauri ios dev --open-simulator

# Clean build
cargo tauri ios build --clean
```

---

## ✅ SUCCESS CHECKLIST

- [ ] macOS available (REQUIRED)
- [ ] Xcode installed
- [ ] Command line tools installed
- [ ] CocoaPods installed
- [ ] iOS Rust targets added
- [ ] Apple ID signed in to Xcode
- [ ] iOS project initialized
- [ ] App builds successfully
- [ ] Code signing configured
- [ ] App runs on iPhone/Simulator
- [ ] Permissions configured in Info.plist

---

## 💡 TIPS

### **Speed Up iOS Builds:**

1. **Use incremental builds:**
```bash
cargo tauri ios build --no-bundle
```

2. **Use release mode for testing:**
```bash
cargo tauri ios build --release
```

3. **Clean when stuck:**
```bash
rm -rf gen/apple/build
cargo tauri ios build --clean
```

### **Debugging:**

**View logs:**
```bash
# In Xcode: View → Debug Area → Show Debug Area
# Or Cmd+Shift+Y
```

**Console logs:**
```swift
// In Rust code, logs appear in Xcode console
println!("Debug: {}", message);
```

---

## 🎯 SUMMARY

**For iOS Development:**
1. ✅ Get a Mac (REQUIRED)
2. ✅ Install Xcode (FREE)
3. ✅ Sign in with Apple ID (FREE for testing)
4. ✅ Run `cargo tauri ios init`
5. ✅ Configure signing in Xcode
6. ✅ Run `cargo tauri ios dev`
7. ✅ App installs on your iPhone!

**For App Store:**
1. Pay $99/year for Apple Developer Program
2. Upload via TestFlight
3. Submit for review
4. Release to public

---

## 🔗 RESOURCES

- **Tauri iOS Docs:** https://tauri.app/develop/ios/
- **Apple Developer:** https://developer.apple.com
- **Xcode:** https://developer.apple.com/xcode/
- **TestFlight:** https://developer.apple.com/testflight/

---

**iOS setup is more restrictive than Android, but Xcode makes signing easier!** 🍎
