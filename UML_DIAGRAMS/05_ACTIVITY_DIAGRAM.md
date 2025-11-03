# Activity Diagram - WiChain

## Message Flow Process

```mermaid
graph LR
    Start([User Input]) --> Validate[Validate Input]
    Validate --> Sign[Sign Ed25519]
    Sign --> Chain[Add Blockchain<br/>SHA3-512]
    Chain --> Encrypt[Encrypt<br/>AES-256-GCM]
    
    Encrypt --> CheckPeer{Peer<br/>Available?}
    CheckPeer -->|No| Error([Error])
    CheckPeer -->|Yes| Send[TCP Send<br/>Port 61000]
    
    Send --> ACK{ACK?}
    ACK -->|No| Retry{Retry<br/>< 3?}
    Retry -->|Yes| Send
    Retry -->|No| Fail([Failed])
    ACK -->|Yes| Success([Success])
    
    style Sign fill:#6bcf7f
    style Chain fill:#ffd93d
    style Encrypt fill:#6bcf7f
    style Send fill:#4ecdc4
```

## Process Description

### Main Flow
1. **User Input** - Different message types handled
2. **Validation** - Size and format checks
3. **Signing** - Ed25519 digital signature
4. **Blockchain** - Add to local blockchain with SHA3-512
5. **Encryption** - AES-256-GCM with random nonce
6. **Transport** - TCP delivery with retry logic
7. **Confirmation** - ACK/NACK handling

### Parallel Processes
- **Peer Discovery** - Continuous UDP broadcast (500ms interval)
- **Registry Maintenance** - Remove stale peers (>30s timeout)
- **Connection Management** - TCP connection pool

### Error Handling
- Offline peer detection
- Retry mechanism (3 attempts)
- Signature verification failure paths
- Network timeout handling
