# 📖 WiChain User Guide

Complete guide to using WiChain for secure, decentralized local network chat.

---

## Table of Contents

1. [Installation](#installation)
2. [First Time Setup](#first-time-setup)
3. [User Interface Overview](#user-interface-overview)
4. [Direct Messaging](#direct-messaging)
5. [Group Chats](#group-chats)
6. [Advanced Features](#advanced-features)
7. [Understanding Security](#understanding-security)
8. [Tips & Best Practices](#tips--best-practices)
9. [FAQ](#faq)

---

## Installation

### System Requirements

- **Operating System**: Windows 10/11, macOS 10.15+, or Linux (Ubuntu 20.04+)
- **Network**: Active LAN connection
- **Disk Space**: ~100 MB
- **RAM**: 256 MB minimum

### Download & Install

#### Windows
1. Go to [Releases](https://github.com/YOUR_USERNAME/wichain/releases/latest)
2. Download `wichain_x64.msi`
3. Run the installer
4. Follow installation wizard
5. Launch from Start Menu

#### macOS
1. Download `wichain_x64.dmg`
2. Open DMG file
3. Drag WiChain to Applications
4. Right-click app → Open (first time only)

#### Linux (Ubuntu/Debian)
```bash
# Download .deb file
sudo dpkg -i wichain_amd64.deb
sudo apt-get install -f
```

#### Linux (AppImage)
```bash
chmod +x wichain_amd64.AppImage
./wichain_amd64.AppImage
```

---

## First Time Setup

### 1. Welcome Screen

When you first launch WiChain, you'll see the welcome slideshow explaining key features:
- Peer-to-peer messaging
- Blockchain-backed history
- Cryptographic signatures
- Trust scoring

Click through or skip to continue.

### 2. Create Your Identity

**Choose Your Alias:**
- Enter a username (3-20 characters)
- This is how others see you on the network
- Can contain letters, numbers, and underscores

**Identity Generation:**
- WiChain automatically creates an Ed25519 keypair
- Your **private key** stays on your device (never shared)
- Your **public key** is broadcast to identify you
- Keys are stored securely in local storage

**Important:** Your identity is tied to this device. If you reinstall or clear data, you'll need to create a new identity.

### 3. Main Interface

After setup, you'll see the main chat interface with three panels:
- **Left Sidebar**: Peers and groups
- **Center Panel**: Chat messages
- **Right Panel** (optional): Advanced features

---

## User Interface Overview

### Sidebar Components

#### 👤 Your Identity Card
- **Alias**: Your username
- **Public Key**: Your identity fingerprint
- **Trust Score**: Your local reputation (always 100 for yourself)
- **Copy Button**: Copy your public key to share

#### 🔍 Search Bar
- Search for peers by alias or public key
- Filter displayed peers
- Case-insensitive search

#### 📡 Discovered Peers
Each peer shows:
- **Alias** (username)
- **Public Key** (shortened)
- **Trust Score** (0-100)
- **Online Status** (green dot = active)

Click a peer to start chatting.

#### 👥 Create Group
- Click to open group creation dialog
- Select multiple peers
- Groups are ephemeral (exist only while app is open)

### Chat Panel

#### Message Display
- **Left-aligned**: Messages you received
- **Right-aligned**: Messages you sent
- **Timestamp**: When message was sent/received
- **Verification Icon**: 
  - ✅ Green checkmark = signature verified
  - ❌ Red X = verification failed
  - ⚠️ Yellow warning = unverified (self-message)

#### Message Input
- Type your message
- Press **Enter** to send
- Or click **Send** button
- Maximum message length: 1000 characters

#### Group Chat Indicator
- Shows "Group: [members]" at top
- All members receive messages
- Members list displayed in header

### Advanced Features Panel

Toggle with button in top-right corner.

**Tabs:**
1. **Blockchain View**: See your local blockchain
2. **Network Stats**: View network activity
3. **Trust Scores**: Detailed peer reputation
4. **Settings**: App configuration

---

## Direct Messaging

### Starting a Conversation

1. **Discover Peers**: Wait for peers to appear in sidebar (usually 1-5 seconds)
2. **Select Peer**: Click on their name/key
3. **Send Message**: Type and press Enter

### Message Flow

```
You type message
    ↓
Message is signed with your private key
    ↓
Message is obfuscated (XOR with SHA3-512)
    ↓
Sent via UDP to peer's IP
    ↓
Peer receives and de-obfuscates
    ↓
Peer verifies your signature
    ↓
Message displayed (if verified)
    ↓
Added to peer's local blockchain
```

### Message States

| Icon | Meaning | Action |
|------|---------|--------|
| ✅ | Verified | Message is authentic |
| ❌ | Failed | Signature invalid, possibly tampered |
| ⏳ | Pending | Waiting for verification |
| 📤 | Sent | Your message, awaiting delivery |

### Privacy Features

- Messages are **not stored on any central server**
- Only sender and recipient have the message
- Messages are obfuscated on the network
- Your IP is only visible to direct chat partners
- No message history sync (each device is independent)

---

## Group Chats

### Creating a Group

1. Click **"Create Group"** in sidebar
2. Select multiple peers from the list
3. Click **"Create"**
4. Group chat opens automatically

### Group Features

**Group ID:**
- Deterministically generated from member public keys
- Same members = same group ID
- Members are sorted, so order doesn't matter

**Message Delivery:**
- Sent via UDP multicast to all members
- Each member verifies the signature
- All members must be online to receive

**Group Limitations:**
- **Ephemeral**: Groups don't persist after app close
- **No history**: New members don't see old messages
- **Member limit**: Recommended max 10 members (UDP limitations)

### Group Management

- **Leave Group**: Close the group tab
- **View Members**: Check header in chat panel
- **Add Members**: Must create new group with new member set
- **Remove Members**: Create new group without them

---

## Advanced Features

### 📦 Blockchain View

See your local blockchain history:
- **Block Number**: Sequential index
- **Timestamp**: When block was created
- **Sender**: Who sent the message
- **Message Hash**: SHA3 hash of content
- **Previous Hash**: Link to previous block
- **Block Hash**: Unique identifier

**Blockchain Properties:**
- Append-only (can't delete or modify)
- Cryptographically linked
- Tamper-evident (any change breaks chain)
- Local to your device

### 📊 Network Statistics

Monitor network activity:
- **Peers Discovered**: Total peers found
- **Messages Sent**: Your outgoing message count
- **Messages Received**: Incoming message count
- **Broadcast Count**: Discovery beacon transmissions
- **Network Uptime**: How long you've been online

### 🎯 Trust Scoring System

**How Trust Works:**
- Each peer starts at 50 trust
- **+1** for each valid message received
- **-5** for signature verification failure
- **-0.1** per minute of inactivity (decay)
- Capped at 0 (min) and 100 (max)

**Trust Indicators:**
- **80-100**: Highly trusted (frequent, valid interaction)
- **50-79**: Normal trust (moderate interaction)
- **20-49**: Low trust (inactive or few messages)
- **0-19**: Very low trust (verification failures or very inactive)

**Use Cases:**
- Identify reliable peers
- Detect potential tampering
- Prioritize responses from trusted peers

### ⚙️ Settings

Configure WiChain:
- **Theme**: Light/Dark mode
- **Notifications**: Enable/disable sound alerts
- **Auto-discover**: Toggle peer discovery
- **Port Configuration**: Change UDP ports (advanced)
- **Clear Data**: Reset identity and blockchain

---

## Understanding Security

### 🔐 Cryptographic Signing

**What it does:**
- Proves message authenticity
- Prevents impersonation
- Ensures message integrity

**How it works:**
1. You sign message with your private key
2. Signature is attached to message
3. Recipient verifies using your public key
4. Only valid signatures are accepted

**Verification failure means:**
- Message was tampered with, OR
- Sender's identity changed, OR
- Network interference

### 🔒 Message Obfuscation

**What it does:**
- Hides message content on network
- Prevents casual snooping
- Basic confidentiality layer

**What it's NOT:**
- Not full encryption
- Not secure against determined attackers
- Not a replacement for VPN/TLS

**How it works:**
- SHA3-512 hash of shared data
- XOR with message bytes
- Reversible by recipient

### ⛓️ Blockchain Integrity

**Purpose:**
- Tamper-evident history
- Proves message timeline
- Detects unauthorized changes

**Properties:**
- Each block links to previous (hash chain)
- Changing one block breaks all subsequent blocks
- Can verify entire chain integrity
- No consensus needed (local only)

**NOT a distributed blockchain:**
- Each device has its own chain
- No mining or proof-of-work
- No synchronization between peers
- Used for local integrity only

### 🛡️ Security Best Practices

1. **Keep your private key secure**
   - Don't share identity files
   - Don't copy to untrusted devices
   - Backup securely if needed

2. **Verify trust scores**
   - Check peer trust before sharing sensitive info
   - Low trust = possible issues

3. **Watch for verification failures**
   - Repeated failures = possible attack
   - Contact peer via alternate channel

4. **Use on trusted LANs only**
   - Not suitable for public WiFi
   - Best on home/office networks
   - Consider VPN for added security

5. **Don't rely on obfuscation for secrets**
   - Use additional encryption for sensitive data
   - Consider end-to-end encrypted alternatives for confidential comms

---

## Tips & Best Practices

### For Better Performance

✅ **DO:**
- Use wired Ethernet for best reliability
- Keep app running to maintain presence
- Limit group chat to <10 members
- Close unused group tabs
- Restart app if peers aren't discovered

❌ **DON'T:**
- Run multiple instances on same device
- Use on congested WiFi networks
- Send very large messages (>1000 chars)
- Spam messages rapidly

### For Privacy

✅ **DO:**
- Use on private, trusted LANs only
- Create new identity for different contexts
- Clear blockchain periodically if needed
- Check firewall settings

❌ **DON'T:**
- Use on public WiFi
- Share your private key/identity files
- Assume messages are encrypted
- Rely on for confidential communications

### For Security

✅ **DO:**
- Verify trust scores regularly
- Check signature verification
- Update to latest version
- Report suspicious activity

❌ **DON'T:**
- Ignore verification failures
- Trust unknown low-score peers immediately
- Disable signature verification
- Run untrusted builds

---

## FAQ

### General

**Q: Is WiChain free?**  
A: Yes, completely free and open source.

**Q: Do I need internet?**  
A: No, only a local network (LAN). Internet not required.

**Q: Can I use WiChain on public WiFi?**  
A: Not recommended. Use on trusted private networks only.

**Q: How many people can use WiChain simultaneously?**  
A: Theoretically unlimited, but groups are best kept under 10 members.

### Setup

**Q: Why can't I see any peers?**  
A: Check that:
- You're on the same LAN
- Firewall isn't blocking UDP
- Network allows broadcast/multicast
- Other peers are running WiChain

**Q: Can I change my alias later?**  
A: Yes, in Settings → Identity → Change Alias

**Q: I lost my identity. Can I recover it?**  
A: No, identities are device-specific. You'll need to create a new one.

### Messaging

**Q: Are messages saved?**  
A: Yes, in your local blockchain. But they don't sync between devices.

**Q: Can I delete sent messages?**  
A: No, blockchain is append-only. Messages are permanent on your device.

**Q: What happens if I'm offline?**  
A: You won't receive messages. They're not queued or stored.

**Q: Can I message someone not on my LAN?**  
A: No, WiChain is designed for LAN only. Consider VPN to extend your LAN.

### Security

**Q: Are my messages encrypted?**  
A: They're obfuscated (XOR), not fully encrypted. Not secure against determined attackers.

**Q: Can someone impersonate me?**  
A: No, as long as your private key is secure. Messages are cryptographically signed.

**Q: What if someone intercepts my messages?**  
A: They'd see obfuscated data. With effort, they could decode it. Use VPN/TLS for sensitive data.

**Q: Is my IP address visible?**  
A: Yes, to anyone on your LAN. WiChain uses UDP with your actual IP.

### Technical

**Q: What ports does WiChain use?**  
A: Default UDP ports (configurable in Settings). Check your firewall.

**Q: Can I run WiChain on a server?**  
A: Yes, but it's designed as a desktop app. Headless mode not officially supported.

**Q: Does WiChain work on mobile?**  
A: Not currently. Desktop only (Windows, macOS, Linux).

**Q: Can I build from source?**  
A: Yes! See [Build Guide](BUILD_GUIDE.md) for instructions.

---

## Getting Help

- **Documentation**: [README.md](README.md) | [BUILD_GUIDE.md](BUILD_GUIDE.md)
- **Issues**: [GitHub Issues](https://github.com/YOUR_USERNAME/wichain/issues)
- **Discussions**: [GitHub Discussions](https://github.com/YOUR_USERNAME/wichain/discussions)

---

**Happy chatting with WiChain!** 🔗💬
