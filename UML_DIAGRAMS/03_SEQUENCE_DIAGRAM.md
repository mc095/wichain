# Sequence Diagram - WiChain

## Complete Message Flow (Send & Receive)

```mermaid
sequenceDiagram
    participant S as Sender
    participant SApp as Sender App
    participant Net as Network
    participant RApp as Receiver App
    participant R as Receiver
    
    S->>SApp: Type & Send Message
    SApp->>SApp: Create ChatBody
    SApp->>SApp: Sign (Ed25519)
    SApp->>SApp: Add to Blockchain (SHA3-512)
    SApp->>SApp: Encrypt (AES-256-GCM)
    SApp->>Net: TCP Send (Port 61000)
    
    Net->>RApp: Message Received
    RApp->>RApp: Decrypt (AES-256-GCM)
    RApp->>RApp: Verify Signature
    
    alt Valid Signature
        RApp->>RApp: Add to Blockchain
        RApp->>R: Display ✓ Verified
        RApp-->>Net: ACK
        Net-->>SApp: ACK
        SApp->>S: Sent ✓
    else Invalid
        RApp->>R: Reject ⚠️
        RApp-->>Net: NACK
        Net-->>SApp: NACK
        SApp->>S: Failed ❌
    end
```

## Key Components

- **Ed25519 Signing**: All messages digitally signed for authenticity
- **AES-256-GCM Encryption**: Message confidentiality with nonce
- **SHA3-512 Blockchain**: Tamper-evident message history
- **TCP Transport**: Reliable delivery on port 61000
- **Dual Verification**: Both sender and receiver update blockchain independently
