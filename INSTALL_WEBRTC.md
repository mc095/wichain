# 🚀 Quick Install: WebRTC Video Calling

## ⚡ 3-Step Setup (5 minutes)

### Step 1: Install Dependencies

```bash
cd f:\Major_Project\wichain\wichain-backend\frontend
npm install
```

**What this does:**
- Installs `simple-peer@9.11.1` (WebRTC library)
- Installs `@types/simple-peer@9.11.8` (TypeScript types)
- Updates all other dependencies

### Step 2: Build Frontend

```bash
npm run build
```

**Output:** Compiled React app ready for Tauri

### Step 3: Run & Test

```bash
cd ../src-tauri
cargo tauri dev
```

**What to expect:**
- WiChain opens
- Video call button appears (camera icon)
- Click to start video call!

---

## ✅ Testing Checklist

### Quick Test (Same Machine)

1. **Open two WiChain instances**
   ```bash
   # Terminal 1
   cargo tauri dev
   
   # Terminal 2 (different profile)
   cargo tauri dev
   ```

2. **Send video call from Instance 1**
3. **Accept on Instance 2**
4. **Grant camera/mic permissions**
5. **✅ Both should see live video!**

### Full Test (Two Devices on LAN)

1. **Device 1:**
   - Run WiChain
   - Find Device 2 in peers
   - Click video call button

2. **Device 2:**
   - Run WiChain
   - See incoming call request
   - Click "Accept Video Call"

3. **Both devices:**
   - Grant camera/mic permissions
   - **✅ Live video streaming!**

---

## 🐛 Troubleshooting

### Error: "Cannot find module 'simple-peer'"

**Fix:**
```bash
cd wichain-backend/frontend
rm -rf node_modules package-lock.json
npm install
```

### Error: "Permission denied" for camera

**Fix:**
- Check browser settings
- Allow camera/microphone access
- Try in Chrome/Edge (better WebRTC support)

### Video call doesn't start

**Check:**
1. Both on same LAN? ✅
2. Firewall blocking? ✅
3. Camera/mic permissions granted? ✅
4. Browser console errors? (F12)

### No peer discovered

**Fix:**
- Same network? Check WiFi/Ethernet
- Firewall? Temporarily disable
- Different subnets? Use bridge mode

---

## 📋 Browser Compatibility

| Browser | Video Calls | Audio | Camera |
|---------|-------------|-------|--------|
| **Chrome** | ✅ Perfect | ✅ | ✅ |
| **Edge** | ✅ Perfect | ✅ | ✅ |
| **Firefox** | ✅ Good | ✅ | ✅ |
| **Safari** | ⚠️ Limited | ✅ | ⚠️ |

**Recommendation:** Use Chrome or Edge for best experience!

---

## 🎯 What You Get

### Features Now Available:

- ✅ **Live video streaming** (720p, 30fps)
- ✅ **Live audio** (crystal clear)
- ✅ **Mute/unmute** microphone
- ✅ **Camera on/off** toggle
- ✅ **Hang up** button
- ✅ **Beautiful UI** with animations
- ✅ **100% offline** (works on LAN)
- ✅ **End-to-end encrypted** (WebRTC)

### No Internet Required!

- ✅ Works on WiFi without internet
- ✅ Works on local Ethernet
- ✅ All traffic stays on LAN
- ✅ Zero cloud servers
- ✅ Complete privacy

---

## 💡 Quick Tips

### For Best Quality:

1. **Use wired Ethernet** (more stable than WiFi)
2. **Close bandwidth-heavy apps** during call
3. **Good lighting** for better video
4. **Headphones recommended** (prevents echo)

### Performance Tips:

- 📹 Lower resolution if laggy
- 🎤 Use headset for better audio
- 💻 Close other apps
- 🌐 Prefer Ethernet over WiFi

---

## 🎉 You're Ready!

**Just run these commands:**

```bash
cd f:\Major_Project\wichain\wichain-backend\frontend
npm install
npm run build
cd ../src-tauri
cargo tauri dev
```

**Then:**
1. Click video call button 📹
2. Accept on other device ✅
3. See each other live! 🎥

---

## 📖 Need More Help?

- **Full Guide:** [WEBRTC_IMPLEMENTATION.md](WEBRTC_IMPLEMENTATION.md)
- **User Guide:** [USER_GUIDE.md](USER_GUIDE.md)
- **Build Issues:** [BUILD_GUIDE.md](BUILD_GUIDE.md)

---

**Total setup time: ~5 minutes** ⚡

**Enjoy real WebRTC video calling!** 🎊
