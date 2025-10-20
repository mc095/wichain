# ✅ TAURI MOBILE SETUP - CHECKLIST

Track your progress:

---

## 📦 **PREREQUISITES**

- [ ] Android Studio installed
- [ ] Android SDK installed (API 33)
- [ ] Android NDK installed (from Android Studio SDK Manager)
- [ ] Java JDK 17 installed
- [ ] Rust installed

---

## 🌍 **ENVIRONMENT VARIABLES**

Open PowerShell as Administrator and run:

```powershell
# 1. Set ANDROID_HOME
[System.Environment]::SetEnvironmentVariable('ANDROID_HOME', 'C:\Users\YourUsername\AppData\Local\Android\Sdk', 'User')

# 2. Set NDK_HOME (check version in SDK Manager)
[System.Environment]::SetEnvironmentVariable('NDK_HOME', 'C:\Users\YourUsername\AppData\Local\Android\Sdk\ndk\26.1.10909125', 'User')

# 3. Set JAVA_HOME
[System.Environment]::SetEnvironmentVariable('JAVA_HOME', 'C:\Program Files\Eclipse Adoptium\jdk-17.0.XX-hotspot', 'User')
```

**Then:**
- [ ] Close ALL terminals
- [ ] Open NEW terminal

**Verify:**
```cmd
echo %ANDROID_HOME%
echo %NDK_HOME%
echo %JAVA_HOME%
adb --version
java -version
```

---

## 🦀 **RUST TARGETS**

```bash
rustup target add aarch64-linux-android
rustup target add armv7-linux-androideabi
rustup target add x86_64-linux-android
rustup target add i686-linux-android
```

- [ ] All 4 targets installed

**Verify:**
```bash
rustup target list | findstr android
```

Should show all 4 with `(installed)`.

---

## 🔧 **TAURI CONFIGURATION**

- [ ] `tauri.conf.json` updated (if needed)
- [ ] `Cargo.toml` has mobile features

---

## 🚀 **BUILD STEPS**

### **1. Initialize Android:**

```bash
cd F:\Major_Project\wichain\wichain-backend\src-tauri
cargo tauri android init
```

**Prompts:**
- App name: `WiChain`
- Identifier: `com.wichain.app`
- Target SDK: `33`
- Min SDK: `24`

- [ ] Android initialized successfully
- [ ] `gen/android/` folder created

---

### **2. Build APK:**

```bash
cargo tauri android build
```

**Wait for:**
- Gradle download (~5 min)
- Dependencies download (~5-10 min)
- Rust compilation (~5-10 min)

- [ ] Build completed successfully
- [ ] APK created at: `src-tauri/gen/android/app/build/outputs/apk/universal/debug/app-universal-debug.apk`

---

### **3. Test on Device:**

**Option A - Physical Phone:**
```bash
# Enable USB Debugging on phone
# Connect via USB
adb devices
cargo tauri android dev
```

**Option B - Emulator:**
```bash
# Start emulator from Android Studio
cargo tauri android dev
```

- [ ] App installed on device
- [ ] App runs successfully
- [ ] Can create account
- [ ] Can discover peers

---

## ⏱️ **EXPECTED TIMES**

| Task | First Time | Subsequent |
|------|------------|------------|
| Android Studio install | 10-15 min | - |
| SDK/NDK download | 10-15 min | - |
| Environment setup | 5 min | - |
| Rust targets | 2-3 min | - |
| First APK build | 20-30 min | 5-10 min |
| **Total** | **~60 min** | **5-10 min** |

---

## 🐛 **COMMON ERRORS**

### **"ANDROID_HOME not set"**
→ Restart terminal after setting environment variables

### **"NDK not found"**
→ Install NDK in Android Studio SDK Manager
→ Set NDK_HOME environment variable

### **"Gradle build failed"**
→ Clean: `cd src-tauri/gen/android && ./gradlew clean`
→ Try again: `cargo tauri android build`

### **"Java version mismatch"**
→ Must use Java 17
→ Check: `java -version`

### **"Target not installed"**
→ Run: `rustup target add aarch64-linux-android`

---

## ✅ **SUCCESS INDICATORS**

You've succeeded when:

- ✅ `cargo tauri android init` completes without errors
- ✅ `gen/android/` folder exists
- ✅ `cargo tauri android build` completes
- ✅ APK file created (~40-50 MB)
- ✅ App installs on device
- ✅ App opens and runs
- ✅ Onboarding works
- ✅ Can discover other devices

---

## 📱 **FINAL TEST**

1. Install APK on 2 devices
2. Both on same WiFi
3. Create accounts on both
4. Wait ~10 seconds
5. Should see each other in peer list!

---

## 🆘 **IF YOU GET STUCK**

1. Read error message carefully
2. Check this checklist
3. Read `TAURI_MOBILE_COMPLETE_SETUP.md`
4. Still stuck? Share the error message!

---

**Current Status:** _Mark where you are_

- [ ] Prerequisites installed
- [ ] Environment variables set
- [ ] Rust targets added
- [ ] Android initialized
- [ ] APK built successfully
- [ ] App running on device

**Keep going! You're doing great! 🚀**
