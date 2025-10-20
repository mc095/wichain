# 📱 WiChain Mobile Deployment Guide

## ✅ Prerequisites Installation

### **1. Install Node.js Dependencies**
**Location:** `f:\Major_Project\wichain\wichain-backend\frontend\`

```bash
# Navigate to frontend folder
cd f:\Major_Project\wichain\wichain-backend\frontend

# Install all dependencies (including new Capacitor packages)
npm install
```

---

## 🤖 ANDROID Setup (Works on Windows/Mac)

### **Step 1: Install Android Studio**
1. Download from: https://developer.android.com/studio
2. Install Android Studio (default options)
3. **Important:** During installation, select "Android SDK", "Android SDK Platform", and "Android Virtual Device"

### **Step 2: Install JDK 17**
1. Download from: https://www.oracle.com/java/technologies/downloads/#java17
2. Install and note the installation path (e.g., `C:\Program Files\Java\jdk-17`)

### **Step 3: Set Environment Variables**
**On Windows:**
1. Search "Environment Variables" in Start Menu
2. Click "Environment Variables"
3. Add these under "System Variables":
   - `JAVA_HOME` → `C:\Program Files\Java\jdk-17`
   - `ANDROID_HOME` → `C:\Users\YourName\AppData\Local\Android\Sdk`
4. Add to `Path`:
   - `%JAVA_HOME%\bin`
   - `%ANDROID_HOME%\platform-tools`
   - `%ANDROID_HOME%\tools`

**On Mac:**
```bash
# Add to ~/.zshrc or ~/.bash_profile
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/platform-tools
export PATH=$PATH:$ANDROID_HOME/tools
export JAVA_HOME=/Library/Java/JavaVirtualMachines/jdk-17.jdk/Contents/Home
```

### **Step 4: Install Android SDK Components**
1. Open Android Studio
2. Go to: **Tools → SDK Manager**
3. Install:
   - ✅ Android SDK Platform 34 (or latest)
   - ✅ Android SDK Build-Tools 34.0.0
   - ✅ Android SDK Command-line Tools
   - ✅ Android Emulator
   - ✅ Intel x86 Emulator Accelerator (HAXM)

### **Step 5: Create Android Virtual Device (AVD)**
1. In Android Studio: **Tools → Device Manager**
2. Click **Create Device**
3. Select **Pixel 6** (or any phone)
4. Download and select **Android 14 (API 34)**
5. Click **Finish**

---

## 🍎 iOS Setup (Mac Only - Use Your MacBook)

### **Step 1: Install Xcode**
1. Open **App Store** on your Mac
2. Search for **Xcode**
3. Install (takes ~30-45 minutes, 15GB download)
4. Open Xcode once installed
5. Accept license agreement

### **Step 2: Install Xcode Command Line Tools**
```bash
xcode-select --install
```

### **Step 3: Install CocoaPods**
```bash
sudo gem install cocoapods
```

---

## 🚀 Build Mobile Apps

**Location:** `f:\Major_Project\wichain\wichain-backend\frontend\`

### **Initial Setup (Do Once)**

```bash
# Step 1: Build the web app
npm run build

# Step 2: Initialize Capacitor (already done via config file)
npx cap init

# Step 3: Add Android platform
npm run cap:add:android

# Step 4: Add iOS platform (Mac only)
npm run cap:add:ios
```

---

## 🤖 Build Android APK

### **Method 1: Using Android Studio (Recommended)**

```bash
# 1. Sync your code with Android
npm run mobile:build

# 2. Open Android Studio
npm run cap:open:android
```

**In Android Studio:**
1. Wait for Gradle sync to complete (first time: 10-15 minutes)
2. Click **Build → Build Bundle(s) / APK(s) → Build APK(s)**
3. Wait for build (3-5 minutes)
4. When done, click **Locate** to find APK
5. APK location: `android/app/build/outputs/apk/debug/app-debug.apk`

### **Method 2: Command Line**

```bash
# 1. Navigate to android folder
cd android

# 2. Build APK
./gradlew assembleDebug

# 3. Find APK at:
# android/app/build/outputs/apk/debug/app-debug.apk
```

### **Install on Your Phone:**
1. Enable **Developer Options** on Android phone:
   - Go to Settings → About Phone
   - Tap "Build Number" 7 times
2. Enable **USB Debugging** in Developer Options
3. Connect phone via USB
4. Copy APK to phone or run:
   ```bash
   adb install android/app/build/outputs/apk/debug/app-debug.apk
   ```

---

## 🍎 Build iOS App (Mac Only)

### **Method 1: Test on Simulator**

```bash
# 1. Sync your code
npm run mobile:build

# 2. Open Xcode
npm run cap:open:ios
```

**In Xcode:**
1. Select **Any iOS Device (arm64)** or a simulator from top menu
2. Click **▶ Play button** to run
3. App will launch in simulator

### **Method 2: Install on Your iPhone**

**In Xcode:**
1. Connect your iPhone via USB
2. Select your iPhone from device dropdown
3. Click **Play button**
4. **First time only:** On iPhone, go to Settings → General → Device Management → Trust your developer account
5. App will install and run on your iPhone

### **For App Store Distribution:**
1. In Xcode: **Product → Archive**
2. Once archived, click **Distribute App**
3. Select **App Store Connect**
4. Follow wizard to upload to App Store

---

## 📊 File Sizes & Build Times

| Platform | Build Time | App Size | Location |
|----------|-----------|----------|----------|
| **Android APK** | 3-5 min | ~40-50 MB | `android/app/build/outputs/apk/debug/` |
| **iOS** | 5-7 min | ~30-40 MB | Built in Xcode |

---

## ⚡ Quick Commands Reference

```bash
# All commands run from: f:\Major_Project\wichain\wichain-backend\frontend\

# 1. Install dependencies
npm install

# 2. Build web app and sync to mobile
npm run mobile:build

# 3. Open Android in Android Studio
npm run cap:open:android

# 4. Open iOS in Xcode (Mac)
npm run cap:open:ios

# 5. Sync changes after code updates
npm run cap:sync
```

---

## 🔧 Troubleshooting

### **"Gradle build failed"**
```bash
# Clean and rebuild
cd android
./gradlew clean
./gradlew assembleDebug
```

### **"Pod install failed" (iOS)**
```bash
cd ios/App
pod deintegrate
pod install
```

### **"SDK not found"**
- Verify `ANDROID_HOME` environment variable
- Restart terminal/command prompt after setting variables

### **Build takes forever**
- **First build:** Always takes 10-15 minutes (downloads dependencies)
- **Subsequent builds:** 3-5 minutes
- **Tip:** Use faster internet connection for first build

---

## 📱 Testing Your App

### **Android:**
1. **Emulator:** Select AVD in Android Studio and click Play
2. **Real Device:** Enable USB debugging, connect phone, click Play
3. **APK File:** Transfer to phone and install manually

### **iOS:**
1. **Simulator:** Select simulator in Xcode and click Play
2. **Real iPhone:** Connect via USB, select device, click Play
3. **TestFlight:** Archive and upload to App Store Connect

---

## 🎯 Production Build (For Release)

### **Android Signed APK:**
```bash
# In Android Studio:
# Build → Generate Signed Bundle / APK
# Follow wizard to create keystore and sign APK
```

### **iOS App Store:**
```bash
# In Xcode:
# Product → Archive
# Distribute to App Store Connect
```

---

## 📍 Where to Run Commands

**ALL commands should be run from:**
```
f:\Major_Project\wichain\wichain-backend\frontend\
```

**Do NOT run from:**
- ❌ `src-tauri` folder
- ❌ Root `wichain-backend` folder
- ❌ Desktop or any other location

---

## ⏱️ Expected Installation Times

| Step | Time |
|------|------|
| Node dependencies | 2-3 min |
| Android Studio download | 5-10 min |
| Android Studio install | 5 min |
| SDK components | 10-15 min |
| Xcode download (Mac) | 30-45 min |
| First Gradle build | 10-15 min |
| Subsequent builds | 3-5 min |

**Total first-time setup:** 1-2 hours
**After setup, building apps:** 5 minutes

---

## ✅ Success Checklist

- [ ] Node.js installed
- [ ] Dependencies installed (`npm install`)
- [ ] Android Studio installed (for Android)
- [ ] Xcode installed (for iOS on Mac)
- [ ] Environment variables set
- [ ] Web app builds successfully (`npm run build`)
- [ ] Android platform added (`npm run cap:add:android`)
- [ ] iOS platform added (`npm run cap:add:ios`) - Mac only
- [ ] APK builds successfully
- [ ] App runs on device/emulator

---

## 🎉 Final Output

After following this guide, you'll have:
1. ✅ **Android APK** at: `android/app/build/outputs/apk/debug/app-debug.apk`
2. ✅ **iOS App** running in Xcode/iPhone
3. ✅ Fully functional mobile apps with all features!
