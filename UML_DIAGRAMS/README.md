# WiChain - Complete UML Documentation

**Version:** 2.0  
**Last Updated:** October 2025  
**Project:** Decentralized LAN Chat with Blockchain

---

## 📋 Table of Contents

1. [System Architecture Diagram](01_SYSTEM_ARCHITECTURE.md)
2. [Use Case Diagram](02_USE_CASE_DIAGRAM.md)
3. [Sequence Diagram](03_SEQUENCE_DIAGRAM.md)
4. [Class Diagram](04_CLASS_DIAGRAM.md)
5. [Activity Diagram](05_ACTIVITY_DIAGRAM.md)
6. [Deployment Diagram](06_DEPLOYMENT_DIAGRAM.md)

---

## 📊 Diagram Overview

### 1. System Architecture Diagram
**File:** [01_SYSTEM_ARCHITECTURE.md](01_SYSTEM_ARCHITECTURE.md)

Comprehensive view of the entire WiChain system architecture including:
- **High-Level System Architecture** - Complete system layers from UI to storage
- **Component Architecture** - Frontend and backend component relationships
- **Data Flow Architecture** - How data moves through the system

**Key Insights:**
- Multi-layered architecture (Frontend → Tauri Bridge → Backend → Network/Storage)
- Modular crate system (wichain-blockchain, wichain-network, wichain-core)
- Separation of concerns between UI, business logic, and infrastructure

---

### 2. Use Case Diagram
**File:** [02_USE_CASE_DIAGRAM.md](02_USE_CASE_DIAGRAM.md)

Complete mapping of user interactions and system capabilities:
- **Identity Management** - User alias, key generation
- **Direct Messaging** - Text, image, voice, file sharing
- **Group Communication** - Create, join, manage groups
- **Emergency Features** - SOS alerts, emergency broadcasts
- **Media Communication** - Video calls, photo capture
- **Blockchain Operations** - View, verify, export blockchain
- **Network Operations** - Peer discovery, connection testing
- **System Operations** - Data reset, advanced features

**Key Actors:**
- 👤 User
- 👤 Peer User
- 👥 Group Member
- 🚨 Emergency Contact
- ⚙️ System

---

### 3. Sequence Diagram
**File:** [03_SEQUENCE_DIAGRAM.md](03_SEQUENCE_DIAGRAM.md)

Complete message flow showing both sending and receiving:

**Complete Message Flow (Send & Receive)** - End-to-end message lifecycle with cryptographic operations

**Key Technologies:**
- Ed25519 digital signatures for authenticity
- AES-256-GCM encryption for confidentiality
- SHA3-512 blockchain hashing for integrity
- TCP message transport (port 61000)
- Dual blockchain verification (sender & receiver)

---

### 4. Class Diagram
**File:** [04_CLASS_DIAGRAM.md](04_CLASS_DIAGRAM.md)

Complete object-oriented design with all classes and relationships:

**Frontend Classes:**
- `App` - Main application container
- `ChatView` - Message display and input
- `PeerList` - Peer selection and management
- `GroupModal` - Group creation interface
- `AdvancedFeatures` - Blockchain viewer
- `VideoCallWindow` - WebRTC interface

**Backend Classes:**
- `AppState` - Central application state
- `StoredIdentity` - User identity persistence
- `ChatBody`, `ChatSigned` - Message structures
- `GroupManager`, `GroupInfo` - Group management
- `Blockchain`, `Block` - Blockchain implementation
- `NetworkNode`, `PeerInfo` - Network layer
- `SigningKey`, `VerifyingKey` - Cryptography

**Key Relationships:**
- Composition: AppState contains Blockchain, NetworkNode, GroupManager
- Inheritance: NetworkMessage enumeration
- Association: ChatView uses PeerInfo for display
- Dependency: All classes use CryptoUtils

---

### 5. Activity Diagram
**File:** [05_ACTIVITY_DIAGRAM.md](05_ACTIVITY_DIAGRAM.md)

Complete message flow process including:

**Main Process Flow:**
- Multiple message types (text, image, voice, file, SOS, group)
- Validation and encoding
- Cryptographic signing and encryption
- Blockchain addition
- TCP transport with retry logic
- Peer discovery (UDP broadcast every 500ms)

**Process Highlights:**
- Error handling at every step
- Retry mechanism (3 attempts)
- Validation checkpoints
- Parallel peer discovery process

---

### 6. Deployment Diagram
**File:** [06_DEPLOYMENT_DIAGRAM.md](06_DEPLOYMENT_DIAGRAM.md)

Physical deployment architecture showing:

**Complete Infrastructure:**
- Multi-device deployment (Desktop + future mobile)
- Network services (UDP/TCP)
- Local storage (blockchain, identity)
- Security layers (Ed25519, AES-256-GCM, SHA3-512)
- LAN topology (no internet required)

**Deployment Targets:**
- Windows 10/11 (MSI - 45MB)
- Linux (DEB/AppImage - 42-48MB)
- macOS (DMG - 50MB)

**Network Requirements:**
- UDP Port 8765 (Peer Discovery)
- TCP Port 61000 (Message Transport)
- LAN only (fully offline capable)

---

## 🎯 Quick Reference

### Core Technologies

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | React 18.3.1 + TypeScript | User Interface |
| **Desktop Framework** | Tauri 2.1.1 | Cross-platform desktop |
| **Backend** | Rust 1.82+ | Systems programming |
| **Cryptography** | Ed25519, AES-256-GCM | Security |
| **Blockchain** | SHA3-512 | Tamper-evident ledger |
| **Network** | UDP + TCP | Peer discovery + messaging |

### Architecture Patterns

- **Event-Driven**: Tauri emit/listen for frontend-backend communication
- **Layered Architecture**: Clear separation of UI, business logic, data
- **Repository Pattern**: Blockchain and storage abstraction
- **Observer Pattern**: Network events trigger UI updates
- **Strategy Pattern**: Different message types handled polymorphically

### Key Design Decisions

1. **No Central Server**: Pure P2P architecture for resilience
2. **Local Blockchain**: Each node maintains independent chain
3. **UDP for Discovery**: Broadcast for fast peer detection (500ms)
4. **TCP for Messages**: Reliable delivery with encryption
5. **Tauri over Electron**: Better performance, smaller bundle
6. **Rust Backend**: Memory safety, performance, concurrency

---

## 📈 Diagram Usage Guide

### For Developers
- **Start with**: System Architecture → Class Diagram → Sequence Diagrams
- **Implementation**: Use class diagram as blueprint
- **Debugging**: Reference sequence diagrams for expected flow
- **Testing**: Use activity diagrams to verify all paths

### For Project Managers
- **Overview**: System Architecture + Use Case Diagram
- **Features**: Use Case Diagram (31 use cases total)
- **Risk Assessment**: Deployment Diagram security layers
- **Timeline**: Activity diagrams show complexity

### For Security Auditors
- **Entry Points**: Use Case Diagram
- **Data Flow**: Sequence Diagrams (encryption at every step)
- **Attack Surface**: Deployment Diagram network topology
- **Verification**: Blockchain validation in Activity Diagrams

### For System Administrators
- **Installation**: Deployment Diagram specs
- **Network Config**: Ports 8765 (UDP), 61000 (TCP)
- **Storage**: ~/.wichain/ directory structure
- **Monitoring**: Network protocol stack layers

---

## 🔍 Diagram Conventions

### Color Coding
- 🟦 **Blue** - Frontend/UI components
- 🟨 **Yellow** - Blockchain/storage operations
- 🟩 **Green** - Successful/valid states
- 🟥 **Red** - Emergency/critical features
- 🟪 **Purple** - Backend/core logic
- 🟧 **Orange** - Network layer
- ⬜ **White** - Generic/neutral

### Symbols
- `[]` - Process/action
- `{}` - Decision point
- `()` - Start/end terminal
- `<>` - Data/message
- `||` - Parallel operations
- `--` - Alternative/optional flow

---

## 📚 Related Documentation

- [README.md](../README.md) - Project overview and installation
- [PROJECT_DOCUMENTATION.md](../PROJECT_DOCUMENTATION.md) - Technical details
- [BUILD_GUIDE.md](../BUILD_GUIDE.md) - Build instructions
- [USER_GUIDE.md](../USER_GUIDE.md) - End-user documentation
- [CHANGELOG.md](../CHANGELOG.md) - Version history

---

## 🔄 Diagram Maintenance

These UML diagrams should be updated when:
- ✅ New features are added
- ✅ Architecture changes occur
- ✅ APIs are modified
- ✅ Security measures are enhanced
- ✅ Network protocol changes
- ✅ Major refactoring

**Last Review:** October 2025  
**Next Review:** Upon next major release

---

## 📊 Statistics

| Metric | Count |
|--------|-------|
| **Total Diagram Types** | 6 |
| **Use Cases** | 31 |
| **Sequence Flow** | 1 comprehensive |
| **Classes** | 40+ |
| **Activity Process** | 1 complete |
| **Deployment View** | 1 detailed |

---

## 🎓 Learning Path

### Beginner
1. Read Use Case Diagram - understand what WiChain does
2. Review System Architecture - see the big picture
3. Study one Sequence Diagram - understand one flow deeply

### Intermediate
1. Study Class Diagram - understand object relationships
2. Review all Sequence Diagrams - see complete interactions
3. Examine Activity Diagrams - understand decision logic

### Advanced
1. Study Deployment Diagram - understand infrastructure
2. Analyze security layers - understand threat model
3. Review all diagrams - holistic system understanding

---

## 🛠️ Tools Used

- **Diagram Language**: Mermaid.js
- **Rendering**: GitHub, VS Code, Mermaid Live Editor
- **Version Control**: Git (track diagram changes)
- **Format**: Markdown with embedded Mermaid

---

## 📝 Feedback

For questions or suggestions about these diagrams:
1. Open an issue in the repository
2. Tag with `documentation` label
3. Reference specific diagram file

---

**Note**: All diagrams use Mermaid syntax and can be viewed directly in GitHub, VS Code (with Mermaid extension), or any Mermaid-compatible viewer.

---

## ✅ Verification Checklist

- [x] System Architecture - Complete with 3 views
- [x] Use Case Diagram - 31 use cases documented
- [x] Sequence Diagrams - 9 critical flows
- [x] Class Diagram - 40+ classes with relationships
- [x] Activity Diagrams - 7 major workflows
- [x] Deployment Diagram - 6 deployment views
- [x] All diagrams use consistent notation
- [x] All diagrams have descriptions
- [x] Cross-references are valid
- [x] Colors are meaningful and consistent

---

**End of UML Documentation**
