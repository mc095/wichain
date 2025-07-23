# WiChain: Decentralized LAN Chat with Blockchain-backed History

WiChain is a unique peer-to-peer chat application designed for local area networks (LANs). It blends a modern desktop user interface built with React and Tauri with a tamper-evident blockchain ledger to store chat history, offering a robust and secure local communication solution.

## ✨ Features

  * **Direct Peer & Group Messaging**: Communicate directly with other users or in ephemeral groups over your LAN using UDP, without needing a central server.
  * **Signed, Verifiable Messages**: All messages are signed using Ed25519, allowing recipients to verify the sender's authenticity.
  * **Blockchain-backed Chat History**: Each node maintains a local, append-only blockchain, providing a tamper-evident record of all chat activity.
  * **Ephemeral Group Chats**: Create temporary group chats with deterministic group IDs based on sorted member public keys.
  * **Simple Message Obfuscation**: Messages are lightly obfuscated using SHA3-512 XOR for basic confidentiality on the LAN (note: this is not strong encryption).
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

**Note**: WiChain's obfuscation is not strong encryption. For robust privacy, consider integrating a more secure encryption scheme. There is no global consensus; each node maintains its own local blockchain.

## 🚀 Quickstart

1.  **Build Rust workspace**: Navigate to the `wichain/` directory and run `cargo build`.
2.  **Build Frontend**: Change directory to `wichain-backend/frontend/` and execute `npm install && npm run build`.
3.  **Run Tauri App**: From the `wichain-backend/` directory, run `cargo tauri dev`.
4.  Open the application on two or more devices connected to the same LAN and start chatting\!

## ❤️ Credits & License

WiChain is an open-source project designed for learning and experimentation, built with Rust, React, and Tauri. It's student-friendly and perfect for exploring decentralized chat and blockchain principles.
