#!/usr/bin/env python3
"""
Test TCP Fix for WiChain
Quick test to verify TCP connections are now working
"""

import subprocess
import time
import sys

def check_network_status():
    """Check current network status"""
    print("🔍 Checking WiChain Network Status After TCP Fix...")
    print("=" * 60)
    
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
        
        print("\n" + "=" * 60)
        print("ANALYSIS:")
        
        if udp_connections and tcp_connections:
            print("✅ BOTH UDP AND TCP - TCP fix is working!")
            print("   WiChain is now properly using both protocols")
            return True
        elif udp_connections and not tcp_connections:
            print("⚠️  UDP ONLY - TCP still not working")
            print("   Need to trigger TCP connection by sending messages")
            return False
        elif not udp_connections and not tcp_connections:
            print("❌ NO CONNECTIONS - WiChain not running")
            return False
        else:
            print("⚠️  UNEXPECTED STATE")
            return False
        
    except Exception as e:
        print(f"Error: {e}")
        return False

def monitor_for_tcp_changes():
    """Monitor for TCP connection changes"""
    print("\n🔄 Monitoring for TCP connection changes...")
    print("Please send a message in WiChain to trigger TCP connection")
    print("Monitoring for 30 seconds...")
    print("=" * 60)
    
    initial_udp = 0
    initial_tcp = 0
    
    # Get initial state
    try:
        result = subprocess.run(['netstat', '-an'], capture_output=True, text=True)
        for line in result.stdout.split('\n'):
            if ':6000' in line:
                if 'UDP' in line:
                    initial_udp += 1
                elif 'TCP' in line:
                    initial_tcp += 1
    except:
        pass
    
    print(f"Initial state: {initial_udp} UDP, {initial_tcp} TCP")
    
    # Monitor for changes
    for i in range(30):
        time.sleep(1)
        try:
            result = subprocess.run(['netstat', '-an'], capture_output=True, text=True)
            current_udp = 0
            current_tcp = 0
            
            for line in result.stdout.split('\n'):
                if ':6000' in line:
                    if 'UDP' in line:
                        current_udp += 1
                    elif 'TCP' in line:
                        current_tcp += 1
            
            if current_tcp > initial_tcp:
                print(f"\n🎉 TCP CONNECTION DETECTED!")
                print(f"   TCP connections: {current_tcp} (was {initial_tcp})")
                print("   ✅ TCP fix is working!")
                return True
            
            if i % 5 == 0:  # Print status every 5 seconds
                print(f"   {30-i}s remaining... UDP: {current_udp}, TCP: {current_tcp}")
                
        except:
            pass
    
    print(f"\n⏰ Monitoring completed. No TCP connections detected.")
    return False

if __name__ == "__main__":
    print("🧪 WiChain TCP Fix Test")
    print("=" * 60)
    print("Testing if TCP functionality is now working after fixes")
    print()
    
    # Check current status
    tcp_working = check_network_status()
    
    if not tcp_working:
        print("\n💡 To test TCP functionality:")
        print("   1. Make sure WiChain application is running")
        print("   2. Send a message to another peer")
        print("   3. Run this test again")
        print()
        
        # Ask if user wants to monitor
        response = input("Do you want to monitor for TCP changes while you test? (y/n): ")
        if response.lower() == 'y':
            tcp_working = monitor_for_tcp_changes()
    
    print("\n" + "=" * 60)
    if tcp_working:
        print("🎉 SUCCESS: TCP functionality is working!")
        print("✅ WiChain now properly uses both UDP and TCP")
        print("✅ Ready for evaluation!")
    else:
        print("⚠️  TCP functionality still needs work")
        print("❌ May need additional fixes or testing")
    print("=" * 60)
