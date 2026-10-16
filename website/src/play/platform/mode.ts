// Demo mode: the demo controls (move the clock, jump to a day) work on a copy of your progress,
// stored under its own keys, so trying them never touches your real streak. Switching modes
// reloads the app, so every part of it starts from the right store.
import { STORE_BACKUP_KEY, STORE_KEY } from '@/store/types';

import { localStore } from './storage';

/** Where the current mode is kept, shared by every tab. */
export const MODE_KEY = 'winzero:mode';
/** Demo mode's copy of the store lives under keys with this prefix. */
export const DEMO_PREFIX = 'demo:';

export function isDemo(storage: Storage | null = localStore()): boolean {
  try {
    return storage?.getItem(MODE_KEY) === 'demo';
  } catch {
    return false;
  }
}

/** Start demo mode from a copy of the real progress. False when storage isn't available. */
export function enterDemo(storage: Storage | null = localStore()): boolean {
  if (!storage) return false;
  try {
    const real = storage.getItem(STORE_KEY);
    if (real === null) storage.removeItem(DEMO_PREFIX + STORE_KEY);
    else storage.setItem(DEMO_PREFIX + STORE_KEY, real);
    storage.removeItem(DEMO_PREFIX + STORE_BACKUP_KEY);
    storage.setItem(MODE_KEY, 'demo');
    return true;
  } catch {
    return false;
  }
}

/** Back to the real progress; the demo copy is thrown away. */
export function leaveDemo(storage: Storage | null = localStore()): void {
  if (!storage) return;
  try {
    storage.removeItem(DEMO_PREFIX + STORE_KEY);
    storage.removeItem(DEMO_PREFIX + STORE_BACKUP_KEY);
    storage.removeItem(MODE_KEY);
  } catch {
    // Nothing more to do.
  }
}
