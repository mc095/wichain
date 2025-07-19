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

interface RawBackendBlock {
  index?: number;
  timestamp_ms?: number;
  previous_hash?: string;
  nonce?: number;
  hash?: string;
  data?: string;
  raw_data?: string;
  payload?: unknown;
}

function normalizeBlock(b: RawBackendBlock): Block {
  return {
    index: Number(b.index ?? 0),
    timestamp_ms: Number(b.timestamp_ms ?? 0),
    previous_hash: String(b.previous_hash ?? ''),
    nonce: Number(b.nonce ?? 0),
    hash: String(b.hash ?? ''),
    raw_data:
      typeof b.raw_data === 'string'
        ? b.raw_data
        : typeof b.data === 'string'
        ? b.data
        : undefined,
    data: typeof b.data === 'string' ? b.data : undefined,
    payload: b.payload,
  };
}

/* ---------- API Calls ---------- */
export async function apiGetIdentity(): Promise<Identity> {
  return invoke<Identity>('get_identity');
}

export async function apiSetAlias(alias: string): Promise<void> {
  await invoke('set_alias', { newAlias: alias });
}

export async function apiGetPeers(): Promise<PeerInfo[]> {
  const peers = await invoke<PeerInfo[]>('get_peers');
  return peers ?? [];
}

interface ParsedBlockchainResponse {
  chain: RawBackendBlock[];
}

export async function apiGetBlockchain(): Promise<Blockchain> {
  const json = await invoke<string>('get_blockchain_json');
  const parsed = parseJson<ParsedBlockchainResponse>(json);
  if (!parsed || !Array.isArray(parsed.chain)) {
    return { chain: [] };
  }
  return {
    chain: parsed.chain.map(normalizeBlock),
  };
}

/** Direct message (peer required). */
export async function apiAddMessage(text: string, toPeerId: string): Promise<boolean> {
  try {
    await invoke<string>('add_text_message', { content: text, toPeer: toPeerId });
    return true;
  } catch (err) {
    console.error('add_text_message failed', err);
    return false;
  }
}
