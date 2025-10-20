# WiChain - Multi-Platform Build Guide

## 🎯 Overview

WiChain can be built for:
- **Windows** (.msi installer)
- **Linux** (.deb, .AppImage)
- **macOS** (.dmg)

---

## 🏆 Method 1: GitHub Actions CI/CD (RECOMMENDED)

**Best for:** Production releases, automatic builds

### Setup:

1. **Push to GitHub:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/YOUR_USERNAME/wichain.git
   git push -u origin main
   ```

2. **Create Release Tag:**
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```

3. **Automatic Builds:**
   - GitHub Actions runs automatically
   - Builds all platforms in parallel
   - Creates GitHub Release with all installers
   - Download from: `https://github.com/YOUR_USERNAME/wichain/releases`

### Manual Trigger:
- Go to **Actions** tab → **Build WiChain for All Platforms** → **Run workflow**

---

## 💻 Method 2: Native Build on Each Platform

**Best for:** Development, testing

### Windows (PowerShell/CMD):

```cmd
cd f:\Major_Project\wichain\wichain-backend\frontend
npm install
npm run build

cd ..\src-tauri
cargo tauri build
```

**Output:** `src-tauri\target\release\bundle\msi\*.msi`

---

### Linux (Native or WSL):

**Install Dependencies:**
```bash
sudo apt-get update
sudo apt-get install -y \
  libwebkit2gtk-4.0-dev \
  libssl-dev \
  libgtk-3-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev \
  build-essential \
  curl \
  wget \
  file
```

**Build:**
```bash
cd /mnt/f/Major_Project/wichain/wichain-backend/frontend
npm install
npm run build

cd ../src-tauri
cargo tauri build
```

**Output:** 
- `.deb`: `target/release/bundle/deb/*.deb`
- `.AppImage`: `target/release/bundle/appimage/*.AppImage`

---

### macOS:

```bash
cd /path/to/wichain/wichain-backend/frontend
npm install
npm run build

cd ../src-tauri
cargo tauri build
```

**Output:** `target/release/bundle/dmg/*.dmg`

---

## 🐳 Method 3: Docker for Linux Builds on Windows

**Best for:** Building Linux packages from Windows

### Prerequisites:
- Install Docker Desktop for Windows

### Build:

```cmd
cd f:\Major_Project\wichain

# Build Docker image
docker build -t wichain-linux-builder .

# Extract artifacts
docker create --name temp wichain-linux-builder
docker cp temp:/app/wichain-backend/src-tauri/target/release/bundle ./linux-builds
docker rm temp
```

**Output:** `./linux-builds/` contains `.deb` and `.AppImage`

---

## 📦 Output Files

| Platform | File Type | Size | Target Users |
|----------|-----------|------|--------------|
| **Windows** | `.msi` | ~50MB | Windows 10/11 users |
| **Linux** | `.deb` | ~50MB | Ubuntu/Debian users |
| **Linux** | `.AppImage` | ~60MB | All Linux distros |
| **macOS** | `.dmg` | ~50MB | macOS users |

---

## 🚀 Quick Start for Development

**Windows Development:**
```cmd
cd f:\Major_Project\wichain\wichain-backend\src-tauri
cargo tauri dev
```

**Linux Development (WSL):**
```bash
cd /mnt/f/Major_Project/wichain/wichain-backend/src-tauri
cargo tauri dev
```

---

## 🔧 Troubleshooting

### Windows: Missing MSVC
```cmd
# Install Visual Studio Build Tools
winget install Microsoft.VisualStudio.2022.BuildTools
```

### Linux: Missing Dependencies
```bash
sudo apt-get install -y libwebkit2gtk-4.0-dev libssl-dev libgtk-3-dev
```

### macOS: Xcode Required
```bash
xcode-select --install
```

---

## 📊 Build Comparison

| Method | Platforms | Difficulty | Time | Best For |
|--------|-----------|------------|------|----------|
| **GitHub Actions** | All | Easy | 15-20 min | Production |
| **Native Builds** | One at a time | Medium | 5-10 min | Development |
| **Docker** | Linux only | Medium | 10-15 min | Cross-platform |

---

## ✅ Recommended Workflow

### For Development:
- **Windows:** Use native Windows build (`cargo tauri dev`)
- **Linux:** Use WSL for testing

### For Release:
- **Use GitHub Actions** for automatic multi-platform builds
- Tag release: `git tag v1.0.0 && git push origin v1.0.0`
- GitHub builds all platforms automatically
- Download installers from Releases page

---

## 🎯 Distribution

### Windows:
- `.msi` installer - double-click to install
- Installs to `C:\Program Files\WiChain\`

### Linux (.deb):
```bash
sudo dpkg -i wichain_1.0.0_amd64.deb
```

### Linux (.AppImage):
```bash
chmod +x wichain_1.0.0_amd64.AppImage
./wichain_1.0.0_amd64.AppImage
```

### macOS:
- `.dmg` - drag to Applications folder

---

## 📝 Notes

- **First build takes longer** (downloads dependencies)
- **Subsequent builds are faster** (cached)
- **GitHub Actions is FREE** for public repos
- **Cross-compilation is difficult** - use CI/CD instead

---

## 🏆 Professional Setup

```
Your Repository
├── .github/workflows/build.yml  ← Auto-builds all platforms
├── Dockerfile                   ← For manual Linux builds
├── BUILD_GUIDE.md              ← This file
└── wichain-backend/
    ├── frontend/               ← React app
    └── src-tauri/             ← Rust backend
```

**Push → Tag → Automatic builds → Download installers!** 🚀
