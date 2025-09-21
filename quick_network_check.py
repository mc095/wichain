#!/usr/bin/env python3
"""
Quick Network Check for WiChain
Shows current TCP/UDP status immediately
"""

import subprocess
import time

def check_network_now():
    """Check current network status"""
    print("🔍 Current WiChain Network Status")
    print("=" * 40)
    
    try:
        result = subprocess.run(['netstat', '-an'], capture_output=True, text=True)
        
        udp_connections = []
        tcp_connections = []
        
        for line in result.stdout.split('\n'):
            if ':6000' in line:  # WiChain ports
                if 'UDP' in line:
                    udp_connections.append(line.strip())
                elif 'TCP' in line:
                    tcp_connections.append(line.strip())
        
        print(f"UDP Connections: {len(udp_connections)}")
        for conn in udp_connections:
            print(f"  {conn}")
        
        print(f"\nTCP Connections: {len(tcp_connections)}")
        for conn in tcp_connections:
            print(f"  {conn}")
        
        print("\n" + "=" * 40)
        print("ANALYSIS:")
        
        if udp_connections and not tcp_connections:
            print("❌ UDP ONLY - TCP not working")
            print("   WiChain should switch to TCP after first message")
            print("   This is a problem for your evaluation!")
        elif udp_connections and tcp_connections:
            print("✅ BOTH UDP AND TCP - Working correctly")
        elif not udp_connections and not tcp_connections:
            print("❌ NO CONNECTIONS - WiChain not running")
        else:
            print("⚠️  UNEXPECTED STATE")
        
        return len(udp_connections), len(tcp_connections)
        
    except Exception as e:
        print(f"Error: {e}")
        return 0, 0

if __name__ == "__main__":
    udp_count, tcp_count = check_network_now()
    
    print(f"\nSUMMARY: {udp_count} UDP, {tcp_count} TCP connections")
    
    if udp_count > 0 and tcp_count == 0:
        print("\n🚨 ISSUE FOR EVALUATION:")
        print("   WiChain is not using TCP as expected")
        print("   This needs to be fixed before evaluation")
    
    input("\nPress Enter to exit...")
