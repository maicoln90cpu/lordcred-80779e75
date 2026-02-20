import type { ChatContact } from '@/pages/WhatsApp';

const CACHE_VERSION = 'v1';
const MAX_MESSAGES_PER_CHAT = 100;
const CACHE_EXPIRY_DAYS = 7;

interface CachedData<T> {
  data: T;
  timestamp: number;
}

function getCacheKey(type: 'messages' | 'chats', chipId: string, remoteJid?: string): string {
  if (type === 'messages' && remoteJid) {
    return `${CACHE_VERSION}_chat_messages_${chipId}_${remoteJid}`;
  }
  return `${CACHE_VERSION}_chat_list_${chipId}`;
}

function isExpired(timestamp: number): boolean {
  const now = Date.now();
  return now - timestamp > CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
}

export function getCachedMessages<T>(chipId: string, remoteJid: string): T[] | null {
  try {
    const key = getCacheKey('messages', chipId, remoteJid);
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const cached: CachedData<T[]> = JSON.parse(raw);
    if (isExpired(cached.timestamp)) {
      localStorage.removeItem(key);
      return null;
    }
    return cached.data;
  } catch {
    return null;
  }
}

export function setCachedMessages<T extends { id: string }>(chipId: string, remoteJid: string, messages: T[]): void {
  try {
    const key = getCacheKey('messages', chipId, remoteJid);
    const trimmed = messages.slice(-MAX_MESSAGES_PER_CHAT);
    const cached: CachedData<T[]> = { data: trimmed, timestamp: Date.now() };
    localStorage.setItem(key, JSON.stringify(cached));
  } catch {
    // localStorage full — silently fail
  }
}

export function addMessageToCache<T extends { id: string }>(chipId: string, remoteJid: string, message: T): void {
  try {
    const existing = getCachedMessages<T>(chipId, remoteJid) || [];
    if (existing.some(m => m.id === message.id)) return;
    const updated = [...existing, message].slice(-MAX_MESSAGES_PER_CHAT);
    setCachedMessages(chipId, remoteJid, updated);
  } catch {
    // silently fail
  }
}

export function getCachedChats(chipId: string): ChatContact[] | null {
  try {
    const key = getCacheKey('chats', chipId);
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const cached: CachedData<ChatContact[]> = JSON.parse(raw);
    if (isExpired(cached.timestamp)) {
      localStorage.removeItem(key);
      return null;
    }
    return cached.data;
  } catch {
    return null;
  }
}

export function setCachedChats(chipId: string, chats: ChatContact[]): void {
  try {
    const key = getCacheKey('chats', chipId);
    const cached: CachedData<ChatContact[]> = { data: chats, timestamp: Date.now() };
    localStorage.setItem(key, JSON.stringify(cached));
  } catch {
    // silently fail
  }
}

export function clearAllChatCache(): void {
  try {
    const keys = Object.keys(localStorage);
    for (const key of keys) {
      if (key.startsWith(CACHE_VERSION + '_chat_')) {
        localStorage.removeItem(key);
      }
    }
  } catch {
    // silently fail
  }
}
