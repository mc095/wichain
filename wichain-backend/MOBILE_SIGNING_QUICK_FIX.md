# ⚡ QUICK FIX - Mobile App Signing

## 🤖 ANDROID SIGNING (5 minutes)

### **Your Error:**
```
This typically means that you didn't sign the app
```

### **Quick Fix:**

**1. Generate debug keystore:**
```bash
cd F:\Major_Project\wichain\wichain-backend\src-tauri

keytool -genkey -v -keystore debug.keystore -storepass android -alias androiddebugkey -keypass android -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Android Debug,O=Android,C=US"
```

**2. Edit:** `src-tauri/gen/android/app/build.gradle.kts`

Add inside `android {` block:

```kotlin
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
    }
}
```

**3. Rebuild:**
```bash
cargo tauri android build
```

**4. Install:**
```bash
cargo tauri android dev
# OR
adb install -r gen/android/app/build/outputs/apk/universal/debug/app-universal-debug.apk
```

**Done!** ✅

---

## 🍎 iOS SETUP (Mac Only)

### **Requirements:**
- ✅ macOS (REQUIRED - can't build iOS on Windows!)
- ✅ Xcode from App Store
- ✅ Apple ID (free for testing)

### **Quick Steps:**

**1. Install tools:**
```bash
# Install Xcode from App Store (30-45 min)
xcode-select --install
sudo gem install cocoapods
```

**2. Add iOS targets:**
```bash
rustup target add aarch64-apple-ios
rustup target add aarch64-apple-ios-sim
```

**3. Initialize iOS:**
```bash
cd /path/to/wichain-backend/src-tauri
cargo tauri ios init
```

**4. Open in Xcode:**
```bash
cargo tauri ios open
```

**5. Configure signing:**
- Select project → Signing & Capabilities
- Check "Automatically manage signing"
- Select your Apple ID

**6. Build & Run:**
- Connect iPhone via USB
- Click ▶️ in Xcode
- Trust certificate on iPhone (Settings → General → Device Management)

**Done!** ✅

---

## 📊 COMPARISON

| | Android | iOS |
|---|---|---|
| **Platform** | Windows/Mac/Linux | **Mac ONLY** |
| **Signing** | Manual (5 min) | Auto in Xcode |
| **Testing** | Free | Free (own devices) |
| **Distribution** | $25 one-time | $99/year |
| **Build Command** | `cargo tauri android build` | `cargo tauri ios build` |

---

## 🎯 WHAT TO DO NOW

### **If you have Windows:**
- ✅ Fix Android signing (above)
- ✅ Can't build iOS (need Mac)
- ✅ Use Android for testing

### **If you have Mac:**
- ✅ Fix Android signing (above)
- ✅ Build iOS (steps above)
- ✅ Test on both platforms!

---

## 📚 FULL GUIDES

- **Android Signing:** `ANDROID_APP_SIGNING.md`
- **iOS Setup:** `IOS_APP_SETUP.md`
- **Tauri Mobile:** `TAURI_MOBILE_COMPLETE_SETUP.md`

---

## ✅ VERIFICATION

**Android:**
```bash
# Should install successfully
cargo tauri android dev
```

**iOS (on Mac):**
```bash
# Should open in Xcode
cargo tauri ios open
# Click Play button → installs on iPhone
```

---

**Fix Android signing first (5 min), then move to iOS if you have a Mac!** 🚀
