# 🦀 WiChain: Decentralized LAN Chat with Blockchain-backed History

WiChain is a unique peer-to-peer chat application designed for local area networks (LANs). It blends a modern desktop user interface built with React and Tauri with a tamper-evident blockchain ledger to store chat history, offering a robust and secure local communication solution.

<div style="width: 30%; text-align: center;">
    <img src="https://raw.githubusercontent.com/mc095/wichain/main/public/demo-gif.gif" alt="WiChain Demo" style="display: block; margin: 0 auto; width: 30%;">
</div>

## ✨ Features

  * **Direct Peer & Group Messaging**: Communicate directly with other users or in ephemeral groups over your LAN using UDP, without needing a central server.
  * **Signed, Verifiable Messages**: All messages are signed using Ed25519, allowing recipients to verify the sender's authenticity.
  * **Blockchain-backed Chat History**: Each node maintains a local, append-only blockchain, providing a tamper-evident record of all chat activity.
  * **Ephemeral Group Chats**: Create temporary group chats with deterministic group IDs based on sorted member public keys.
  * **Simple Message Obfuscation**: Messages are lightly obfuscated using SHA3-512 XOR for basic confidentiality on the LAN.
  * **Trust Scoring**: Each peer locally tracks trust scores for other participants, increasing with valid data and decaying over time.

## Overview

WiChain prioritizes privacy and integrity within a local network environment. It's designed to be a learning tool for decentralized systems and blockchain concepts, showcasing how a blockchain can be used for tamper-evidence rather than global consensus.

## 🏗️ Architecture

WiChain is built with a modular Rust backend and a responsive React frontend, integrated as a desktop application using Tauri.

```
+-------------------+         +-------------------+
|   Frontend (UI)   | <----> |   Tauri Backend   |
|  React + TS + CSS |         |  Rust + Tauri     |
+-------------------+         +-------------------+
         |                               |
         |  Tauri API (invoke/emit)      |
         v                               v
+-------------------+         +-------------------+
|   Blockchain      |         |   Network (UDP)   |
|   (Rust crate)    |         |   (Rust crate)    |
+-------------------+         +-------------------+
         |                               |
         +-------------------------------+
         |      wichain-core/types        |
         +-------------------------------+
```

## 🛠️ Components

The project is structured into several Rust crates for clear separation of concerns:

  * **`wichain-blockchain`**: Handles the core blockchain logic, including block definition, chain management, validation, and persistence.
  * **`wichain-core`**: Manages message signing, verification, identity, key encoding/decoding, and the local trust scoring system.
  * **`wichain-network`**: Manages peer discovery (UDP broadcast) and direct/group messaging (UDP unicast).
  * **`wichain-backend`**: The main Tauri backend, orchestrating identity, blockchain, networking, group management, and message obfuscation.
  * **`wichain-backend/frontend`**: The React-based user interface, handling UI state, peer/group selection, chat, and real-time updates.


## Explanation
[Link](https://mc095.github.io/jsonparser/exp.html)

## 🔒 Security Model Highlights

  * **Authenticity**: All messages are signed with Ed25519.
  * **Confidentiality**: Basic message obfuscation (SHA3-512 XOR) for LAN privacy.
  * **Integrity**: Local blockchain ensures chat history cannot be tampered with undetectably.

## 📥 Installation

### Download Pre-built Installers

**Latest Release:** [Download from GitHub Releases](https://github.com/YOUR_USERNAME/wichain/releases/latest)

#### Windows (10/11)
1. Download `wichain_x64.msi`
2. Double-click the installer
3. Follow the installation wizard
4. Launch WiChain from Start Menu

#### Linux (Ubuntu/Debian)
```bash
# Download the .deb package
sudo dpkg -i wichain_amd64.deb
sudo apt-get install -f  # Fix dependencies

# Run
wichain
```

#### Linux (AppImage - Universal)
```bash
# Download the AppImage
chmod +x wichain_amd64.AppImage
./wichain_amd64.AppImage
```

#### macOS (Intel)
1. Download `wichain_x64.dmg`
2. Open the DMG file
3. Drag WiChain to Applications folder
4. Launch from Applications

**Note:** On macOS, you may need to allow the app in System Preferences > Security & Privacy.

---

## 🚀 Getting Started

### First Launch

1. **Set Your Alias**: When you first open WiChain, you'll be prompted to create an alias (username)
2. **Identity Generation**: A unique Ed25519 keypair is automatically generated and stored locally
3. **Network Discovery**: WiChain will start broadcasting on your LAN to find other peers

### Using WiChain

#### 📡 Peer Discovery
- WiChain automatically discovers peers on your local network via UDP broadcast
- Available peers appear in the left sidebar with their aliases and public keys
- Trust scores are displayed next to each peer (0-100)

#### 💬 Direct Messaging
1. Click on any peer in the sidebar
2. Type your message in the input field
3. Press Enter or click Send
4. Messages are automatically signed and verified

#### 👥 Group Chats
1. Click "Create Group" in the sidebar
2. Select multiple peers to include
3. The group ID is deterministically generated from member keys
4. All members receive group messages
5. Groups are ephemeral (no persistence after closing)

#### 🔍 Message Verification
- All messages show a verification status (✓ verified / ✗ failed)
- Hover over timestamps to see full message details
- View blockchain history in the Advanced Features panel

---

## 🎯 Key Features Explained

### 🔐 Cryptographic Signing
- Every message is signed with your private Ed25519 key
- Recipients verify signatures using your public key
- Tampered messages are automatically rejected

### ⛓️ Local Blockchain
- Each device maintains its own blockchain of chat history
- Blocks contain message data, sender info, and timestamps
- Blockchain is append-only and tamper-evident
- View your blockchain in "Advanced Features"

### 🔒 Message Obfuscation
- Messages are XOR-obfuscated using SHA3-512
- Provides basic confidentiality on LAN
- Not encryption, but prevents casual snooping

### 📊 Trust Scoring
- Each peer has a local trust score (0-100)
- Score increases with valid messages
- Score decays over time for inactive peers
- Helps identify reliable participants

---

## 🛠️ Building from Source

### Prerequisites
- **Rust**: Install from [rustup.rs](https://rustup.rs/)
- **Node.js**: Version 20+ ([nodejs.org](https://nodejs.org/))
- **System Dependencies**:
  - **Linux**: `sudo apt install libwebkit2gtk-4.1-dev libjavascriptcoregtk-4.1-dev libssl-dev libgtk-3-dev`
  - **macOS**: Xcode Command Line Tools
  - **Windows**: No additional dependencies

### Build Steps

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/wichain.git
cd wichain

# Build Rust workspace
cargo build --release

# Install frontend dependencies
cd wichain-backend/frontend
npm install
npm run build

# Run the app
cd ..
cargo tauri dev  # Development mode
cargo tauri build  # Production build
```

---

## 🔧 Troubleshooting

### "No peers found"
- Ensure all devices are on the same LAN
- Check firewall settings (UDP ports must be open)
- Verify network discovery is enabled on your router
- Try restarting the app

### "Message verification failed"
- The sender's identity may have changed
- Message was tampered with in transit
- Clock skew between devices (check system time)

### "Build errors on Linux"
```bash
# Install missing dependencies
sudo apt update
sudo apt install libwebkit2gtk-4.1-dev libjavascriptcoregtk-4.1-dev \
                 libssl-dev libgtk-3-dev libayatana-appindicator3-dev \
                 librsvg2-dev libsoup-3.0-dev build-essential
```

### macOS "App can't be opened"
```bash
# Remove quarantine attribute
xattr -cr /Applications/WiChain.app
```

---

## 📖 Documentation

- **[User Guide](USER_GUIDE.md)** - Detailed usage instructions
- **[Architecture Documentation](PROJECT_DOCUMENTATION.md)** - Technical details and UML diagrams
- **[Build Guide](BUILD_GUIDE.md)** - Cross-platform build instructions
- **[Changelog](CHANGELOG.md)** - Version history and updates

---

## 🤝 Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is open source and available for educational purposes.

---

## 🐛 Issues & Support

- **Bug Reports**: [Open an issue](https://github.com/YOUR_USERNAME/wichain/issues/new?template=bug_report.md)
- **Feature Requests**: [Open an issue](https://github.com/YOUR_USERNAME/wichain/issues/new?template=feature_request.md)
- **Questions**: [GitHub Discussions](https://github.com/YOUR_USERNAME/wichain/discussions)

## ❤️ Credits 

WiChain is an open-source project designed for learning and experimentation, built with Rust, React, and Tauri. It's student-friendly and perfect for exploring decentralized chat and blockchain principles.
