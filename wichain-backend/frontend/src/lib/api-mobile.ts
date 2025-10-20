// Mobile-compatible API using HTTP instead of Tauri invoke
// Mobile apps connect to backend server running on laptop

import type { Identity, PeerInfo, ChatBody, GroupInfo, ConnectionStats, NetworkStatus } from './api';

// Detect if running on mobile (Capacitor)
const isMobile = typeof (window as any).Capacitor !== 'undefined';

// Backend server URL - MUST be set to your laptop's IP address
// Example: 'http://192.168.1.100:3030' (find your IP with ipconfig/ifconfig)
const BACKEND_URL = localStorage.getItem('backend_url') || 'http://localhost:3030';

// Helper to make HTTP requests
async function httpRequest<T>(endpoint: string, method: string = 'GET', body?: any): Promise<T> {
  try {
    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };
    
    if (body) {
      options.body = JSON.stringify(body);
    }
    
    const response = await fetch(`${BACKEND_URL}${endpoint}`, options);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(`HTTP request failed: ${endpoint}`, error);
    throw error;
  }
}

// Set backend URL dynamically (for settings UI)
export function setBackendUrl(url: string) {
  localStorage.setItem('backend_url', url);
  window.location.reload(); // Reload to apply
}

export function getBackendUrl(): string {
  return BACKEND_URL;
}

export function isMobileApp(): boolean {
  return isMobile;
}

/* ------------------------------------------------------------------ */
/* Mobile API Functions                                               */
/* ------------------------------------------------------------------ */

export async function mobileApiGetIdentity(): Promise<Identity> {
  return httpRequest<Identity>('/api/identity', 'GET');
}

export async function mobileApiSetAlias(newAlias: string): Promise<boolean> {
  try {
    await httpRequest('/api/identity/alias', 'POST', { alias: newAlias });
    return true;
  } catch {
    return false;
  }
}

export async function mobileApiGetPeers(): Promise<PeerInfo[]> {
  try {
    return await httpRequest<PeerInfo[]>('/api/peers', 'GET');
  } catch {
    return [];
  }
}

export async function mobileApiCreateGroup(members: string[], name?: string): Promise<string | null> {
  try {
    const result = await httpRequest<{ group_id: string }>('/api/groups', 'POST', { members, name });
    return result.group_id;
  } catch {
    return null;
  }
}

export async function mobileApiListGroups(): Promise<GroupInfo[]> {
  try {
    return await httpRequest<GroupInfo[]>('/api/groups', 'GET');
  } catch {
    return [];
  }
}

export async function mobileApiAddPeerMessage(text: string, peerId: string): Promise<boolean> {
  try {
    await httpRequest('/api/messages/peer', 'POST', { content: text, to_peer: peerId });
    return true;
  } catch {
    return false;
  }
}

export async function mobileApiAddGroupMessage(text: string, groupId: string): Promise<boolean> {
  try {
    await httpRequest('/api/messages/group', 'POST', { content: text, group_id: groupId });
    return true;
  } catch {
    return false;
  }
}

export async function mobileApiGetChatHistory(): Promise<ChatBody[]> {
  try {
    return await httpRequest<ChatBody[]>('/api/messages', 'GET');
  } catch {
    return [];
  }
}

export async function mobileApiResetData(): Promise<boolean> {
  try {
    await httpRequest('/api/reset', 'POST');
    return true;
  } catch {
    return false;
  }
}

export async function mobileApiTestNetwork(): Promise<string> {
  try {
    const result = await httpRequest<{ status: string }>('/api/network/test', 'GET');
    return result.status;
  } catch (error) {
    return `Network test failed: ${error}`;
  }
}

export async function mobileApiGetNetworkStatus(): Promise<NetworkStatus> {
  try {
    return await httpRequest<NetworkStatus>('/api/network/status', 'GET');
  } catch {
    return {
      my_id: '',
      udp_port: 0,
      tcp_port: 0,
      total_peers: 0,
      peer_statuses: [],
      encryption_algorithm: 'Unknown'
    };
  }
}

// Connection management
export async function mobileApiRequestTcpConnection(peerId: string): Promise<boolean> {
  try {
    await httpRequest('/api/connection/request', 'POST', { peer_id: peerId });
    return true;
  } catch {
    return false;
  }
}

export async function mobileApiHasTcpConnection(peerId: string): Promise<boolean> {
  try {
    const result = await httpRequest<{ connected: boolean }>('/api/connection/status', 'POST', { peer_id: peerId });
    return result.connected;
  } catch {
    return false;
  }
}

export async function mobileApiGetConnectionStats(peerId: string): Promise<ConnectionStats | null> {
  try {
    return await httpRequest<ConnectionStats>('/api/connection/stats', 'POST', { peer_id: peerId });
  } catch {
    return null;
  }
}

// Delete functions
export async function mobileApiDeletePeerMessages(peerId: string): Promise<boolean> {
  try {
    await httpRequest('/api/messages/peer', 'DELETE', { peer_id: peerId });
    return true;
  } catch {
    return false;
  }
}

export async function mobileApiDeleteGroupMessages(groupId: string): Promise<boolean> {
  try {
    await httpRequest('/api/messages/group', 'DELETE', { group_id: groupId });
    return true;
  } catch {
    return false;
  }
}

export async function mobileApiUpdateGroupName(groupId: string, name: string | null): Promise<boolean> {
  try {
    await httpRequest('/api/groups/name', 'PUT', { group_id: groupId, name });
    return true;
  } catch {
    return false;
  }
}
