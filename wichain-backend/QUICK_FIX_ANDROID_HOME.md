# ⚡ QUICK FIX - Set ANDROID_HOME

## 🎯 Your Current Error:

```
Have you installed the Android SDK? The `ANDROID_HOME` environment variable isn't set
```

---

## ✅ QUICK SOLUTION (5 minutes)

### **Step 1: Install Android Studio**

**Download:** https://developer.android.com/studio

**Install** to default location (just click Next → Next → Finish)

### **Step 2: Open Android Studio**

1. Open Android Studio
2. Click **More Actions** → **SDK Manager**
3. Note the path at top: `C:\Users\YourName\AppData\Local\Android\Sdk`
4. Install these (check boxes and click Apply):
   - ✅ Android SDK Platform 33
   - ✅ Android SDK Build-Tools
   - ✅ Android SDK Command-line Tools
   - ✅ NDK (Side by side) ← **CRITICAL!**

### **Step 3: Set Environment Variable**

**PowerShell (Run as Administrator):**

```powershell
# Replace YourUsername with your actual Windows username
[System.Environment]::SetEnvironmentVariable('ANDROID_HOME', 'C:\Users\YourUsername\AppData\Local\Android\Sdk', 'User')

# Also set NDK_HOME (find version number in SDK Manager)
[System.Environment]::SetEnvironmentVariable('NDK_HOME', 'C:\Users\YourUsername\AppData\Local\Android\Sdk\ndk\26.1.10909125', 'User')
```

**OR GUI Method:**

1. Press `Win + R`
2. Type: `sysdm.cpl`
3. Press Enter
4. Go to **Advanced** tab
5. Click **Environment Variables**
6. Under **User variables**, click **New**
7. Variable name: `ANDROID_HOME`
8. Variable value: `C:\Users\YourUsername\AppData\Local\Android\Sdk`
9. Click OK, OK, OK

### **Step 4: Install Java 17**

**Download:** https://adoptium.net/temurin/releases/?version=17

**Install** to default location

**Set JAVA_HOME:**

```powershell
[System.Environment]::SetEnvironmentVariable('JAVA_HOME', 'C:\Program Files\Eclipse Adoptium\jdk-17.0.XX-hotspot', 'User')
```

### **Step 5: Install Rust Targets**

```bash
rustup target add aarch64-linux-android
rustup target add armv7-linux-androideabi
```

### **Step 6: Restart Terminal**

**IMPORTANT:** Close ALL terminals and open a NEW one!

### **Step 7: Verify**

```cmd
echo %ANDROID_HOME%
adb --version
java -version
```

Should show:
```
C:\Users\YourName\AppData\Local\Android\Sdk
Android Debug Bridge version 1.0.41
openjdk version "17.0.XX"
```

### **Step 8: Try Again**

```bash
cd F:\Major_Project\wichain\wichain-backend\src-tauri
cargo tauri android init
```

Should work now! ✅

---

## 🔥 If Still Not Working

**Check Android SDK Location:**

In Android Studio:
- File → Settings → Appearance & Behavior → System Settings → Android SDK
- Copy the "Android SDK Location" path
- Use that EXACT path in ANDROID_HOME

**Common Paths:**
- `C:\Users\YourName\AppData\Local\Android\Sdk`
- `C:\Android\Sdk`
- `D:\Android\Sdk`

---

## 📋 Full Setup Guide

For complete instructions: **`TAURI_MOBILE_COMPLETE_SETUP.md`**

---

**After setting ANDROID_HOME, close terminal and try again!**
