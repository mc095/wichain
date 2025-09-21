// frontend/src/lib/api.ts
// ------------------------------------------------------------------
// WiChain frontend API bindings for Tauri backend (AES + Groups build)
// ------------------------------------------------------------------

import { invoke } from '@tauri-apps/api/core';

/* ------------------------------------------------------------------ */
/* Backend-mirrored types                                             */
/* ------------------------------------------------------------------ */

export interface Identity {
  alias: string;
  private_key_b64: string;
  public_key_b64: string;
  profile_picture?: string; // Base64 encoded image data
}

export interface PeerInfo {
  id: string;      // pubkey b64
  alias: string;
  pubkey: string;  // duplicate: same as id in our build (kept for compat)
  last_seen_ms?: number;
}

/**
 * Logical chat payload used throughout the app.
 * - `to` is peer pubkey (for 1:1) OR group_id (for groups).
 */
export interface ChatBody {
  from: string;
  to?: string | null;
  text: string;
  ts_ms: number;
}

/**
 * In-memory group info (not persisted); backend will re-create on request.
 */
export interface GroupInfo {
  id: string;        // stable hash (hex) from sorted members
  members: string[]; // pubkey b64 (includes self)
  name?: string;     // optional group name
  profile_picture?: string; // optional group profile picture
}

/* ------------------------------------------------------------------ */
/* Identity                                                           */
/* ------------------------------------------------------------------ */

export async function apiGetIdentity(): Promise<Identity> {
  return invoke<Identity>('get_identity');
}

export async function apiSetAlias(newAlias: string): Promise<boolean> {
  try {
    await invoke('set_alias', {
      new_alias: newAlias, // new backend
      newAlias,            // older backend
    });
    return true;
  } catch (err) {
    console.error('set_alias failed', err);
    return false;
  }
}

export async function apiSetProfilePicture(profilePicture: string | null): Promise<boolean> {
  try {
    await invoke('set_profile_picture', { profile_picture: profilePicture });
    return true;
  } catch (err) {
    console.error('set_profile_picture failed', err);
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Peers                                                              */
/* ------------------------------------------------------------------ */

export async function apiGetPeers(): Promise<PeerInfo[]> {
  try {
    const peers = await invoke<PeerInfo[]>('get_peers');
    return peers ?? [];
  } catch (err) {
    console.error('get_peers failed', err);
    return [];
  }
}

/* ------------------------------------------------------------------ */
/* Groups                                                             */
/* ------------------------------------------------------------------ */

/**
 * Create (or get existing) group. Backend expects *all* members, including self.
 * Returns the computed group_id (hex string).
 */
export async function apiCreateGroup(members: string[], name?: string): Promise<string | null> {
  try {
    const id = await invoke<string>('create_group', { members, name });
    return id;
  } catch (err) {
    console.error('create_group failed', err);
    return null;
  }
}

/** List all in-memory groups known to backend. */
export async function apiListGroups(): Promise<GroupInfo[]> {
  try {
    return await invoke<GroupInfo[]>('list_groups');
  } catch (err) {
    console.error('list_groups failed', err);
    return [];
  }
}

/* ------------------------------------------------------------------ */
/* Chat                                                               */
/* ------------------------------------------------------------------ */

/** Send *peer* message (must give a peer id). */
/** Send *peer* message (must give a peer id). */
export async function apiAddPeerMessage(
  text: string,
  peerId: string,
): Promise<boolean> {
  try {
    const pid = peerId?.trim();
    if (!pid) {
      console.warn('apiAddPeerMessage: empty peerId');
      return false;
    }
    await invoke('add_chat_message', {
      content: text,
      to_peer: pid, // new backend
      toPeer: pid,  // older backend
    });
    return true;
  } catch (err) {
    console.error('add_chat_message failed', err);
    return false;
  }
}

/** Send *group* message. */
export async function apiAddGroupMessage(
  text: string,
  groupId: string,
): Promise<boolean> {
  try {
    const gid = groupId?.trim();
    if (!gid) {
      console.warn('apiAddGroupMessage: empty groupId');
      return false;
    }
    await invoke('add_group_message', {
      content: text,
      group_id: gid, // new backend
      groupId: gid,  // older backend
    });
    return true;
  } catch (err) {
    console.error('add_group_message failed', err);
    return false;
  }
}

/** Pull *all* chats we have locally (backend already filters by membership). */
export async function apiGetChatHistory(): Promise<ChatBody[]> {
  try {
    return await invoke<ChatBody[]>('get_chat_history');
  } catch (err) {
    console.error('get_chat_history failed', err);
    return [];
  }
}

/* ------------------------------------------------------------------ */
/* Reset                                                              */
/* ------------------------------------------------------------------ */

/** Reset chat only (identity preserved). */
export async function apiResetData(): Promise<boolean> {
  try {
    await invoke('reset_data');
    return true;
  } catch (err) {
    console.error('reset_data failed', err);
    return false;
  }
}

/** Test network connectivity (debug command). */
export async function apiTestNetwork(): Promise<string> {
  try {
    return await invoke<string>('test_network_connectivity');
  } catch (err) {
    console.error('test_network_connectivity failed', err);
    return 'Network test failed';
  }
}


/* ------------------------------------------------------------------ */
/* TCP Connection Management                                          */
/* ------------------------------------------------------------------ */

/** Request TCP connection to a specific peer. */
export async function apiRequestTcpConnection(peerId: string): Promise<boolean> {
  try {
    await invoke('request_tcp_connection', { peer_id: peerId });
    return true;
  } catch (err) {
    console.error('request_tcp_connection failed', err);
    return false;
  }
}

/** Check if we have TCP connection to a peer. */
export async function apiHasTcpConnection(peerId: string): Promise<boolean> {
  try {
    return await invoke<boolean>('has_tcp_connection', { peer_id: peerId });
  } catch (err) {
    console.error('has_tcp_connection failed', err);
    return false;
  }
}

/** Test TCP connection to a peer and measure response time. */
export async function apiTestTcpConnection(peerId: string): Promise<number> {
  try {
    return await invoke<number>('test_tcp_connection', { peer_id: peerId });
  } catch (err) {
    console.error('test_tcp_connection failed', err);
    return -1;
  }
}

/** Get connection statistics for a peer. */
export async function apiGetConnectionStats(peerId: string): Promise<ConnectionStats | null> {
  try {
    return await invoke<ConnectionStats | null>('get_connection_stats', { peer_id: peerId });
  } catch (err) {
    console.error('get_connection_stats failed', err);
    return null;
  }
}

/** Update all peer connection types based on actual status. */
export async function apiUpdateAllConnectionTypes(): Promise<boolean> {
  try {
    await invoke('update_all_connection_types');
    return true;
  } catch (err) {
    console.error('update_all_connection_types failed', err);
    return false;
  }
}

/** Test encryption/decryption with a specific peer. */
export async function apiTestEncryptionWithPeer(peerId: string, testMessage: string): Promise<string> {
  try {
    return await invoke<string>('test_encryption_with_peer', { 
      peer_id: peerId, 
      test_message: testMessage 
    });
  } catch (err) {
    console.error('test_encryption_with_peer failed', err);
    return `❌ Encryption test failed: ${err}`;
  }
}

/** Get comprehensive network and encryption status. */
export async function apiGetNetworkStatus(): Promise<NetworkStatus> {
  try {
    return await invoke<NetworkStatus>('get_network_status');
  } catch (err) {
    console.error('get_network_status failed', err);
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

/* ------------------------------------------------------------------ */
/* Delete Functions                                                   */
/* ------------------------------------------------------------------ */

/** Delete all messages with a specific peer. */
export async function apiDeletePeerMessages(peerId: string): Promise<boolean> {
  try {
    await invoke('delete_peer_messages', { peer_id: peerId });
    return true;
  } catch (err) {
    console.error('delete_peer_messages failed', err);
    return false;
  }
}

/** Delete all messages with a specific group. */
export async function apiDeleteGroupMessages(groupId: string): Promise<boolean> {
  try {
    await invoke('delete_group_messages', { group_id: groupId });
    return true;
  } catch (err) {
    console.error('delete_group_messages failed', err);
    return false;
  }
}

/** Delete a group entirely (messages + group). */
export async function apiDeleteGroup(groupId: string): Promise<boolean> {
  try {
    await invoke('delete_group', { group_id: groupId });
    return true;
  } catch (err) {
    console.error('delete_group failed', err);
    return false;
  }
}

/** Update group name. */
export async function apiUpdateGroupName(groupId: string, name: string | null): Promise<boolean> {
  try {
    await invoke('update_group_name', { group_id: groupId, name });
    return true;
  } catch (err) {
    console.error('update_group_name failed', err);
    return false;
  }
}

/** Update group profile picture. */
export async function apiUpdateGroupProfilePicture(groupId: string, profilePicture: string | null): Promise<boolean> {
  try {
    await invoke('update_group_profile_picture', { group_id: groupId, profile_picture: profilePicture });
    return true;
  } catch (err) {
    console.error('update_group_profile_picture failed', err);
    return false;
  }
}

/** Export all messages to JSON file. */
export async function apiExportMessagesToJson(): Promise<string> {
  try {
    return await invoke<string>('export_messages_to_json');
  } catch (err) {
    console.error('export_messages_to_json failed', err);
    throw new Error('Failed to export messages');
  }
}

/** Test message sending with detailed logging. */
export async function apiTestMessageSending(peerId: string, testMessage: string): Promise<string> {
  try {
    return await invoke<string>('test_message_sending', { 
      peer_id: peerId, 
      test_message: testMessage 
    });
  } catch (err) {
    console.error('test_message_sending failed', err);
    return `❌ Message sending test failed: ${err}`;
  }
}

/* ------------------------------------------------------------------ */
/* Types for Connection Monitoring                                    */
/* ------------------------------------------------------------------ */

export interface ConnectionStats {
  peer_id: string;
  is_connected: boolean;
  message_count: number;
  last_activity_ms: number;
  last_test_time_ms?: number;
}

export interface NetworkStatus {
  my_id: string;
  udp_port: number;
  tcp_port: number;
  total_peers: number;
  peer_statuses: PeerStatus[];
  encryption_algorithm: string;
}

export interface PeerStatus {
  id: string;
  alias: string;
  connection_type: string;
  tcp_port?: number;
  last_seen_ms: number;
}