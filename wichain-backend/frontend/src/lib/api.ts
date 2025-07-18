// frontend/src/lib/api.ts
import { invoke } from '@tauri-apps/api/core';

/* ---------- Types ---------- */
export interface PeerInfo {
  id: string;
  alias: string;
  pubkey: string;
  last_seen_ms?: number;
}

export interface SignedMessage {
  id: string;
  from: string;
  to?: string | null;
  timestamp_ms: number;
  content: string;
  sig: string;
}

export interface Block {
  index: number;
  timestamp_ms: number;
  previous_hash: string;
  nonce: number;
  hash: string;
  raw_data: string; // serialized payload
  // Optional decoded view:
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

/* ---------- Helpers ---------- */
function parseJson<T>(v: unknown): T | null {
  if (typeof v !== 'string') return null;
  try {
    return JSON.parse(v) as T;
  } catch {
    return null;
  }
}

/* ---------- API Calls ---------- */
export async function apiGetIdentity(): Promise<Identity> {
  return invoke<Identity>('get_identity');
}

export async function apiGetPeers(): Promise<PeerInfo[]> {
  return invoke<PeerInfo[]>('get_peers');
}

export async function apiGetBlockchain(): Promise<Blockchain> {
  // backend returns JSON string
  const json = await invoke<string>('get_blockchain_json');
  return parseJson<Blockchain>(json) ?? { chain: [] };
}

/**
 * Broadcast a text message.
 * For *peer-targeted* UX we allow optional `toPeerId` (pubkey string)
 * which we encode inline in the text: "@peer:<id>:::<text>"
 * Backend still treats it as plain text; filtering done in UI.
 */
export async function apiAddMessage(text: string, toPeerId?: string | null): Promise<boolean> {
  const content = toPeerId ? `@peer:${toPeerId}:::${text}` : text;
  await invoke<string>('add_text_message', { content });
  return true;
}
