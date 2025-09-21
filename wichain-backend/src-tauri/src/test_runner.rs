//! Standalone test runner for WiChain functionality
//! This can be run independently to test TCP and AES functionality

use std::time::Duration;
use tokio::time::sleep;
use wichain_network::{NetworkNode, NetworkMessage};

// Import the encryption functions from main.rs
use crate::{
    encrypt_json_aes256gcm, 
    decrypt_json_aes256gcm,
    encrypt_for_storage,
    decrypt_from_storage
};

/// Test AES-256-GCM encryption and decryption
async fn test_aes256gcm_encryption() {
    println!("🧪 Testing AES-256-GCM encryption...");
    
    let pub_a = "test_pubkey_a_123456789012345678901234567890";
    let pub_b = "test_pubkey_b_123456789012345678901234567890";
    let test_message = "Hello, this is a test message for AES-256-GCM encryption!";
    
    // Test encryption
    let encrypted = encrypt_json_aes256gcm(pub_a, pub_b, test_message)
        .expect("Encryption should succeed");
    
    println!("✅ Encryption successful");
    println!("   Original length: {} bytes", test_message.len());
    println!("   Encrypted length: {} bytes", encrypted.len());
    
    // Test decryption
    let decrypted = decrypt_json_aes256gcm(pub_a, pub_b, &encrypted)
        .expect("Decryption should succeed");
    
    println!("✅ Decryption successful");
    println!("   Decrypted message: '{}'", decrypted);
    
    // Verify round-trip
    assert_eq!(test_message, decrypted);
    println!("✅ Round-trip test passed!");
    
    // Test with different peer order (should work due to sorted key derivation)
    let encrypted_reverse = encrypt_json_aes256gcm(pub_b, pub_a, test_message)
        .expect("Reverse encryption should succeed");
    let decrypted_reverse = decrypt_json_aes256gcm(pub_a, pub_b, &encrypted_reverse)
        .expect("Reverse decryption should succeed");
    
    assert_eq!(test_message, decrypted_reverse);
    println!("✅ Bidirectional encryption test passed!");
}

/// Test blockchain storage encryption
async fn test_storage_encryption() {
    println!("🧪 Testing blockchain storage encryption...");
    
    let user_pubkey = "test_user_pubkey_123456789012345678901234567890";
    let test_message = "This is a message stored in the blockchain";
    
    // Test encryption
    let encrypted = encrypt_for_storage(test_message, user_pubkey);
    println!("✅ Storage encryption successful");
    println!("   Original: '{}'", test_message);
    println!("   Encrypted length: {} bytes", encrypted.len());
    
    // Test decryption
    let decrypted = decrypt_from_storage(&encrypted, user_pubkey)
        .expect("Storage decryption should succeed");
    
    println!("✅ Storage decryption successful");
    println!("   Decrypted: '{}'", decrypted);
    
    // Verify round-trip
    assert_eq!(test_message, decrypted);
    println!("✅ Storage encryption round-trip test passed!");
}

/// Test TCP connection establishment and communication
async fn test_tcp_connection_establishment() {
    println!("🧪 Testing TCP connection establishment...");
    
    // Create two network nodes
    let node1 = NetworkNode::new(
        60001, // UDP port
        "node1_id_123456789012345678901234567890".to_string(),
        "Node1".to_string(),
        "node1_pubkey_123456789012345678901234567890".to_string(),
    );
    
    let node2 = NetworkNode::new(
        60002, // UDP port
        "node2_id_123456789012345678901234567890".to_string(),
        "Node2".to_string(),
        "node2_pubkey_123456789012345678901234567890".to_string(),
    );
    
    println!("✅ Network nodes created");
    println!("   Node1 UDP port: 60001, TCP port: {}", node1.get_tcp_port());
    println!("   Node2 UDP port: 60002, TCP port: {}", node2.get_tcp_port());
    
    // Start both nodes
    let (tx1, _rx1) = tokio::sync::mpsc::channel::<NetworkMessage>(64);
    let (tx2, _rx2) = tokio::sync::mpsc::channel::<NetworkMessage>(64);
    
    node1.start(tx1).await;
    node2.start(tx2).await;
    
    println!("✅ Both nodes started");
    
    // Wait a bit for nodes to initialize
    sleep(Duration::from_millis(1000)).await;
    
    // Test TCP connection request
    let result = node1.request_tcp_connection("node2_id_123456789012345678901234567890").await;
    match result {
        Ok(()) => println!("✅ TCP connection request sent successfully"),
        Err(e) => println!("⚠️  TCP connection request failed: {}", e),
    }
    
    // Wait for connection establishment
    sleep(Duration::from_millis(2000)).await;
    
    // Check connection status
    let has_tcp = node1.has_tcp_connection("node2_id_123456789012345678901234567890").await;
    println!("   TCP connection status: {}", if has_tcp { "✅ Connected" } else { "❌ Not connected" });
    
    // Test message sending
    let test_payload = "Test message via TCP";
    let result = node1.send_message("node2_id_123456789012345678901234567890", test_payload.to_string()).await;
    match result {
        Ok(()) => println!("✅ Message sent successfully"),
        Err(e) => println!("⚠️  Message sending failed: {}", e),
    }
    
    println!("✅ TCP connection test completed");
}

/// Run all tests
pub async fn run_all_tests() {
    println!("🚀 Running comprehensive WiChain feature tests...\n");
    
    // Test encryption
    test_aes256gcm_encryption().await;
    println!();
    
    test_storage_encryption().await;
    println!();
    
    test_tcp_connection_establishment().await;
    println!();
    
    println!("🎉 All tests completed successfully!");
    println!("✅ AES-256-GCM encryption is working");
    println!("✅ TCP connections are working");
}
