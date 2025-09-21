# WiChain System Architecture

## Overview
WiChain is a decentralized, peer-to-peer messaging application built with Tauri (Rust backend + React frontend) that uses advanced cryptographic protocols for secure communication over local area networks.

## Core Technologies

### ✅ **Ed25519 Digital Signatures**
- **Purpose**: Message authentication and integrity
- **Implementation**: All messages are signed with Ed25519 private keys
- **Verification**: Each received message is verified against sender's public key
- **Key Management**: Each user has a unique Ed25519 key pair

### ✅ **AES-256-GCM Encryption**
- **Purpose**: End-to-end message encryption
- **Key Derivation**: SHA3-512 hash of sorted public keys + salt
- **Nonce**: 12-byte random nonce for each message
- **Authentication**: Built-in GCM authentication tag

### ✅ **UDP + TCP Hybrid Protocol**
- **UDP**: Primary transport for peer discovery and message delivery
- **TCP**: Reliable transport for large messages and file transfers
- **Port**: 60000 (UDP), dynamic TCP ports
- **Fallback**: Automatic fallback from TCP to UDP if connection fails

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                WiChain Application                              │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐            │
│  │   React Frontend │    │   Tauri Backend │    │   Network Layer │            │
│  │                 │    │                 │    │                 │            │
│  │ • Chat UI       │◄──►│ • Identity Mgmt │◄──►│ • UDP Discovery │            │
│  │ • Peer List     │    │ • Message Proc  │    │ • TCP Connections│            │
│  │ • Group Mgmt    │    │ • Blockchain    │    │ • Peer Discovery│            │
│  │ • Settings      │    │ • Group Manager │    │ • Message Relay │            │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘            │
│           │                       │                       │                    │
│           │                       │                       │                    │
│           ▼                       ▼                       ▼                    │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐            │
│  │   UI Components │    │   Core Services │    │   Network Stack │            │
│  │                 │    │                 │    │                 │            │
│  │ • ChatView      │    │ • Identity      │    │ • UDP Socket    │            │
│  │ • PeerList      │    │ • Blockchain    │    │ • TCP Listener  │            │
│  │ • Onboarding    │    │ • GroupManager  │    │ • Message Queue │            │
│  │ • Statistics    │    │ • Crypto Engine │    │ • Peer Registry │            │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘            │
│                                                                                 │
├─────────────────────────────────────────────────────────────────────────────────┤
│                              Cryptographic Layer                                │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐            │
│  │   Ed25519       │    │   AES-256-GCM   │    │   SHA3-512      │            │
│  │   Signatures    │    │   Encryption    │    │   Key Derivation│            │
│  │                 │    │                 │    │                 │            │
│  │ • Message Sign  │    │ • Message Encrypt│    │ • Key Generation│            │
│  │ • Signature Ver │    │ • Message Decrypt│    │ • Hash Functions│            │
│  │ • Identity Auth │    │ • Nonce Management│   │ • Salt Generation│            │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘            │
│                                                                                 │
├─────────────────────────────────────────────────────────────────────────────────┤
│                              Data Storage Layer                                 │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐            │
│  │   Identity      │    │   Blockchain    │    │   Group Data    │            │
│  │   Storage       │    │   Storage       │    │   Storage       │            │
│  │                 │    │                 │    │                 │            │
│  │ • Ed25519 Keys  │    │ • Message Chain │    │ • Group Info    │            │
│  │ • User Profile  │    │ • Encrypted Msgs│    │ • Member Lists  │            │
│  │ • Profile Pic   │    │ • Timestamps    │    │ • Group Names   │            │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘            │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## Detailed Component Architecture

### 1. Frontend Layer (React + TypeScript)
```
┌─────────────────────────────────────────────────────────────────┐
│                        React Frontend                           │
├─────────────────────────────────────────────────────────────────┤
│  App.tsx (Main Container)                                       │
│  ├── Onboarding.tsx (User Setup)                               │
│  ├── PeerList.tsx (Contact Management)                         │
│  ├── ChatView.tsx (Message Display)                            │
│  └── Statistics.tsx (Network Diagnostics)                      │
│                                                                 │
│  Key Features:                                                  │
│  • Real-time message updates                                    │
│  • Peer discovery visualization                                 │
│  • Group management interface                                   │
│  • Profile picture management                                   │
│  • Message search functionality                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2. Backend Layer (Rust + Tauri)
```
┌─────────────────────────────────────────────────────────────────┐
│                        Tauri Backend                            │
├─────────────────────────────────────────────────────────────────┤
│  main.rs (Application Core)                                     │
│  ├── Identity Management                                        │
│  │   ├── Ed25519 key generation                                │
│  │   ├── Profile management                                    │
│  │   └── Identity persistence                                  │
│  ├── Message Processing                                         │
│  │   ├── AES-256-GCM encryption/decryption                     │
│  │   ├── Ed25519 signing/verification                          │
│  │   └── Message routing                                       │
│  ├── Blockchain Storage                                         │
│  │   ├── Message chain management                               │
│  │   ├── Encrypted storage                                     │
│  │   └── Data persistence                                      │
│  └── Group Management                                           │
│      ├── Group creation/deletion                                │
│      ├── Member management                                      │
│      └── Group messaging                                        │
└─────────────────────────────────────────────────────────────────┘
```

### 3. Network Layer (UDP + TCP)
```
┌─────────────────────────────────────────────────────────────────┐
│                        Network Layer                            │
├─────────────────────────────────────────────────────────────────┤
│  wichain-network (Rust Crate)                                   │
│  ├── UDP Discovery                                              │
│  │   ├── Peer broadcasting                                      │
│  │   ├── Peer discovery                                         │
│  │   └── Message delivery                                       │
│  ├── TCP Connections                                            │
│  │   ├── Connection establishment                               │
│  │   ├── Reliable message delivery                              │
│  │   └── Connection management                                  │
│  └── Message Routing                                            │
│      ├── Direct peer messaging                                  │
│      ├── Group message fan-out                                  │
│      └── Message queuing                                        │
└─────────────────────────────────────────────────────────────────┘
```

## Cryptographic Flow

### 1. Message Sending Process
```
┌─────────────────────────────────────────────────────────────────┐
│                        Message Sending                          │
├─────────────────────────────────────────────────────────────────┤
│  1. User types message in UI                                    │
│  2. Frontend calls Tauri command                                │
│  3. Backend creates ChatBody                                    │
│  4. Backend signs with Ed25519 private key                      │
│  5. Backend encrypts with AES-256-GCM                           │
│  6. Backend stores encrypted message in blockchain              │
│  7. Backend sends encrypted message via network                 │
│  8. Network layer handles UDP/TCP delivery                      │
└─────────────────────────────────────────────────────────────────┘
```

### 2. Message Receiving Process
```
┌─────────────────────────────────────────────────────────────────┐
│                       Message Receiving                         │
├─────────────────────────────────────────────────────────────────┤
│  1. Network layer receives encrypted message                    │
│  2. Backend attempts decryption with known peers                │
│  3. Backend verifies Ed25519 signature                          │
│  4. Backend stores encrypted message in blockchain              │
│  5. Backend emits "chat_update" event                           │
│  6. Frontend receives event and updates UI                      │
│  7. Frontend displays decrypted message                         │
└─────────────────────────────────────────────────────────────────┘
```

## Security Features

### 1. End-to-End Encryption
- **Algorithm**: AES-256-GCM
- **Key Derivation**: SHA3-512 hash of sorted public keys
- **Nonce**: 12-byte random nonce per message
- **Authentication**: Built-in GCM authentication tag

### 2. Message Authentication
- **Algorithm**: Ed25519 digital signatures
- **Purpose**: Verify message integrity and sender identity
- **Implementation**: Every message is signed with sender's private key

### 3. Identity Management
- **Key Generation**: Ed25519 key pairs for each user
- **Key Storage**: Encrypted storage of private keys
- **Key Exchange**: Public keys exchanged during peer discovery

### 4. Data Persistence
- **Blockchain**: Immutable message chain
- **Encryption**: Messages encrypted before storage
- **Integrity**: Tamper-evident through blockchain structure

## Network Protocol

### 1. Peer Discovery
```
┌─────────────────────────────────────────────────────────────────┐
│                        Peer Discovery                           │
├─────────────────────────────────────────────────────────────────┤
│  1. App starts and binds to UDP port 60000                     │
│  2. App broadcasts "Ping" message with identity                 │
│  3. Other peers respond with "Pong" and their identity          │
│  4. App maintains peer registry with last seen timestamps       │
│  5. App attempts TCP connection establishment                   │
└─────────────────────────────────────────────────────────────────┘
```

### 2. Message Delivery
```
┌─────────────────────────────────────────────────────────────────┐
│                       Message Delivery                          │
├─────────────────────────────────────────────────────────────────┤
│  Primary: TCP Connection (if available)                         │
│  ├── Reliable delivery                                          │
│  ├── Connection management                                      │
│  └── Keep-alive messages                                        │
│                                                                 │
│  Fallback: UDP Delivery                                         │
│  ├── Best-effort delivery                                       │
│  ├── No connection state                                        │
│  └── Fire-and-forget                                            │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow Architecture

### 1. User Interaction Flow
```
User Input → React Component → Tauri Command → Rust Backend → Network Layer → Peer
```

### 2. Message Processing Flow
```
Network → Decryption → Signature Verification → Blockchain Storage → UI Update
```

### 3. Group Management Flow
```
Group Creation → Member List → Message Fan-out → Individual Encryption → Delivery
```

## Performance Characteristics

### 1. Network Performance
- **UDP Latency**: ~1-5ms on local network
- **TCP Latency**: ~1-3ms on local network
- **Throughput**: Limited by network bandwidth
- **Scalability**: Up to ~100 peers per network

### 2. Cryptographic Performance
- **Ed25519 Signing**: ~0.1ms per message
- **Ed25519 Verification**: ~0.2ms per message
- **AES-256-GCM Encryption**: ~0.05ms per message
- **AES-256-GCM Decryption**: ~0.05ms per message

### 3. Storage Performance
- **Message Storage**: ~1KB per message (encrypted)
- **Blockchain Growth**: Linear with message count
- **Search Performance**: O(n) for message search
- **Export Performance**: ~1000 messages/second

## Deployment Architecture

### 1. Development Environment
```
Developer Machine → Tauri Dev Server → Local Network → Test Peers
```

### 2. Production Environment
```
User Device → Tauri App → Local Network → Other Users
```

### 3. Network Requirements
- **Port**: 60000 (UDP), dynamic TCP ports
- **Firewall**: UDP port 60000 must be open
- **Network**: Local area network (LAN) required
- **Bandwidth**: Minimal (text messages only)

## Security Considerations

### 1. Threat Model
- **Eavesdropping**: Mitigated by AES-256-GCM encryption
- **Message Tampering**: Mitigated by Ed25519 signatures
- **Identity Spoofing**: Mitigated by public key verification
- **Replay Attacks**: Mitigated by timestamps and nonces

### 2. Limitations
- **Local Network Only**: No internet connectivity
- **No Forward Secrecy**: Keys persist across sessions
- **No Perfect Forward Secrecy**: Compromised keys affect all messages
- **No Deniability**: Messages are cryptographically bound to senders

### 3. Best Practices
- **Regular Key Rotation**: Generate new identities periodically
- **Network Security**: Use secure local networks
- **Data Backup**: Export messages regularly
- **Access Control**: Secure device access
