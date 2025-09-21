# WiChain Developer & Tester Guide

## Quick Reset Commands

### 1. Complete App Reset (New User Identity)
```bash
# Stop the app if running
# Delete all user data
rm -rf ~/AppData/Roaming/wichain-backend/WiChain/
# On Windows:
rmdir /s "%APPDATA%\wichain-backend\WiChain"
# On macOS:
rm -rf ~/Library/Application\ Support/wichain-backend/WiChain/
# On Linux:
rm -rf ~/.local/share/wichain-backend/WiChain/

# Restart the app - it will create a new identity
cargo tauri dev
```

### 2. Clear Chat History Only (Keep Identity)
```bash
# Use the in-app "Reset Data" button in Statistics panel
# OR manually delete blockchain file:
rm ~/AppData/Roaming/wichain-backend/WiChain/blockchain.json
# On Windows:
del "%APPDATA%\wichain-backend\WiChain\blockchain.json"
```

### 3. Reset Network/Peer Data
```bash
# Clear peer discovery cache
rm ~/AppData/Roaming/wichain-backend/WiChain/peers.json
# On Windows:
del "%APPDATA%\wichain-backend\WiChain\peers.json"
```

### 4. Development Reset Scripts

#### Windows Reset Script (`reset_app.bat`)
```batch
@echo off
echo Resetting WiChain app data...
rmdir /s /q "%APPDATA%\wichain-backend\WiChain"
echo App data cleared. Restart the app to create new identity.
pause
```

#### Linux/macOS Reset Script (`reset_app.sh`)
```bash
#!/bin/bash
echo "Resetting WiChain app data..."
rm -rf ~/.local/share/wichain-backend/WiChain/
rm -rf ~/Library/Application\ Support/wichain-backend/WiChain/
rm -rf ~/AppData/Roaming/wichain-backend/WiChain/
echo "App data cleared. Restart the app to create new identity."
```

## File Locations

### Windows
- **App Data**: `%APPDATA%\wichain-backend\WiChain\`
- **Identity**: `%APPDATA%\wichain-backend\WiChain\identity.json`
- **Blockchain**: `%APPDATA%\wichain-backend\WiChain\blockchain.json`
- **Groups**: Stored in memory (lost on restart)

### macOS
- **App Data**: `~/Library/Application Support/wichain-backend/WiChain/`
- **Identity**: `~/Library/Application Support/wichain-backend/WiChain/identity.json`
- **Blockchain**: `~/Library/Application Support/wichain-backend/WiChain/blockchain.json`

### Linux
- **App Data**: `~/.local/share/wichain-backend/WiChain/`
- **Identity**: `~/.local/share/wichain-backend/WiChain/identity.json`
- **Blockchain**: `~/.local/share/wichain-backend/WiChain/blockchain.json`

## Testing Commands

### 1. Network Testing
```bash
# Test network connectivity
cargo tauri dev
# Then use in-app Statistics panel to test:
# - WiFi name detection
# - Peer discovery
# - TCP/UDP connections
```

### 2. Encryption Testing
```bash
# Test AES-256-GCM encryption
# Use in-app "Test Encryption" button in Statistics panel
```

### 3. Message Testing
```bash
# Test message sending/receiving
# 1. Start two instances of the app
# 2. Create different identities
# 3. Send messages between them
# 4. Test group messaging
```

## Development Commands

### 1. Build Commands
```bash
# Development build
cargo tauri dev

# Production build
cargo tauri build

# Frontend only (for UI development)
cd frontend && npm run dev
```

### 2. Debug Commands
```bash
# Run with debug logging
RUST_LOG=debug cargo tauri dev

# Check network ports
netstat -an | findstr :60000
# On Linux/macOS:
netstat -an | grep :60000
```

### 3. Clean Build
```bash
# Clean Rust build cache
cargo clean

# Clean Tauri build cache
rm -rf src-tauri/target/
rm -rf frontend/dist/
rm -rf frontend/node_modules/
npm install
```

## Testing Scenarios

### 1. Identity Management
- [ ] New user registration
- [ ] Alias change
- [ ] Profile picture upload
- [ ] Identity persistence across restarts

### 2. Network Discovery
- [ ] Peer discovery on same network
- [ ] Multiple peers on network
- [ ] Network changes (WiFi switch)
- [ ] Offline/online transitions

### 3. Messaging
- [ ] Direct peer-to-peer messages
- [ ] Group messages
- [ ] Message encryption/decryption
- [ ] Message persistence
- [ ] Message search functionality

### 4. Group Management
- [ ] Group creation
- [ ] Group name setting
- [ ] Group profile picture
- [ ] Group member management
- [ ] Group deletion

### 5. Data Management
- [ ] Chat history export
- [ ] Message deletion
- [ ] Group deletion
- [ ] Data reset functionality

## Troubleshooting

### Common Issues

1. **App won't start**
   - Check if port 60000 is available
   - Clear app data and restart
   - Check firewall settings

2. **Peers not discovered**
   - Ensure devices are on same network
   - Check UDP port 60000 is open
   - Restart network discovery

3. **Messages not sending**
   - Check network connectivity
   - Verify peer is online
   - Test with different peer

4. **Encryption errors**
   - Clear app data and restart
   - Check if peer has valid identity
   - Test with fresh identities

### Debug Information
- Check console logs for network errors
- Use Statistics panel for network diagnostics
- Export messages for analysis
- Test encryption with known peers

## Performance Testing

### 1. Load Testing
```bash
# Test with multiple peers
# Send bulk messages
# Test group messaging with many members
```

### 2. Network Testing
```bash
# Test on different network types
# Test with network interruptions
# Test with high latency
```

### 3. Storage Testing
```bash
# Test with large message history
# Test message export with many messages
# Test data persistence
```

## Security Testing

### 1. Encryption Testing
- Verify AES-256-GCM encryption
- Test key derivation
- Test message integrity

### 2. Authentication Testing
- Test Ed25519 signatures
- Test message verification
- Test identity validation

### 3. Network Security
- Test message interception
- Test replay attacks
- Test man-in-the-middle scenarios
