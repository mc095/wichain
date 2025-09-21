#!/usr/bin/env python3
"""
Network Port Checker for WiChain
Shows active TCP/UDP connections for WiChain ports
"""

import subprocess
import time
import sys

def run_netstat():
    """Run netstat and parse results"""
    try:
        result = subprocess.run(['netstat', '-an'], capture_output=True, text=True)
        return result.stdout
    except Exception as e:
        print(f"Error running netstat: {e}")
        return ""

def check_wichain_ports():
    """Check for WiChain related ports"""
    print("🔍 Checking WiChain Network Ports...")
    print("=" * 50)
    
    netstat_output = run_netstat()
    if not netstat_output:
        print("❌ Could not run netstat")
        return
    
    # Look for WiChain ports (60000-60010 range)
    wichain_ports = []
    for line in netstat_output.split('\n'):
        if ':6000' in line:  # Ports 60000-60099
            wichain_ports.append(line.strip())
    
    if wichain_ports:
        print("📡 WiChain Network Activity Found:")
        for port in wichain_ports:
            print(f"   {port}")
    else:
        print("❌ No WiChain network activity detected")
        print("   Make sure WiChain application is running")
    
    print("\n🔍 All Network Connections (filtered):")
    print("-" * 50)
    
    # Show all connections with port numbers
    for line in netstat_output.split('\n'):
        if any(port in line for port in [':6000', ':6001', ':6002', ':6003', ':6004', ':6005']):
            print(f"   {line.strip()}")

def monitor_network_activity():
    """Monitor network activity for changes"""
    print("\n🔄 Monitoring Network Activity...")
    print("Press Ctrl+C to stop monitoring")
    print("=" * 50)
    
    previous_ports = set()
    
    try:
        while True:
            netstat_output = run_netstat()
            current_ports = set()
            
            for line in netstat_output.split('\n'):
                if ':6000' in line:
                    current_ports.add(line.strip())
            
            # Check for changes
            new_ports = current_ports - previous_ports
            removed_ports = previous_ports - current_ports
            
            if new_ports:
                print(f"\n🆕 NEW CONNECTIONS:")
                for port in new_ports:
                    print(f"   {port}")
            
            if removed_ports:
                print(f"\n❌ CLOSED CONNECTIONS:")
                for port in removed_ports:
                    print(f"   {port}")
            
            if new_ports or removed_ports:
                print(f"   Time: {time.strftime('%H:%M:%S')}")
            
            previous_ports = current_ports
            time.sleep(2)  # Check every 2 seconds
            
    except KeyboardInterrupt:
        print("\n\n✅ Monitoring stopped")

def show_network_info():
    """Show network information and tips"""
    print("\n📋 Network Information:")
    print("=" * 50)
    print("WiChain Default Ports:")
    print("   UDP 60000 - Main WiChain port")
    print("   TCP 60001+ - Dynamic TCP ports for connections")
    print()
    print("What to look for:")
    print("   UDP 0.0.0.0:60000 - WiChain listening for peers")
    print("   TCP ESTABLISHED - Active TCP connections")
    print("   TCP LISTENING - TCP server waiting for connections")
    print()
    print("To see TCP connections:")
    print("   1. Start WiChain application")
    print("   2. Connect to another peer")
    print("   3. Send messages (may trigger TCP)")
    print("   4. Run this script to monitor changes")

if __name__ == "__main__":
    print("🌐 WiChain Network Port Monitor")
    print("=" * 50)
    
    if len(sys.argv) > 1 and sys.argv[1] == "monitor":
        check_wichain_ports()
        monitor_network_activity()
    else:
        check_wichain_ports()
        show_network_info()
        
        print("\n💡 To monitor network changes in real-time:")
        print("   python check_network_ports.py monitor")
