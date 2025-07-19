// frontend/src/lib/api.ts
import { invoke } from '@tauri-apps/api/core';

/* ------------------------------------------------------------------ */
/* Types mirrored from backend                                        */
/* ------------------------------------------------------------------ */
export interface PeerInfo {
  id: string;
  alias: string;
  pubkey: string;
  last_seen_ms?: number;
}

export interface ChatPayloadV1 {
  from: string;           // sender pubkey b64
  to?: string | null;     // receiver pubkey b64; null => group/all
  text: string;
  ts_ms: number;          // unix ms
}

export interface SignedMessage {
  id: string;
  from: string;
  to?: string | null;
  timestamp_ms: number;
  content: string;
  sig: string;
}

/** Minimal block shape used by ChatView; NOT the on‑disk blockchain anymore. */
export interface Block {
  index: number;
  timestamp_ms: number;
  previous_hash: string;
  nonce: number;
  hash: string;
  data?: string;     // JSON ChatPayloadV1 string
  raw_data?: string; // legacy fallback
  payload?: unknown;
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
  const peers = await invoke<PeerInfo[]>('get_peers');
  return peers ?? [];
}

/**
 * Fetch chat history from backend and expose as a synthetic Blockchain.
 * Each chat payload becomes one pseudo‑block; hashes are placeholder strings.
 */
export async function apiGetBlockchain(): Promise<Blockchain> {
  try {
    const msgs = await invoke<ChatPayloadV1[]>('get_chat_history');
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

/** Send chat message. If `toPeerId` omitted => group/all. */
export async function apiAddMessage(
  text: string,
  toPeerId?: string | null
): Promise<boolean> {
  try {
    await invoke('add_chat_message', {
      content: text,
      toPeer: toPeerId ?? null,
    });
    return true;
  } catch (err) {
    console.error('add_chat_message failed', err);
    return false;
  }
}

export async function apiResetData(): Promise<boolean> {
  try {
    await invoke('reset_data');
    return true;
  } catch (err) {
    console.error('reset_data failed', err);
    return false;
  }
}
