# Changelog

All notable changes to WiChain will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [v1.0.1] - 2025-01-21

### 🎉 First Stable Release

#### Added
- ✅ **Multi-platform builds**: Windows, macOS, and Linux support
- ✅ **Automated GitHub Actions CI/CD**: Build and release workflow
- ✅ **Comprehensive documentation**: User guide, README, build guide
- ✅ **GitHub Releases integration**: Automatic release page with installers

#### Fixed
- 🐛 Fixed Tauri version mismatches between npm and Cargo
- 🐛 Added missing Linux dependencies (libsoup-3.0, JavaScriptCore GTK)
- 🐛 Resolved PowerShell syntax issues in Windows builds
- 🐛 Fixed package-lock.json caching issues in CI/CD
- 🐛 Corrected working directory paths for Tauri CLI

#### Changed
- ⚡ Improved build speed with cargo-install caching (~15 min faster)
- 📦 Updated to Tauri 2.8.0 (stable version, avoiding 2.9.0 macOS bug)
- 🔧 Enhanced workflow with comprehensive version verification
- 📝 Improved release notes with installation instructions

#### Technical Details
- **Tauri**: 2.8.5 (Rust crate)
- **@tauri-apps/api**: 2.8.0 (npm package)
- **@tauri-apps/cli**: 2.8.0 (npm package)
- **Node.js**: 20.x
- **Rust**: Stable toolchain

---

## [v1.0.0] - 2025-01-20

### 🚀 Initial Release

#### Core Features
- 📡 **Peer-to-peer messaging** over LAN using UDP
- 🔐 **Ed25519 cryptographic signatures** for message authentication
- ⛓️ **Local blockchain** for tamper-evident chat history
- 👥 **Ephemeral group chats** with deterministic group IDs
- 🔒 **SHA3-512 XOR obfuscation** for basic message confidentiality
- 📊 **Trust scoring system** for peer reputation tracking

#### User Interface
- 🎨 Modern React-based UI with Tailwind CSS
- 🌓 Light/Dark mode support
- ⚡ Real-time message updates
- 📋 Peer discovery sidebar
- 💬 Intuitive chat interface
- 🔍 Advanced features panel (blockchain view, network stats)

#### Architecture
- 🦀 Rust backend with modular crate structure:
  - `wichain-blockchain`: Block and chain management
  - `wichain-core`: Identity, signing, trust scoring
  - `wichain-network`: UDP peer discovery and messaging
  - `wichain-backend`: Tauri integration layer
- ⚛️ React + TypeScript frontend
- 🖥️ Tauri 2.x desktop application framework

#### Security
- ✅ Message signature verification
- ✅ Tamper-evident blockchain
- ✅ Local-only data storage (no cloud sync)
- ✅ Private key never leaves device

#### Platforms
- 🪟 Windows 10/11 (x64)
- 🍎 macOS (Intel x64)
- 🐧 Linux (Ubuntu 22.04+, Debian-based distros)

#### Known Limitations
- LAN-only operation (no internet messaging)
- Groups are ephemeral (not persistent)
- No message history sync between devices
- Obfuscation is not full encryption
- Requires open UDP ports on firewall

---

## Unreleased

### Planned Features
- 🔮 **End-to-end encryption**: Replace obfuscation with proper E2EE
- 📱 **Mobile apps**: Android and iOS support
- 🌐 **Relay mode**: Bridge multiple LANs via relay servers
- 💾 **Message export**: Export chat history to various formats
- 🔔 **Desktop notifications**: System tray notifications for new messages
- 🎨 **Custom themes**: User-created theme support
- 🗂️ **File sharing**: Send files through the network
- 🔊 **Voice messages**: Audio message support
- 📸 **Image sharing**: Inline image display
- 🌍 **Multi-language support**: Internationalization (i18n)

### Under Consideration
- 💬 **Message reactions**: Emoji reactions to messages
- 📌 **Pinned messages**: Pin important messages
- 🔍 **Message search**: Full-text search in history
- 👤 **Profile pictures**: Avatar support
- 🎭 **Multiple identities**: Switch between identities
- 🔗 **Blockchain sync**: Optional peer-to-peer chain sync
- 🛡️ **Advanced security**: PGP integration, hardware key support

---

## Version History

| Version | Date | Highlights |
|---------|------|------------|
| **v1.0.1** | 2025-01-21 | First stable release with multi-platform builds |
| **v1.0.0** | 2025-01-20 | Initial development release |

---

## Migration Guides

### Upgrading from v1.0.0 to v1.0.1

**No breaking changes!** Simply install the new version:

1. Download the new installer from [Releases](https://github.com/YOUR_USERNAME/wichain/releases/latest)
2. Install over the existing version (Windows/macOS) or update package (Linux)
3. Your identity and blockchain will be preserved

**Note:** If you built from source, you may need to:
```bash
cd wichain-backend/frontend
rm -rf node_modules package-lock.json
npm install  # Gets Tauri 2.8.0
cd ../src-tauri
cargo update  # Updates Rust dependencies
cargo tauri build
```

---

## Contributing

See changes you'd like? Check out [CONTRIBUTING.md](CONTRIBUTING.md) to get started!

---

## Links

- **Repository**: [github.com/YOUR_USERNAME/wichain](https://github.com/YOUR_USERNAME/wichain)
- **Releases**: [Releases Page](https://github.com/YOUR_USERNAME/wichain/releases)
- **Issues**: [Issue Tracker](https://github.com/YOUR_USERNAME/wichain/issues)
- **Discussions**: [GitHub Discussions](https://github.com/YOUR_USERNAME/wichain/discussions)

---

**Format:** YYYY-MM-DD  
**Categories:** Added, Changed, Deprecated, Removed, Fixed, Security
