# 🚀 QUICK START - Build Mobile Apps in 5 Minutes

## 📍 Location
**Run ALL commands from:**
```
f:\Major_Project\wichain\wichain-backend\frontend\
```

---

## ⚡ Super Quick Method (Automated)

### **Windows:**
```bash
# Double-click or run:
setup-mobile.bat
```

### **Mac (Your MacBook):**
```bash
# Make executable and run:
chmod +x setup-mobile.sh
./setup-mobile.sh
```

This will:
- Install dependencies
- Build the app
- Add Android/iOS platforms
- Sync everything

---

## 🎯 Manual Steps (5 Minutes)

### **1. Install Dependencies (2 min)**
```bash
cd f:\Major_Project\wichain\wichain-backend\frontend
npm install
```

### **2. Build & Setup (2 min)**
```bash
# Build web app
npm run build

# Add Android platform
npx cap add android

# Add iOS platform (Mac only)
npx cap add ios

# Sync everything
npx cap sync
```

### **3. Build APK (1 min to start, 5 min to complete)**
```bash
# Open Android Studio
npm run cap:open:android

# In Android Studio:
# Wait for Gradle sync → Build → Build APK(s)
# APK will be at: android/app/build/outputs/apk/debug/app-debug.apk
```

### **4. Build iOS (Mac with Xcode)**
```bash
# Open Xcode
npm run cap:open:ios

# In Xcode:
# Select your iPhone or simulator → Click Play button
```

---

## 📱 Install on Phone

### **Android:**
1. Transfer `app-debug.apk` to your phone
2. Install it
3. Enable "Install from unknown sources" if prompted

### **iPhone:**
1. Connect iPhone to Mac via USB
2. In Xcode, select your iPhone
3. Click Play button
4. Trust developer on iPhone (Settings → General → Device Management)

---

## 🔄 After Making Code Changes

```bash
# Rebuild and sync
npm run mobile:build

# Then open in Android Studio or Xcode and rebuild
```

---

## 🎉 You're Done!

Your Android APK is at:
```
f:\Major_Project\wichain\wichain-backend\frontend\android\app\build\outputs\apk\debug\app-debug.apk
```

Your iOS app runs in Xcode!
