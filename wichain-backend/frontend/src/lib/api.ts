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
function parseJson<T>(v: string): T | null {
  try {
    return JSON.parse(v) as T;
  } catch {
    return null;
  }
}

// raw back-end block
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

/** normalize block into something UI-safe */
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
        : '',
    data: typeof b.data === 'string' ? b.data : undefined,
    payload: b.payload,
  };
}

/* ---------- API Calls ---------- */
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

// parsed blockchain
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
