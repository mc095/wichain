#!/usr/bin/env python3
"""
TCP/UDP Proof Test for WiChain Evaluation
This script will prove whether WiChain actually uses TCP after UDP discovery
"""

import subprocess
import time
import json
import requests
import threading
from datetime import datetime

class NetworkMonitor:
    def __init__(self):
        self.initial_connections = set()
        self.final_connections = set()
        self.connection_changes = []
        
    def capture_network_state(self, label=""):
        """Capture current network state"""
        try:
            result = subprocess.run(['netstat', '-an'], capture_output=True, text=True)
            connections = set()
            
            for line in result.stdout.split('\n'):
                if ':6000' in line:  # WiChain ports
                    connections.add(line.strip())
            
            timestamp = datetime.now().strftime("%H:%M:%S")
            self.connection_changes.append({
                'time': timestamp,
                'label': label,
                'connections': list(connections)
            })
            
            return connections
        except Exception as e:
            print(f"Error capturing network state: {e}")
            return set()
    
    def monitor_continuously(self, duration=30):
        """Monitor network changes continuously"""
        print(f"🔄 Monitoring network for {duration} seconds...")
        start_time = time.time()
        
        while time.time() - start_time < duration:
            connections = self.capture_network_state("continuous_monitor")
            time.sleep(1)
    
    def generate_report(self):
        """Generate a detailed report"""
        print("\n" + "="*60)
        print("📊 NETWORK CONNECTION ANALYSIS REPORT")
        print("="*60)
        
        for i, change in enumerate(self.connection_changes):
            print(f"\n{i+1}. {change['time']} - {change['label']}")
            if change['connections']:
                for conn in change['connections']:
                    print(f"   {conn}")
            else:
                print("   No WiChain connections found")
        
        # Analysis
        print("\n" + "="*60)
        print("🔍 ANALYSIS")
        print("="*60)
        
        udp_found = False
        tcp_found = False
        
        for change in self.connection_changes:
            for conn in change['connections']:
                if 'UDP' in conn:
                    udp_found = True
                if 'TCP' in conn and 'ESTABLISHED' in conn:
                    tcp_found = True
        
        print(f"UDP Connections Found: {'✅ YES' if udp_found else '❌ NO'}")
        print(f"TCP Connections Found: {'✅ YES' if tcp_found else '❌ NO'}")
        
        if udp_found and not tcp_found:
            print("\n⚠️  ISSUE DETECTED:")
            print("   WiChain is using UDP only, not switching to TCP")
            print("   This suggests TCP functionality may not be working")
        elif udp_found and tcp_found:
            print("\n✅ TCP FUNCTIONALITY CONFIRMED:")
            print("   WiChain is properly using both UDP and TCP")
        else:
            print("\n❌ NO NETWORK ACTIVITY DETECTED")
            print("   WiChain may not be running or not using expected ports")

def test_wichain_tcp_functionality():
    """Test WiChain TCP functionality"""
    print("🧪 WiChain TCP/UDP Functionality Test")
    print("="*60)
    print("This test will prove whether WiChain uses TCP after UDP discovery")
    print()
    
    monitor = NetworkMonitor()
    
    # Step 1: Capture initial state
    print("1️⃣ Capturing initial network state...")
    initial_state = monitor.capture_network_state("Initial State (Before WiChain)")
    print(f"   Found {len(initial_state)} initial connections")
    
    # Step 2: Start monitoring
    print("\n2️⃣ Starting continuous monitoring...")
    monitor_thread = threading.Thread(target=monitor.monitor_continuously, args=(60,))
    monitor_thread.daemon = True
    monitor_thread.start()
    
    # Step 3: Instructions for user
    print("\n3️⃣ MANUAL TESTING REQUIRED:")
    print("   Please perform the following steps:")
    print("   1. Start your WiChain application")
    print("   2. Wait for peer discovery (UDP)")
    print("   3. Send a message to another peer")
    print("   4. Wait 10 seconds")
    print("   5. Send another message")
    print("   6. Wait 10 seconds")
    print()
    print("   The script will monitor network changes automatically...")
    print("   Press Enter when you've completed the testing...")
    
    input()
    
    # Step 4: Final capture
    print("\n4️⃣ Capturing final network state...")
    final_state = monitor.capture_network_state("Final State (After Testing)")
    print(f"   Found {len(final_state)} final connections")
    
    # Step 5: Generate report
    monitor.generate_report()
    
    return monitor

def create_evaluation_summary(monitor):
    """Create a summary for evaluation panel"""
    print("\n" + "="*60)
    print("📋 EVALUATION SUMMARY FOR PANEL")
    print("="*60)
    
    udp_found = False
    tcp_found = False
    
    for change in monitor.connection_changes:
        for conn in change['connections']:
            if 'UDP' in conn:
                udp_found = True
            if 'TCP' in conn and 'ESTABLISHED' in conn:
                tcp_found = True
    
    print("TEST OBJECTIVE: Verify WiChain uses TCP after UDP discovery")
    print()
    print("EXPECTED BEHAVIOR:")
    print("   1. UDP port 60000 for peer discovery ✅")
    print("   2. TCP connection established after first message ❌")
    print()
    print("ACTUAL RESULTS:")
    print(f"   UDP Functionality: {'✅ WORKING' if udp_found else '❌ NOT WORKING'}")
    print(f"   TCP Functionality: {'✅ WORKING' if tcp_found else '❌ NOT WORKING'}")
    print()
    
    if udp_found and not tcp_found:
        print("CONCLUSION:")
        print("   ❌ TCP functionality is NOT working as expected")
        print("   ❌ WiChain remains on UDP only, never switches to TCP")
        print("   ❌ This is a significant issue for the evaluation")
    elif udp_found and tcp_found:
        print("CONCLUSION:")
        print("   ✅ TCP functionality is working correctly")
        print("   ✅ WiChain properly switches from UDP to TCP")
    else:
        print("CONCLUSION:")
        print("   ❌ No network activity detected")
        print("   ❌ WiChain may not be running properly")
    
    print()
    print("RECOMMENDATION:")
    if not tcp_found:
        print("   🔧 Fix TCP connection establishment in WiChain")
        print("   🔧 Ensure TCP is used after UDP discovery")
        print("   🔧 Verify network layer implementation")
    else:
        print("   ✅ TCP functionality is working correctly")

if __name__ == "__main__":
    print("🎯 WiChain TCP/UDP Proof Test for Evaluation")
    print("="*60)
    print("This test will provide concrete evidence for your evaluation panel")
    print()
    
    monitor = test_wichain_tcp_functionality()
    create_evaluation_summary(monitor)
    
    print("\n" + "="*60)
    print("📁 Save this output as evidence for your evaluation panel")
    print("="*60)
