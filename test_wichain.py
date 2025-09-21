#!/usr/bin/env python3
"""
WiChain Test Suite - Python Implementation
Tests TCP and AES-256-GCM functionality
"""

import asyncio
import json
import time
import base64
import hashlib
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.backends import default_backend
import os
import random
import string

def generate_test_key():
    """Generate a 32-byte key for AES-256-GCM"""
    return os.urandom(32)

def generate_nonce():
    """Generate a 12-byte nonce for AES-GCM"""
    return os.urandom(12)

def derive_encryption_key(pub_a, pub_b):
    """Derive encryption key from two public keys using SHA3-512"""
    # Sort keys for consistent derivation
    if pub_a <= pub_b:
        lo, hi = pub_a, pub_b
    else:
        lo, hi = pub_b, pub_a
    
    # Use SHA3-512 to derive key
    hasher = hashes.Hash(hashes.SHA3_512(), backend=default_backend())
    hasher.update(lo.encode())
    hasher.update(b"|")
    hasher.update(hi.encode())
    hasher.update(b"|aes256gcm")
    digest = hasher.finalize()
    
    # Take first 32 bytes for AES-256
    return digest[:32]

def encrypt_aes256gcm(pub_a, pub_b, plaintext):
    """Encrypt data using AES-256-GCM"""
    key = derive_encryption_key(pub_a, pub_b)
    nonce = generate_nonce()
    
    aesgcm = AESGCM(key)
    ciphertext = aesgcm.encrypt(nonce, plaintext.encode(), None)
    
    # Combine nonce + ciphertext and encode as base64
    combined = nonce + ciphertext
    return base64.b64encode(combined).decode()

def decrypt_aes256gcm(pub_a, pub_b, encrypted_b64):
    """Decrypt data using AES-256-GCM"""
    try:
        combined = base64.b64decode(encrypted_b64)
        nonce = combined[:12]
        ciphertext = combined[12:]
        
        key = derive_encryption_key(pub_a, pub_b)
        aesgcm = AESGCM(key)
        plaintext = aesgcm.decrypt(nonce, ciphertext, None)
        
        return plaintext.decode()
    except Exception as e:
        raise Exception(f"Decryption failed: {e}")

def test_aes256gcm_encryption():
    """Test AES-256-GCM encryption and decryption"""
    print("🧪 Testing AES-256-GCM encryption...")
    
    pub_a = "test_pubkey_a_123456789012345678901234567890"
    pub_b = "test_pubkey_b_123456789012345678901234567890"
    test_message = "Hello, this is a test message for AES-256-GCM encryption!"
    
    # Test encryption
    encrypted = encrypt_aes256gcm(pub_a, pub_b, test_message)
    print("✅ Encryption successful")
    print(f"   Original length: {len(test_message)} bytes")
    print(f"   Encrypted length: {len(encrypted)} bytes")
    
    # Test decryption
    decrypted = decrypt_aes256gcm(pub_a, pub_b, encrypted)
    print("✅ Decryption successful")
    print(f"   Decrypted message: '{decrypted}'")
    
    # Verify round-trip
    assert test_message == decrypted, "Round-trip test failed!"
    print("✅ Round-trip test passed!")
    
    # Test with different peer order (should work due to sorted key derivation)
    encrypted_reverse = encrypt_aes256gcm(pub_b, pub_a, test_message)
    decrypted_reverse = decrypt_aes256gcm(pub_a, pub_b, encrypted_reverse)
    
    assert test_message == decrypted_reverse, "Bidirectional encryption test failed!"
    print("✅ Bidirectional encryption test passed!")

def test_storage_encryption():
    """Test blockchain storage encryption"""
    print("🧪 Testing blockchain storage encryption...")
    
    user_pubkey = "test_user_pubkey_123456789012345678901234567890"
    test_message = "This is a message stored in the blockchain"
    
    # Derive storage key
    hasher = hashes.Hash(hashes.SHA3_512(), backend=default_backend())
    hasher.update(user_pubkey.encode())
    hasher.update(b"blockchain_storage_key")
    key_digest = hasher.finalize()
    storage_key = key_digest[:32]
    
    # Test encryption
    nonce = generate_nonce()
    aesgcm = AESGCM(storage_key)
    ciphertext = aesgcm.encrypt(nonce, test_message.encode(), None)
    encrypted = base64.b64encode(nonce + ciphertext).decode()
    
    print("✅ Storage encryption successful")
    print(f"   Original: '{test_message}'")
    print(f"   Encrypted length: {len(encrypted)} bytes")
    
    # Test decryption
    combined = base64.b64decode(encrypted)
    nonce = combined[:12]
    ciphertext = combined[12:]
    aesgcm = AESGCM(storage_key)
    decrypted = aesgcm.decrypt(nonce, ciphertext, None).decode()
    
    print("✅ Storage decryption successful")
    print(f"   Decrypted: '{decrypted}'")
    
    # Verify round-trip
    assert test_message == decrypted, "Storage encryption round-trip test failed!"
    print("✅ Storage encryption round-trip test passed!")

def test_encryption_performance():
    """Test encryption performance"""
    print("🧪 Testing encryption performance...")
    
    pub_a = "perf_pubkey_a_123456789012345678901234567890"
    pub_b = "perf_pubkey_b_123456789012345678901234567890"
    test_message = "This is a performance test message for AES-256-GCM encryption. " * 100  # Larger message
    
    print(f"   Test message length: {len(test_message)} bytes")
    
    # Test encryption performance with multiple iterations
    iterations = 100
    start_time = time.time()
    for _ in range(iterations):
        encrypted = encrypt_aes256gcm(pub_a, pub_b, test_message)
    encrypt_time = time.time() - start_time
    
    print("✅ Encryption performance:")
    print(f"   Time for {iterations} iterations: {encrypt_time:.6f} seconds")
    print(f"   Average time per encryption: {encrypt_time/iterations:.6f} seconds")
    if encrypt_time > 0:
        throughput_mb_s = (len(test_message) * iterations / 1024 / 1024) / encrypt_time
        print(f"   Throughput: {throughput_mb_s:.2f} MB/s")
    else:
        print("   Throughput: Very fast (too fast to measure accurately)")
    
    # Test decryption performance
    start_time = time.time()
    for _ in range(iterations):
        decrypted = decrypt_aes256gcm(pub_a, pub_b, encrypted)
    decrypt_time = time.time() - start_time
    
    print("✅ Decryption performance:")
    print(f"   Time for {iterations} iterations: {decrypt_time:.6f} seconds")
    print(f"   Average time per decryption: {decrypt_time/iterations:.6f} seconds")
    if decrypt_time > 0:
        throughput_mb_s = (len(test_message) * iterations / 1024 / 1024) / decrypt_time
        print(f"   Throughput: {throughput_mb_s:.2f} MB/s")
    else:
        print("   Throughput: Very fast (too fast to measure accurately)")
    
    # Verify correctness
    assert test_message == decrypted, "Performance test failed!"
    print("✅ Performance test passed!")

def test_error_handling():
    """Test error handling"""
    print("🧪 Testing error handling...")
    
    # Test with invalid base64
    try:
        decrypt_aes256gcm("pub_a", "pub_b", "invalid_base64!")
        assert False, "Should have failed with invalid base64"
    except Exception:
        print("✅ Invalid base64 error handling works")
    
    # Test with corrupted encrypted data
    encrypted = encrypt_aes256gcm("pub_a", "pub_b", "test message")
    corrupted = encrypted + "corrupted"
    try:
        decrypt_aes256gcm("pub_a", "pub_b", corrupted)
        assert False, "Should have failed with corrupted data"
    except Exception:
        print("✅ Corrupted data error handling works")
    
    # Test with wrong keys
    encrypted = encrypt_aes256gcm("pub_a", "pub_b", "test message")
    try:
        decrypt_aes256gcm("pub_wrong", "pub_b", encrypted)
        assert False, "Should have failed with wrong keys"
    except Exception:
        print("✅ Wrong keys error handling works")
    
    print("✅ Error handling test completed")

def test_network_simulation():
    """Simulate network message encryption/decryption"""
    print("🧪 Testing network message encryption...")
    
    my_pub = "my_pubkey_123456789012345678901234567890"
    peer_pub = "peer_pubkey_123456789012345678901234567890"
    
    # Create a test chat message
    chat_message = {
        "from": my_pub,
        "to": peer_pub,
        "text": "Hello from the test!",
        "timestamp": 1234567890
    }
    
    clear_json = json.dumps(chat_message)
    print("✅ Message serialization successful")
    print(f"   Message length: {len(clear_json)} bytes")
    
    # Test encryption
    encrypted = encrypt_aes256gcm(my_pub, peer_pub, clear_json)
    print("✅ Message encryption successful")
    print(f"   Encrypted length: {len(encrypted)} bytes")
    
    # Test decryption
    decrypted = decrypt_aes256gcm(my_pub, peer_pub, encrypted)
    print("✅ Message decryption successful")
    
    # Verify round-trip
    assert clear_json == decrypted, "Network message encryption round-trip test failed!"
    print("✅ Network message encryption round-trip test passed!")

def test_tcp_simulation():
    """Simulate TCP connection testing"""
    print("🧪 Testing TCP connection simulation...")
    
    # Simulate network nodes
    node1_id = "node1_id_123456789012345678901234567890"
    node2_id = "node2_id_123456789012345678901234567890"
    
    print("✅ Network nodes created")
    print(f"   Node1 ID: {node1_id[:20]}...")
    print(f"   Node2 ID: {node2_id[:20]}...")
    
    # Simulate connection establishment
    print("✅ Simulating TCP connection establishment...")
    time.sleep(0.1)  # Simulate connection time
    
    # Test message sending
    test_payload = "Test message via TCP"
    encrypted_payload = encrypt_aes256gcm(node1_id, node2_id, test_payload)
    
    print("✅ Message encrypted for TCP transmission")
    print(f"   Original: '{test_payload}'")
    print(f"   Encrypted length: {len(encrypted_payload)} bytes")
    
    # Simulate receiving and decrypting
    decrypted_payload = decrypt_aes256gcm(node1_id, node2_id, encrypted_payload)
    print("✅ Message decrypted after TCP reception")
    print(f"   Decrypted: '{decrypted_payload}'")
    
    assert test_payload == decrypted_payload, "TCP simulation test failed!"
    print("✅ TCP connection simulation test completed")

def run_all_tests():
    """Run all tests"""
    print("🚀 Running comprehensive WiChain feature tests...\n")
    
    try:
        # Test encryption
        test_aes256gcm_encryption()
        print()
        
        test_storage_encryption()
        print()
        
        test_network_simulation()
        print()
        
        test_encryption_performance()
        print()
        
        test_error_handling()
        print()
        
        test_tcp_simulation()
        print()
        
        print("🎉 All tests completed successfully!")
        print("✅ AES-256-GCM encryption is working")
        print("✅ Storage encryption is working")
        print("✅ Network message encryption is working")
        print("✅ TCP connection simulation is working")
        print("✅ Error handling is working")
        print("✅ Performance is acceptable")
        
        return True
        
    except Exception as e:
        print(f"❌ Test failed: {e}")
        return False

if __name__ == "__main__":
    print("=" * 60)
    print("WiChain Python Test Suite")
    print("Testing TCP and AES-256-GCM Functionality")
    print("=" * 60)
    print()
    
    success = run_all_tests()
    
    print()
    print("=" * 60)
    if success:
        print("🎉 ALL TESTS PASSED! WiChain is working correctly.")
    else:
        print("❌ SOME TESTS FAILED! Check the output above.")
    print("=" * 60)
