# 🚀 TAURI MOBILE - COMPLETE SETUP GUIDE

## ✅ You're on the Right Path!

Tauri Mobile will let you keep your Rust backend and run it on mobile.

---

## 🔧 STEP 1: Install Android SDK & Tools

### **1.1 Download Android Studio**

**Download:** https://developer.android.com/studio

**Install it to default location:**
- Windows: `C:\Program Files\Android\Android Studio`

**IMPORTANT:** During installation, make sure to install:
- ✅ Android SDK
- ✅ Android SDK Platform
- ✅ Android Virtual Device (for emulator)

### **1.2 Install Android SDK Components**

Open Android Studio:

1. Go to: **File → Settings** (or **Configure → Settings** on welcome screen)
2. Navigate to: **Appearance & Behavior → System Settings → Android SDK**
3. Select **SDK Platforms** tab:
   - ✅ Check **Android 13.0 (Tiramisu)** - API Level 33
   - ✅ Check **Android 12.0 (S)** - API Level 31
   - Click **Apply**

4. Select **SDK Tools** tab:
   - ✅ Android SDK Build-Tools
   - ✅ Android SDK Command-line Tools
   - ✅ Android SDK Platform-Tools
   - ✅ Android Emulator
   - ✅ NDK (Side by side) - **CRITICAL for Rust!**
   - Click **Apply**

**Wait for downloads to complete (~2-3 GB)**

---

## 🌍 STEP 2: Set Environment Variables

### **Windows Setup:**

**2.1 Find Your Android SDK Path**

Usually: `C:\Users\YourUsername\AppData\Local\Android\Sdk`

To confirm:
- Open Android Studio → Settings → Android SDK
- Look at "Android SDK Location" at the top

**2.2 Set ANDROID_HOME**

**Option A: GUI Method (Easiest)**

1. Press `Win + R`, type: `sysdm.cpl`, press Enter
2. Go to **Advanced** tab
3. Click **Environment Variables**
4. Under **User variables**, click **New**
5. Variable name: `ANDROID_HOME`
6. Variable value: `C:\Users\YourUsername\AppData\Local\Android\Sdk`
7. Click **OK**

**Option B: PowerShell (Quick)**

Run PowerShell as Administrator:

```powershell
# Set ANDROID_HOME
[System.Environment]::SetEnvironmentVariable('ANDROID_HOME', 'C:\Users\YourUsername\AppData\Local\Android\Sdk', 'User')

# Set NDK_HOME (required for Tauri)
[System.Environment]::SetEnvironmentVariable('NDK_HOME', 'C:\Users\YourUsername\AppData\Local\Android\Sdk\ndk\26.1.10909125', 'User')
```

(Replace `YourUsername` and NDK version with your actual paths)

**2.3 Add to PATH**

Add these to your PATH:

```
%ANDROID_HOME%\platform-tools
%ANDROID_HOME%\tools
%ANDROID_HOME%\cmdline-tools\latest\bin
```

**GUI Method:**
1. Same Environment Variables dialog
2. Edit **Path** under User variables
3. Click **New**
4. Add each path above
5. Click **OK**

**PowerShell Method:**

```powershell
$currentPath = [System.Environment]::GetEnvironmentVariable('Path', 'User')
$newPath = "$currentPath;$env:ANDROID_HOME\platform-tools;$env:ANDROID_HOME\tools;$env:ANDROID_HOME\cmdline-tools\latest\bin"
[System.Environment]::SetEnvironmentVariable('Path', $newPath, 'User')
```

**2.4 Verify Installation**

**CLOSE and REOPEN** your terminal, then run:

```cmd
echo %ANDROID_HOME%
adb --version
```

Should show:
```
C:\Users\YourUsername\AppData\Local\Android\Sdk
Android Debug Bridge version 1.0.41
```

---

## 🦀 STEP 3: Install Rust Android Targets

```bash
# Add Android targets
rustup target add aarch64-linux-android
rustup target add armv7-linux-androideabi
rustup target add x86_64-linux-android
rustup target add i686-linux-android
```

---

## 📱 STEP 4: Install Java JDK 17

Tauri requires Java 17.

**Download:** https://adoptium.net/temurin/releases/?version=17

**Install to default location**

**Set JAVA_HOME:**

```powershell
# In PowerShell (Admin)
[System.Environment]::SetEnvironmentVariable('JAVA_HOME', 'C:\Program Files\Eclipse Adoptium\jdk-17.0.XX-hotspot', 'User')
```

**Verify:**

```cmd
java -version
```

Should show: `openjdk version "17.0.XX"`

---

## 🎯 STEP 5: Configure Tauri for Mobile

### **5.1 Update tauri.conf.json**

**File:** `src-tauri/tauri.conf.json`

Add mobile configuration:

```json
{
  "productName": "WiChain",
  "version": "1.0.0",
  "identifier": "com.wichain.app",
  "build": {
    "beforeDevCommand": "npm run dev",
    "devUrl": "http://localhost:1420",
    "beforeBuildCommand": "npm run build",
    "frontendDist": "../frontend/dist"
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ]
  },
  "security": {
    "csp": null
  },
  "app": {
    "withGlobalTauri": true,
    "windows": [
      {
        "title": "WiChain",
        "width": 1200,
        "height": 800
      }
    ]
  }
}
```

### **5.2 Update Cargo.toml for Mobile**

**File:** `src-tauri/Cargo.toml`

Ensure mobile features are enabled:

```toml
[package]
name = "wichain"
version = "1.0.0"
edition = "2021"

[lib]
name = "wichain_lib"
crate-type = ["staticlib", "cdylib", "rlib"]

[build-dependencies]
tauri-build = { version = "2.0.1", features = [] }

[dependencies]
tauri = { version = "2.0.1", features = ["protocol-asset"] }
tauri-plugin-process = "2.0.1"
serde = { version = "1", features = ["derive"] }
serde_json = "1"

# Your existing dependencies...
```

---

## 🔥 STEP 6: Initialize Tauri Android

**CLOSE all terminals and open a NEW one** (to load environment variables)

```bash
cd F:\Major_Project\wichain\wichain-backend\src-tauri

# Initialize Android
cargo tauri android init
```

**Answer the prompts:**
- App name: `WiChain`
- Identifier: `com.wichain.app`
- Target SDK: `33` (recommended)
- Min SDK: `24` (minimum supported)

**Expected output:**
```
✔ Project generated successfully!
```

**This creates:**
- `src-tauri/gen/android/` - Android project directory
- Android Gradle files
- Mobile configuration

---

## 📱 STEP 7: Build Android APK

```bash
cd F:\Major_Project\wichain\wichain-backend\src-tauri

# Build for Android
cargo tauri android build
```

**First build will:**
- Download Gradle (~100 MB)
- Download Android dependencies (~500 MB)
- Compile Rust to Android targets
- Build APK

**Expected time:** 10-20 minutes first time

**Output location:**
```
src-tauri/gen/android/app/build/outputs/apk/universal/debug/app-universal-debug.apk
```

---

## 🚀 STEP 8: Install on Device

### **Option A: Physical Phone**

1. Enable USB Debugging on your phone:
   - Settings → About Phone
   - Tap "Build Number" 7 times
   - Go back → Developer Options
   - Enable "USB Debugging"

2. Connect phone via USB

3. Verify connection:
```bash
adb devices
```

4. Install APK:
```bash
cargo tauri android dev
# or manually:
adb install src-tauri/gen/android/app/build/outputs/apk/universal/debug/app-universal-debug.apk
```

### **Option B: Android Emulator**

1. Open Android Studio
2. Tools → Device Manager
3. Create Virtual Device
4. Select Phone → Pixel 6
5. Download System Image (API 33)
6. Finish and Start emulator

7. Install APK:
```bash
cargo tauri android dev
```

---

## ⚡ STEP 9: Development Workflow

### **For Development (with hot reload):**

```bash
# Terminal 1: Start frontend dev server
cd F:\Major_Project\wichain\wichain-backend\frontend
npm run dev

# Terminal 2: Run on Android
cd F:\Major_Project\wichain\wichain-backend\src-tauri
cargo tauri android dev
```

### **For Production Build:**

```bash
# Build release APK
cargo tauri android build --release

# APK location:
# src-tauri/gen/android/app/build/outputs/apk/universal/release/app-universal-release.apk
```

---

## 🔧 TROUBLESHOOTING

### **Error: ANDROID_HOME not set**

```bash
# Verify environment variable
echo %ANDROID_HOME%

# Should show: C:\Users\YourUsername\AppData\Local\Android\Sdk
```

If not set:
- Close ALL terminals
- Set it again using PowerShell method above
- Open NEW terminal
- Try again

### **Error: NDK not found**

Install NDK in Android Studio:
- Settings → Android SDK → SDK Tools
- Check "NDK (Side by side)"
- Apply

Then set NDK_HOME:
```powershell
[System.Environment]::SetEnvironmentVariable('NDK_HOME', 'C:\Users\YourUsername\AppData\Local\Android\Sdk\ndk\26.1.10909125', 'User')
```

### **Error: Gradle build failed**

```bash
# Clean and rebuild
cd src-tauri/gen/android
./gradlew clean
cd ../..
cargo tauri android build
```

### **Error: Java version mismatch**

Must use Java 17:
```bash
java -version
# Should show: openjdk version "17.0.XX"
```

### **Error: Rust target not installed**

```bash
rustup target add aarch64-linux-android
rustup target add armv7-linux-androideabi
```

---

## 📋 QUICK CHECKLIST

Before running `cargo tauri android init`:

- [ ] Android Studio installed
- [ ] Android SDK installed (API 33)
- [ ] Android NDK installed
- [ ] ANDROID_HOME environment variable set
- [ ] NDK_HOME environment variable set
- [ ] Android tools in PATH
- [ ] Java JDK 17 installed
- [ ] JAVA_HOME set
- [ ] Rust Android targets installed
- [ ] Terminal restarted (to load env vars)

---

## 🎯 COMPLETE COMMAND SEQUENCE

```bash
# 1. Install Rust targets
rustup target add aarch64-linux-android armv7-linux-androideabi x86_64-linux-android i686-linux-android

# 2. Close and reopen terminal (load env vars)

# 3. Navigate to src-tauri
cd F:\Major_Project\wichain\wichain-backend\src-tauri

# 4. Initialize Android
cargo tauri android init

# 5. Build APK
cargo tauri android build

# 6. Run on device/emulator
cargo tauri android dev
```

---

## 📱 FINAL OUTPUT

After successful build, you'll have:

```
✅ APK at: src-tauri/gen/android/app/build/outputs/apk/universal/debug/app-universal-debug.apk
✅ Size: ~40-50 MB
✅ Contains your full Rust backend
✅ Works standalone (no PC needed)
✅ True P2P networking on mobile
```

---

## 🚀 NEXT STEPS

1. **Complete the setup above**
2. **Build the APK**
3. **Test on your device**
4. **Report any errors** - I'll help you fix them!

---

**Follow these steps in order. Let me know when you complete each step or if you hit any errors!** 🎯
