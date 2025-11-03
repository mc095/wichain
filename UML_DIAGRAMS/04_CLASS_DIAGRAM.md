# Class Diagram - WiChain

## Core System Classes

```mermaid
classDiagram
    %% Frontend
    class App {
        -identity: Identity
        -peers: PeerInfo[]
        -messages: Map
        +handleSend()
        +handleCreateGroup()
    }
    
    %% Backend Core
    class AppState {
        +identity: StoredIdentity
        +blockchain: Blockchain
        +network: NetworkNode
        +groups: GroupManager
    }
    
    class StoredIdentity {
        +alias: String
        +private_key_b64: String
        +public_key_b64: String
    }
    
    class ChatSigned {
        +body: ChatBody
        +sig_b64: String
        +verify() bool
    }
    
    class ChatBody {
        +from: String
        +to: String
        +text: String
        +ts_ms: u64
    }
    
    %% Blockchain
    class Blockchain {
        +chain: Vec~Block~
        +add_block()
        +is_valid() bool
    }
    
    class Block {
        +index: u64
        +data: String
        +previous_hash: String
        +hash: String
        +calculate_hash()
    }
    
    %% Network
    class NetworkNode {
        +id: String
        +peers: HashMap
        +send_message()
        +get_peers()
    }
    
    class PeerInfo {
        +id: String
        +alias: String
        +pubkey: String
    }
    
    %% Groups
    class GroupManager {
        -groups: HashMap
        +create_group()
        +list_groups()
    }
    
    class GroupInfo {
        +id: String
        +members: Vec~String~
        +name: String
    }
    
    %% Crypto
    class SigningKey {
        +sign()
        +verifying_key()
    }
    
    class VerifyingKey {
        +verify_strict()
    }
    
    %% Relationships
    App --> AppState
    AppState --> StoredIdentity
    AppState --> Blockchain
    AppState --> NetworkNode
    AppState --> GroupManager
    AppState --> SigningKey
    
    ChatSigned --> ChatBody
    ChatSigned --> SigningKey
    ChatSigned --> VerifyingKey
    
    Blockchain --> Block
    NetworkNode --> PeerInfo
    GroupManager --> GroupInfo
    SigningKey --> VerifyingKey
```

## Core Relationships

### Frontend-Backend Communication
- **App** orchestrates all UI components
- Components communicate via Tauri API commands
- Backend emits events that update frontend state

### Backend Architecture
- **AppState** is the central state manager
- All Tauri commands access AppState
- AppState coordinates between modules

### Blockchain Layer
- **Blockchain** manages chain of **Block**s
- Each Block contains data and cryptographic hash
- Blocks can contain SignedMessages or DirectTextPayload

### Network Layer
- **NetworkNode** manages peer discovery and connections
- Uses **TcpConnectionManager** for persistent connections
- **PeerInfo** exposed to frontend, **PeerEntry** internal

### Cryptography
- **SigningKey** for creating signatures
- **VerifyingKey** for verification
- **CryptoUtils** for AES encryption

### Group Management
- **GroupManager** maintains group registry
- **GroupInfo** stores group metadata
- Signed messages for group operations
