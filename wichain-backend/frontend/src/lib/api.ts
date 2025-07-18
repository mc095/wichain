// src/lib/api.ts
import { invoke } from '@tauri-apps/api/core';

// ---- Types that mirror backend (loose; tolerant of backend changes) ----
export interface PeerInfo {
  id: string;
  alias: string;
  pubkey: string;
}

export interface Block {
  index: number;
  timestamp_ms: number;         // if missing in JSON we patch
  previous_hash: string;
  nonce: number;
  hash: string;
  raw_data: string;
  payload?: {
    type: string;               // e.g., "Text", "Messages"
    text?: string;
    messages?: SignedMessage[];
  };
}

export interface SignedMessage {
  id: string;
  from: string;
  to?: string | null;
  timestamp_ms: number;
  content: string;
  sig: string;
}

export interface Blockchain {
  chain: Block[];
}

// Accept a variety of identity return types
export interface Identity {
  alias?: string;
  public_key?: string;
  private_key?: string;
  id_string?: string; // fallback when backend returns plain string
}

// ---- Helpers ----
function safeParseJson<T>(s: unknown): T | null {
  if (typeof s !== 'string') return null;
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

// ---- API calls ----
export async function apiGetIdentity(): Promise<Identity> {
  try {
    const res = await invoke<unknown>('get_identity'); // backend may return struct OR string
    if (typeof res === 'string') {
      return { id_string: res };
    }
    return res as Identity;
  } catch (err) {
    console.error('get_identity failed', err);
    return { id_string: 'error' };
  }
}

export async function apiGetPeers(): Promise<PeerInfo[]> {
  try {
    const peers = await invoke<unknown>('get_peers');
    if (Array.isArray(peers)) {
      return peers.map((p) => ({
        id: p.id ?? '',
        alias: p.alias ?? '(unknown)',
        pubkey: p.pubkey ?? '',
      }));
    }
    return [];
  } catch (err) {
    console.error('get_peers failed', err);
    return [];
  }
}

export async function apiGetBlockchain(): Promise<Blockchain> {
  try {
    const res = await invoke<unknown>('get_blockchain');
    // backend returns JSON string
    const parsed = safeParseJson<Blockchain>(res);
    return parsed ?? { chain: [] };
  } catch (err) {
    console.error('get_blockchain failed', err);
    return { chain: [] };
  }
}

export async function apiAddMessage(text: string): Promise<boolean> {
  try {
    await invoke('add_message', { message: text });
    return true;
  } catch (err) {
    console.error('add_message failed', err);
    return false;
  }
}
