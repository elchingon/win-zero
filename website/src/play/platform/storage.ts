// The store's storage on the web: the browser's localStorage, under an optional key prefix
// (demo mode keeps its own copy). Where storage is blocked or full (a private window, site data
// turned off), it falls back to memory so the app still runs, and says it isn't persistent.
import type { StateStorage } from 'zustand/middleware';

export interface BrowserStorage extends StateStorage {
  /** False when progress only lives in memory and goes when the tab closes. */
  readonly persistent: boolean;
}

/** localStorage, if this browser lets the site read and write it. */
export function localStore(): Storage | null {
  try {
    const store = window.localStorage;
    const probe = 'winzero:probe';
    store.setItem(probe, '1');
    store.removeItem(probe);
    return store;
  } catch {
    return null;
  }
}

export function browserStorage(prefix = '', backing: Storage | null = localStore()): BrowserStorage {
  const memory = new Map<string, string>();
  const key = (name: string) => prefix + name;
  return {
    persistent: backing !== null,
    getItem: (name) => {
      try {
        return backing ? backing.getItem(key(name)) : (memory.get(key(name)) ?? null);
      } catch {
        return memory.get(key(name)) ?? null;
      }
    },
    setItem: (name, value) => {
      memory.set(key(name), value);
      try {
        backing?.setItem(key(name), value);
      } catch {
        // Full or blocked: the in-memory copy keeps this tab going.
      }
    },
    removeItem: (name) => {
      memory.delete(key(name));
      try {
        backing?.removeItem(key(name));
      } catch {
        // as above
      }
    },
  };
}

/**
 * Calls `onChange` when another tab changes `key` (a check-in, an erase), so this tab can read
 * it again instead of writing over it with what it had. Returns a cleanup.
 */
export function onOtherTabChange(key: string, onChange: () => void): () => void {
  const listener = (e: StorageEvent) => {
    if (e.key === key || e.key === null) onChange();
  };
  window.addEventListener('storage', listener);
  return () => window.removeEventListener('storage', listener);
}

/** Ask the browser not to clear the site's storage under pressure. Quietly does nothing if it can't. */
export function askToKeepStorage(): void {
  try {
    void navigator.storage?.persist?.().catch(() => {});
  } catch {
    // Not supported.
  }
}
