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
  // Runtime backend may provide either `data` (legacy) or `raw_data` (new).
  data?: string;
  raw_data?: string;
  payload?: unknown; // Keep as unknown if its structure is highly variable
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

// Define the expected raw structure for a block coming from the backend
// This helps type 'b' without using 'any'
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

/**
 * Normalize a raw block (from backend JSON) into a Block the UI can use.
 * Guarantees `raw_data` is set (falls back to `data` or `""`).
 */
function normalizeBlock(b: RawBackendBlock): Block { // Changed 'any' to 'RawBackendBlock'
  return {
    index: Number(b.index ?? 0),
    timestamp_ms: Number(b.timestamp_ms ?? 0),
    previous_hash: String(b.previous_hash ?? ''),
    nonce: Number(b.nonce ?? 0),
    hash: String(b.hash ?? ''),
    raw_data: typeof b.raw_data === 'string'
      ? b.raw_data
      : typeof b.data === 'string'
      ? JSON.stringify(b.data) // wrap legacy plain string as JSON string
      : 'null', // Changed from '' to 'null' for consistency with JSON.parse fallback
    data: typeof b.data === 'string' ? b.data : undefined,
    payload: b.payload,
  };
}

/* ---------- API Calls ---------- */
export async function apiGetIdentity(): Promise<Identity> {
  return invoke<Identity>('get_identity');
}

export async function apiGetPeers(): Promise<PeerInfo[]> {
  const peers = await invoke<PeerInfo[]>('get_peers');
  return peers ?? [];
}

// Define the expected structure for the parsed blockchain JSON
interface ParsedBlockchainResponse {
    chain: RawBackendBlock[]; // Expect an array of raw blocks for mapping
}

export async function apiGetBlockchain(): Promise<Blockchain> {
  const json = await invoke<string>('get_blockchain_json'); // backend returns string
  const parsed = parseJson<ParsedBlockchainResponse>(json); // Changed 'any' to 'ParsedBlockchainResponse'
  if (!parsed || !Array.isArray(parsed.chain)) {
    return { chain: [] };
  }
  return {
    chain: parsed.chain.map(normalizeBlock),
  };
}

/**
 * Broadcast a text message. If `toPeerId` supplied, encode a tag so
 * filtering works in ChatView: "@peer:<id>:::<text>"
 */
export async function apiAddMessage(text: string, toPeerId?: string | null): Promise<boolean> {
  const content = toPeerId ? `@peer:${toPeerId}:::${text}` : text;
  await invoke<string>('add_text_message', { content });
  return true;
}