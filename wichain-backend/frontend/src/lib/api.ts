// frontend/src/lib/api.ts
import { invoke } from '@tauri-apps/api/core';

/* ------------------------------------------------------------------ */
/* Types mirrored from backend                                        */
/* ------------------------------------------------------------------ */

export interface PeerInfo {
  id: string;          // pubkey b64
  alias: string;
  pubkey: string;      // redundant (same as id in current backend)
  last_seen_ms?: number;
}

export interface ChatBody {
  from: string;
  to?: string | null;
  text: string;
  ts_ms: number;
}

/** Minimal “block” so ChatView can keep working (synthetic). */
export interface Block {
  index: number;
  timestamp_ms: number;
  previous_hash: string;
  nonce: number;
  hash: string;
  data?: string;     // ChatBody JSON
}

export interface Blockchain {
  chain: Block[];
}

export interface Identity {
  alias: string;
  private_key_b64: string;
  public_key_b64: string;
}

/* ------------------------------------------------------------------ */
/* API Calls                                                          */
/* ------------------------------------------------------------------ */

export async function apiGetIdentity(): Promise<Identity> {
  return invoke<Identity>('get_identity');
}

export async function apiSetAlias(newAlias: string): Promise<boolean> {
  try {
    await invoke('set_alias', { newAlias });
    return true;
  } catch (err) {
    console.error('set_alias failed', err);
    return false;
  }
}

export async function apiGetPeers(): Promise<PeerInfo[]> {
  try {
    const peers = await invoke<PeerInfo[]>('get_peers');
    return peers ?? [];
  } catch (err) {
    console.error('get_peers failed', err);
    return [];
  }
}

/**
 * Fetch chat history (Vec<ChatBody>) from backend and expose as a synthetic Blockchain.
 * This replaces reading the full on‑disk blockchain and lets the backend do filtering.
 */
export async function apiGetBlockchain(): Promise<Blockchain> {
  try {
    const msgs = await invoke<ChatBody[]>('get_chat_history');
    const chain: Block[] = msgs.map((msg, idx) => ({
      index: idx,
      timestamp_ms: msg.ts_ms ?? Date.now(),
      previous_hash: idx === 0 ? '0' : String(idx - 1),
      nonce: 0,
      hash: String(idx),
      data: JSON.stringify(msg),
    }));
    return { chain };
  } catch (err) {
    console.error('apiGetBlockchain failed', err);
    return { chain: [] };
  }
}

/** Send chat message. Peer *must* be selected; backend rejects null. */
export async function apiAddMessage(
  text: string,
  toPeerId: string,
): Promise<boolean> {
  if (!toPeerId) {
    console.warn('apiAddMessage called without peerId; ignoring');
    return false;
  }
  try {
    await invoke('add_chat_message', {
      content: text,
      toPeer: toPeerId, // backend Option<String>
    });
    return true;
  } catch (err) {
    console.error('add_chat_message failed', err);
    return false;
  }
}

/** Clear chat history (identity preserved). */
export async function apiResetData(): Promise<boolean> {
  try {
    await invoke('reset_data');
    return true;
  } catch (err) {
    console.error('reset_data failed', err);
    return false;
  }
}
