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
}

/* ------------------------------------------------------------------ */
/* Identity                                                           */
/* ------------------------------------------------------------------ */

export async function apiGetIdentity(): Promise<Identity> {
  return invoke<Identity>('get_identity');
}

export async function apiSetAlias(newAlias: string): Promise<boolean> {
  try {
    // backend param: new_alias
    await invoke('set_alias', { new_alias: newAlias });
    return true;
  } catch (err) {
    console.error('set_alias failed', err);
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
export async function apiCreateGroup(members: string[]): Promise<string | null> {
  try {
    const id = await invoke<string>('create_group', { members });
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
export async function apiAddPeerMessage(
  text: string,
  peerId: string,
): Promise<boolean> {
  try {
    if (!peerId?.trim()) {
      console.warn('apiAddPeerMessage: empty peerId');
      return false;
    }
    // backend params: content, to_peer
    await invoke('add_chat_message', {
      content: text,
      to_peer: peerId,
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
    if (!groupId?.trim()) {
      console.warn('apiAddGroupMessage: empty groupId');
      return false;
    }
    // backend params: content, group_id
    await invoke('add_group_message', {
      content: text,
      group_id: groupId,
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
