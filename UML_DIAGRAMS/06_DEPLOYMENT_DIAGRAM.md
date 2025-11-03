# Deployment Diagram - WiChain

## UML Deployment Diagram

```mermaid
graph TB
    subgraph PC1["<<device>> Desktop PC 1"]
        RT1["<<execution environment>><br/>Tauri Runtime<br/>wichain.exe"]
        FS1["<<storage>><br/>File System<br/>blockchain.json<br/>identity.json"]
    end
    
    subgraph PC2["<<device>> Desktop PC 2"]
        RT2["<<execution environment>><br/>Tauri Runtime<br/>wichain.exe"]
        FS2["<<storage>><br/>File System<br/>blockchain.json<br/>identity.json"]
    end
    
    NET["<<device>><br/>LAN Router<br/>UDP:8765 TCP:61000"]
    
    RT1 <-->|TCP/IP| NET
    RT2 <-->|TCP/IP| NET
    
    RT1 --> FS1
    RT2 --> FS2
    
    style PC1 fill:#e3f2fd,stroke:#1976d2,stroke-width:3px
    style PC2 fill:#fff3e0,stroke:#f57c00,stroke-width:3px
    style NET fill:#c8e6c9,stroke:#388e3c,stroke-width:3px
    style RT1 fill:#f3e5f5
    style RT2 fill:#f3e5f5
    style FS1 fill:#fff9c4
    style FS2 fill:#fff9c4
```

## Deployment Specifications

### System Requirements
| Component | Specification |
|-----------|--------------|
| **OS** | Windows 10+, Ubuntu 20.04+, macOS 11+ |
| **CPU** | Dual-core 1.5GHz+ |
| **RAM** | 2GB minimum, 4GB recommended |
| **Storage** | 200MB app + 100MB user data |
| **Network** | WiFi 802.11n or Ethernet 100Mbps+ |

### Network Ports
| Port | Protocol | Purpose | Direction |
|------|----------|---------|-----------|
| **8765** | UDP | Peer discovery broadcast | Bidirectional |
| **61000** | TCP | Encrypted message transport | Bidirectional |

### File System Layout
```
~/.wichain/                  (Linux/macOS)
%APPDATA%/wichain/           (Windows)
├── identity.json            (Ed25519 keys, alias)
├── blockchain.json          (Message blockchain)
└── config.json              (App settings)
```

### Installation Packages
| Platform | File | Size |
|----------|------|------|
| **Windows** | wichain_x64.msi | 45MB |
| **Linux** | wichain_amd64.deb | 42MB |
| **Linux** | wichain.AppImage | 48MB |
| **macOS** | wichain_x64.dmg | 50MB |

### Security Layers
1. **Identity** - Ed25519 256-bit keys
2. **Message** - AES-256-GCM encryption
3. **Blockchain** - SHA3-512 hashing
4. **Network** - Per-message encryption
5. **Application** - Memory safety (Rust)

### Network Topology
- ✅ Point-to-Point (Direct)
- ✅ Star (Via Router)
- ✅ 100% Offline LAN
- ⏳ Mesh (Future)
- ⏳ WiFi Direct (Future)
