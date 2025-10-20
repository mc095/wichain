# 🔐 ANDROID APP SIGNING - Complete Guide

## 🎯 The Problem

Android requires apps to be signed before installation. Tauri doesn't auto-sign debug builds.

---

## ✅ SOLUTION 1: Quick Debug Signing (5 minutes)

### **Step 1: Generate Debug Keystore**

```bash
cd F:\Major_Project\wichain\wichain-backend\src-tauri

# Generate keystore (if you don't have one)
keytool -genkey -v -keystore debug.keystore -storepass android -alias androiddebugkey -keypass android -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Android Debug,O=Android,C=US"
```

**Answer prompts:**
- Password: `android`
- Name: Android Debug
- Organization: Android
- Country: US

This creates `debug.keystore` in src-tauri folder.

### **Step 2: Configure Gradle Signing**

**File:** `src-tauri/gen/android/app/build.gradle.kts`

Find the `android {` block and add signing config:

```kotlin
android {
    namespace = "com.wichain.app"
    compileSdk = 34
    
    defaultConfig {
        applicationId = "com.wichain.app"
        minSdk = 24
        targetSdk = 34
        versionCode = 1
        versionName = "1.0"
    }
    
    // ADD THIS BLOCK:
    signingConfigs {
        create("debug") {
            storeFile = file("../../../debug.keystore")
            storePassword = "android"
            keyAlias = "androiddebugkey"
            keyPassword = "android"
        }
    }
    
    buildTypes {
        getByName("debug") {
            signingConfig = signingConfigs.getByName("debug")
            isDebuggable = true
        }
        getByName("release") {
            // Will add release signing later
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }
}
```

### **Step 3: Rebuild**

```bash
cd F:\Major_Project\wichain\wichain-backend\src-tauri
cargo tauri android build
```

### **Step 4: Install**

```bash
# On physical device (USB debugging enabled)
cargo tauri android dev

# OR manually install APK
adb install -r gen/android/app/build/outputs/apk/universal/debug/app-universal-debug.apk
```

**Should work now!** ✅

---

## 🏆 SOLUTION 2: Production Release Signing

For Play Store or production distribution.

### **Step 1: Generate Release Keystore**

```bash
cd F:\Major_Project\wichain\wichain-backend\src-tauri

# Generate release keystore
keytool -genkey -v -keystore wichain-release.keystore -alias wichain -keyalg RSA -keysize 2048 -validity 10000
```

**IMPORTANT:**
- Use a **STRONG password** (save it securely!)
- Fill in real organization details
- **BACKUP THIS FILE** - you can't publish updates without it!

### **Step 2: Create keystore.properties**

**File:** `src-tauri/gen/android/keystore.properties`

```properties
storePassword=YOUR_STRONG_PASSWORD
keyPassword=YOUR_STRONG_PASSWORD
keyAlias=wichain
storeFile=../../../wichain-release.keystore
```

**IMPORTANT:** Add to .gitignore to keep passwords secret!

### **Step 3: Update build.gradle.kts**

**File:** `src-tauri/gen/android/app/build.gradle.kts`

```kotlin
// At the top, before android block:
val keystorePropertiesFile = rootProject.file("keystore.properties")
val keystoreProperties = Properties()
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(FileInputStream(keystorePropertiesFile))
}

android {
    // ... existing config ...
    
    signingConfigs {
        create("debug") {
            storeFile = file("../../../debug.keystore")
            storePassword = "android"
            keyAlias = "androiddebugkey"
            keyPassword = "android"
        }
        
        // ADD RELEASE CONFIG:
        create("release") {
            if (keystorePropertiesFile.exists()) {
                keyAlias = keystoreProperties["keyAlias"] as String
                keyPassword = keystoreProperties["keyPassword"] as String
                storeFile = file(keystoreProperties["storeFile"] as String)
                storePassword = keystoreProperties["storePassword"] as String
            }
        }
    }
    
    buildTypes {
        getByName("debug") {
            signingConfig = signingConfigs.getByName("debug")
        }
        getByName("release") {
            signingConfig = signingConfigs.getByName("release")
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }
}
```

### **Step 4: Build Release APK**

```bash
cargo tauri android build --release
```

**Output:** `src-tauri/gen/android/app/build/outputs/apk/universal/release/app-universal-release.apk`

**This APK is:**
- ✅ Signed for production
- ✅ Optimized & minified
- ✅ Ready for Play Store
- ✅ Ready for distribution

---

## 🔒 SECURITY BEST PRACTICES

### **Protect Your Keystore:**

1. **Backup** `wichain-release.keystore` in a secure location
2. **Never commit** keystore files to Git
3. **Add to .gitignore:**

```gitignore
# Keystores
*.keystore
*.jks
keystore.properties
src-tauri/gen/android/keystore.properties
```

4. **Save passwords** in a password manager (1Password, Bitwarden, etc.)

### **Why This Matters:**

⚠️ **If you lose your release keystore:**
- You CANNOT update your app on Play Store
- You must create a NEW app listing
- Users must uninstall and reinstall
- You lose all reviews and downloads

---

## 📦 BUILD TYPES COMPARISON

| Type | Command | Signed | Optimized | Use Case |
|------|---------|--------|-----------|----------|
| **Debug** | `cargo tauri android build` | Debug key | No | Development |
| **Release** | `cargo tauri android build --release` | Release key | Yes | Production |
| **Dev** | `cargo tauri android dev` | Debug key | No | Testing |

---

## 🚀 QUICK COMMAND REFERENCE

```bash
# Debug build (for testing)
cargo tauri android build
adb install -r gen/android/app/build/outputs/apk/universal/debug/app-universal-debug.apk

# Release build (for production)
cargo tauri android build --release

# Direct install on device (debug)
cargo tauri android dev

# List connected devices
adb devices

# Uninstall app
adb uninstall com.wichain.app

# View logs
adb logcat | findstr wichain
```

---

## 🐛 TROUBLESHOOTING

### **"Keystore was tampered with, or password was incorrect"**

Wrong password. Regenerate keystore or use correct password.

### **"Failed to install: INSTALL_FAILED_UPDATE_INCOMPATIBLE"**

Different signing key. Uninstall old app first:
```bash
adb uninstall com.wichain.app
adb install gen/android/app/build/outputs/apk/universal/debug/app-universal-debug.apk
```

### **"adb: command not found"**

Add to PATH:
```
%ANDROID_HOME%\platform-tools
```

Restart terminal.

### **Build.gradle.kts resets after `cargo tauri android init`**

Normal. Tauri regenerates it. Save your signing config and re-add it after init.

**Better solution:** Create a script to auto-patch it:

**File:** `src-tauri/patch-gradle.bat`
```bat
@echo off
echo Patching build.gradle.kts for signing...
:: Add your signing config here
echo Done!
```

Run after each `cargo tauri android init`.

---

## ✅ VERIFICATION

After signing is set up:

1. Build: `cargo tauri android build`
2. Check APK is signed:
```bash
jarsigner -verify -verbose -certs gen/android/app/build/outputs/apk/universal/debug/app-universal-debug.apk
```

Should show: **"jar verified."**

3. Install on device:
```bash
adb install -r gen/android/app/build/outputs/apk/universal/debug/app-universal-debug.apk
```

Should install successfully! ✅

---

## 📱 INSTALL ON PHYSICAL DEVICE

### **Prerequisites:**

1. **Enable Developer Mode:**
   - Settings → About Phone
   - Tap "Build Number" 7 times
   - "You are now a developer!"

2. **Enable USB Debugging:**
   - Settings → System → Developer Options
   - Enable "USB Debugging"

3. **Connect via USB**

4. **Allow debugging on phone** (popup appears first time)

### **Install:**

```bash
# Verify device connected
adb devices

# Should show:
# List of devices attached
# ABC123456789    device

# Install APK
cargo tauri android dev
```

---

## 🎯 SUMMARY

**For Development (Quick):**
1. Generate debug keystore
2. Add debug signing config to build.gradle.kts
3. Rebuild
4. Install with `cargo tauri android dev`

**For Production:**
1. Generate release keystore (SECURE PASSWORD!)
2. Create keystore.properties
3. Add release signing config
4. Build with `--release` flag
5. Upload to Play Store or distribute

**Both keystores configured?** You're all set for dev AND production! 🚀
