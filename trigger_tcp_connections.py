#!/usr/bin/env python3
"""
Trigger TCP Connections for WiChain
This script helps you manually trigger TCP connections for testing
"""

import subprocess
import time
import sys

def check_current_status():
    """Check current network status"""
    print("🔍 Current Network Status:")
    print("=" * 40)
    
    try:
        result = subprocess.run(['netstat', '-an'], capture_output=True, text=True)
        
        udp_count = 0
        tcp_listening = 0
        tcp_established = 0
        
        for line in result.stdout.split('\n'):
            if ':6000' in line:
                if 'UDP' in line:
                    udp_count += 1
                    print(f"UDP: {line.strip()}")
                elif 'TCP' in line:
                    if 'LISTENING' in line:
                        tcp_listening += 1
                        print(f"TCP LISTENING: {line.strip()}")
                    elif 'ESTABLISHED' in line:
                        tcp_established += 1
                        print(f"TCP ESTABLISHED: {line.strip()}")
        
        print(f"\nSummary: {udp_count} UDP, {tcp_listening} TCP listening, {tcp_established} TCP established")
        return udp_count, tcp_listening, tcp_established
        
    except Exception as e:
        print(f"Error: {e}")
        return 0, 0, 0

def monitor_for_tcp_changes():
    """Monitor for TCP connection changes"""
    print("\n🔄 Monitoring for TCP connection changes...")
    print("Please use the WiChain app to:")
    print("1. Send a message to another peer")
    print("2. Or use the 'Force TCP Connections' button if available")
    print("\nMonitoring for 30 seconds...")
    print("=" * 50)
    
    initial_udp, initial_listening, initial_established = check_current_status()
    
    for i in range(30):
        time.sleep(1)
        try:
            result = subprocess.run(['netstat', '-an'], capture_output=True, text=True)
            
            current_udp = 0
            current_listening = 0
            current_established = 0
            
            for line in result.stdout.split('\n'):
                if ':6000' in line:
                    if 'UDP' in line:
                        current_udp += 1
                    elif 'TCP' in line:
                        if 'LISTENING' in line:
                            current_listening += 1
                        elif 'ESTABLISHED' in line:
                            current_established += 1
            
            if current_established > initial_established:
                print(f"\n🎉 TCP CONNECTION ESTABLISHED!")
                print(f"   ESTABLISHED connections: {current_established} (was {initial_established})")
                print("   ✅ TCP functionality is working!")
                return True
            
            if i % 5 == 0:  # Print status every 5 seconds
                print(f"   {30-i}s remaining... UDP: {current_udp}, TCP: {current_listening} listening, {current_established} established")
                
        except:
            pass
    
    print(f"\n⏰ Monitoring completed. No new TCP connections detected.")
    return False

def main():
    print("🚀 WiChain TCP Connection Trigger")
    print("=" * 50)
    print("This script helps you test TCP functionality")
    print()
    
    # Check initial status
    udp, listening, established = check_current_status()
    
    if udp == 0:
        print("❌ No UDP connections found. Make sure WiChain is running!")
        return
    
    if listening == 0:
        print("❌ No TCP listener found. TCP functionality may not be working.")
        return
    
    print(f"✅ WiChain is running (UDP: {udp}, TCP listening: {listening})")
    
    if established > 0:
        print("✅ TCP connections already established!")
        return
    
    print("\n💡 To establish TCP connections:")
    print("1. Make sure you have another WiChain instance running")
    print("2. Send a message between the instances")
    print("3. Or use the 'Force TCP Connections' feature in WiChain")
    print()
    
    response = input("Do you want to monitor for TCP changes while you test? (y/n): ")
    if response.lower() == 'y':
        success = monitor_for_tcp_changes()
        
        print("\n" + "=" * 50)
        if success:
            print("🎉 SUCCESS: TCP connections are working!")
            print("✅ WiChain is properly using both UDP and TCP")
        else:
            print("⚠️  No TCP connections detected")
            print("❌ May need to check WiChain configuration")
        print("=" * 50)

if __name__ == "__main__":
    main()
