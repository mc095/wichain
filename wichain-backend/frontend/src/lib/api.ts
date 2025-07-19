// frontend/src/lib/api.ts
import { invoke } from '@tauri-apps/api/core';

/* ---------- Types ---------- */
export interface PeerInfo {
  id: string;
  alias: string;
  pubkey: string;
  last_seen_ms?: number;
}

export interface Block {
  index: number;
  timestamp_ms: number;
  previous_hash: string;
  nonce: number;
  hash: string;
  data?: string;
  raw_data?: string;
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

interface ParsedBlockchain {
  chain: Block[];
}

/* ---------- API Calls ---------- */
export async function apiGetIdentity(): Promise<Identity> {
  return invoke<Identity>('get_identity');
}

export async function apiSetAlias(alias: string): Promise<void> {
  await invoke('set_alias', { newAlias: alias });
}

export async function apiGetPeers(): Promise<PeerInfo[]> {
  return invoke<PeerInfo[]>('get_peers');
}

export async function apiGetBlockchain(): Promise<Blockchain> {
  const json = await invoke<string>('get_blockchain_json');
  const parsed = parseJson<ParsedBlockchain>(json);
  if (!parsed || !Array.isArray(parsed.chain)) {
    return { chain: [] };
  }
  return parsed;
}

/* Direct peer message (required) */
export async function apiSendMessage(toPeerId: string, text: string): Promise<boolean> {
  try {
    await invoke('send_text_message', { content: text, toPeer: toPeerId });
    return true;
  } catch (err) {
    console.error('send_text_message failed', err);
    return false;
  }
}
