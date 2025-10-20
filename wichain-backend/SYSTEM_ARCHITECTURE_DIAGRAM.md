# WiChain System Architecture - Mermaid Diagrams

## High-Level System Architecture

```mermaid
graph TB
    subgraph "WiChain Application"
        subgraph "Frontend Layer"
            UI[React Frontend]
            ChatUI[Chat UI]
            PeerList[Peer List]
            GroupMgmt[Group Management]
            Settings[Settings]
        end
        
        subgraph "Backend Layer"
            Tauri[Tauri Backend]
            Identity[Identity Management]
            MessageProc[Message Processing]
            Blockchain[Blockchain Storage]
            GroupManager[Group Manager]
        end
        
        subgraph "Network Layer"
            UDP[UDP Discovery]
            TCP[TCP Connections]
            PeerDisc[Peer Discovery]
            MessageRelay[Message Relay]
        end
    end
    
    subgraph "Cryptographic Layer"
        Ed25519[Ed25519 Signatures]
        AES[AES-256-GCM Encryption]
        SHA3[SHA3-512 Key Derivation]
    end
    
    subgraph "Data Storage Layer"
        IdentityStore[Identity Storage]
        BlockchainStore[Blockchain Storage]
        GroupStore[Group Data Storage]
    end
    
    UI --> Tauri
    ChatUI --> MessageProc
    PeerList --> Identity
    GroupMgmt --> GroupManager
    
    Tauri --> UDP
    Tauri --> TCP
    MessageProc --> Blockchain
    Identity --> IdentityStore
    GroupManager --> GroupStore
    
    MessageProc --> Ed25519
    MessageProc --> AES
    Identity --> SHA3
    
    Blockchain --> BlockchainStore
    UDP --> PeerDisc
    TCP --> MessageRelay
```

## Detailed Component Architecture

```mermaid
graph TB
    subgraph "React Frontend"
        App[App.tsx - Main Container]
        Onboarding[Onboarding.tsx - User Setup]
        PeerListComp[PeerList.tsx - Contact Management]
        ChatView[ChatView.tsx - Message Display]
        Statistics[Statistics.tsx - Network Diagnostics]
        
        App --> Onboarding
        App --> PeerListComp
        App --> ChatView
        App --> Statistics
    end
    
    subgraph "Tauri Backend"
        Main[main.rs - Application Core]
        IdentityMgmt[Identity Management]
        MessageProc[Message Processing]
        BlockchainMgmt[Blockchain Storage]
        GroupMgmt[Group Management]
        
        Main --> IdentityMgmt
        Main --> MessageProc
        Main --> BlockchainMgmt
        Main --> GroupMgmt
    end
    
    subgraph "Network Stack"
        NetworkCrate[wichain-network Rust Crate]
        UDPDisc[UDP Discovery]
        TCPConn[TCP Connections]
        MessageRouting[Message Routing]
        
        NetworkCrate --> UDPDisc
        NetworkCrate --> TCPConn
        NetworkCrate --> MessageRouting
    end
    
    App -.-> Main
    ChatView -.-> MessageProc
    PeerListComp -.-> IdentityMgmt
    GroupMgmt -.-> GroupMgmt
```

## Cryptographic Flow

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Backend
    participant Network
    participant Peer
    
    Note over User,Peer: Message Sending Process
    User->>Frontend: Types message
    Frontend->>Backend: Tauri command
    Backend->>Backend: Create ChatBody
    Backend->>Backend: Sign with Ed25519
    Backend->>Backend: Encrypt with AES-256-GCM
    Backend->>Backend: Store in blockchain
    Backend->>Network: Send encrypted message
    Network->>Peer: UDP/TCP delivery
    
    Note over User,Peer: Message Receiving Process
    Peer->>Network: Encrypted message
    Network->>Backend: Receive message
    Backend->>Backend: Decrypt with AES-256-GCM
    Backend->>Backend: Verify Ed25519 signature
    Backend->>Backend: Store in blockchain
    Backend->>Frontend: Emit "chat_update" event
    Frontend->>User: Display message
```

## Network Protocol Flow

```mermaid
sequenceDiagram
    participant App1
    participant Network
    participant App2
    
    Note over App1,App2: Peer Discovery
    App1->>Network: Bind to UDP port 60000
    App1->>Network: Broadcast "Ping" with identity
    Network->>App2: Forward ping
    App2->>Network: Respond with "Pong" and identity
    Network->>App1: Forward pong
    App1->>App1: Update peer registry
    App1->>App2: Attempt TCP connection
    
    Note over App1,App2: Message Delivery
    App1->>App2: Try TCP delivery (primary)
    alt TCP Success
        App2->>App1: TCP acknowledgment
    else TCP Failure
        App1->>Network: Fallback to UDP
        Network->>App2: UDP delivery
    end
```

## Data Flow Architecture

```mermaid
flowchart LR
    subgraph "User Interaction Flow"
        A[User Input] --> B[React Component]
        B --> C[Tauri Command]
        C --> D[Rust Backend]
        D --> E[Network Layer]
        E --> F[Peer]
    end
    
    subgraph "Message Processing Flow"
        G[Network] --> H[Decryption]
        H --> I[Signature Verification]
        I --> J[Blockchain Storage]
        J --> K[UI Update]
    end
    
    subgraph "Group Management Flow"
        L[Group Creation] --> M[Member List]
        M --> N[Message Fan-out]
        N --> O[Individual Encryption]
        O --> P[Delivery]
    end
```

## Security Architecture

```mermaid
graph TB
    subgraph "Security Layers"
        subgraph "Authentication Layer"
            Ed25519[Ed25519 Digital Signatures]
            KeyMgmt[Key Management]
            Identity[Identity Verification]
        end
        
        subgraph "Encryption Layer"
            AES[AES-256-GCM Encryption]
            KeyDeriv[Key Derivation SHA3-512]
            Nonce[Nonce Management]
        end
        
        subgraph "Data Integrity Layer"
            Blockchain[Blockchain Storage]
            TamperEvid[Tamper Evidence]
            Immutable[Immutable Chain]
        end
    end
    
    subgraph "Threat Mitigation"
        Eavesdrop[Eavesdropping Protection]
        Tampering[Message Tampering Protection]
        Spoofing[Identity Spoofing Protection]
        Replay[Replay Attack Protection]
    end
    
    Ed25519 --> Tampering
    AES --> Eavesdrop
    KeyMgmt --> Spoofing
    Nonce --> Replay
    Blockchain --> TamperEvid
```

## Deployment Architecture

```mermaid
graph TB
    subgraph "Development Environment"
        Dev[Developer Machine]
        TauriDev[Tauri Dev Server]
        LocalNet[Local Network]
        TestPeers[Test Peers]
        
        Dev --> TauriDev
        TauriDev --> LocalNet
        LocalNet --> TestPeers
    end
    
    subgraph "Production Environment"
        UserDevice[User Device]
        TauriApp[Tauri App]
        LAN[Local Area Network]
        OtherUsers[Other Users]
        
        UserDevice --> TauriApp
        TauriApp --> LAN
        LAN --> OtherUsers
    end
    
    subgraph "Network Requirements"
        Port[Port 60000 UDP]
        Firewall[Firewall Configuration]
        Bandwidth[Minimal Bandwidth]
        LANReq[LAN Required]
    end
    
    TauriApp --> Port
    TauriApp --> Firewall
    TauriApp --> Bandwidth
    TauriApp --> LANReq
```

## Performance Characteristics

```mermaid
graph LR
    subgraph "Network Performance"
        UDPLat[UDP Latency: 1-5ms]
        TCPLat[TCP Latency: 1-3ms]
        Throughput[Limited by Bandwidth]
        Scale[Up to 100 peers]
    end
    
    subgraph "Crypto Performance"
        Sign[Ed25519 Sign: 0.1ms]
        Verify[Ed25519 Verify: 0.2ms]
        Encrypt[AES Encrypt: 0.05ms]
        Decrypt[AES Decrypt: 0.05ms]
    end
    
    subgraph "Storage Performance"
        MsgSize[1KB per message]
        Growth[Linear growth]
        Search[O(n) search]
        Export[1000 msg/sec export]
    end
```

## Component Interaction Diagram

```mermaid
graph TB
    subgraph "Frontend Components"
        App[App.tsx]
        ChatView[ChatView.tsx]
        PeerList[PeerList.tsx]
        Onboarding[Onboarding.tsx]
        GroupModal[GroupModal.tsx]
    end
    
    subgraph "Backend Services"
        Identity[Identity Service]
        Message[Message Service]
        Group[Group Service]
        Network[Network Service]
        Blockchain[Blockchain Service]
    end
    
    subgraph "External Dependencies"
        Tauri[Tauri Runtime]
        Crypto[Crypto Libraries]
        NetworkStack[Network Stack]
    end
    
    App --> ChatView
    App --> PeerList
    App --> Onboarding
    App --> GroupModal
    
    ChatView --> Message
    PeerList --> Identity
    Onboarding --> Identity
    GroupModal --> Group
    
    Message --> Network
    Message --> Blockchain
    Group --> Network
    Identity --> Crypto
    Network --> NetworkStack
    
    Message --> Tauri
    Identity --> Tauri
    Group --> Tauri
    Network --> Tauri
    Blockchain --> Tauri
```

This comprehensive set of Mermaid diagrams visualizes the complete WiChain system architecture, including:

1. **High-Level System Architecture** - Overall system structure
2. **Detailed Component Architecture** - Frontend, Backend, and Network layers
3. **Cryptographic Flow** - Message sending and receiving processes
4. **Network Protocol Flow** - Peer discovery and message delivery
5. **Data Flow Architecture** - User interaction, message processing, and group management flows
6. **Security Architecture** - Security layers and threat mitigation
7. **Deployment Architecture** - Development and production environments
8. **Performance Characteristics** - Network, crypto, and storage performance metrics
9. **Component Interaction Diagram** - How different components interact with each other

Each diagram focuses on a specific aspect of the system while maintaining consistency with the overall architecture described in the SYSTEM_ARCHITECTURE.md document.

