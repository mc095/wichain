// frontend/src/lib/api.ts
import { invoke } from '@tauri-apps/api/core';

/* ---------- Types ---------- */
export interface PeerInfo {
  id: string;
  alias: string;
  pubkey: string;
  last_seen_ms?: number;
}

export interface Identity {
  alias: string;
  private_key_b64: string;
  public_key_b64: string;
}

export interface ChatPayload {
  from: string;
  to: string | null;
  text: string;
  ts_ms: number;
}

/* ---------- Identity ---------- */
export async function apiGetIdentity(): Promise<Identity> {
  return invoke<Identity>('get_identity');
}

export async function apiSetAlias(alias: string): Promise<void> {
  await invoke('set_alias', { newAlias: alias });
}

/* ---------- Peers ---------- */
export async function apiGetPeers(): Promise<PeerInfo[]> {
  const peers = await invoke<PeerInfo[]>('get_peers');
  return peers ?? [];
}

/* ---------- Chat ---------- */
export async function apiGetChatHistory(): Promise<ChatPayload[]> {
  return invoke<ChatPayload[]>('get_chat_history');
}

export async function apiAddMessage(
  text: string,
  toPeerId?: string | null
): Promise<boolean> {
  await invoke('add_chat_message', { content: text, toPeer: toPeerId });
  return true;
}

/* ---------- Reset ---------- */
export async function apiResetData(): Promise<void> {
  await invoke('reset_data');
}
