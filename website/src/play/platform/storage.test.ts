import { describe, expect, it } from 'vitest';

import { STORE_BACKUP_KEY, STORE_KEY } from '@/store/types';

import { MemoryStorage } from './memoryStorage';
import { DEMO_PREFIX, enterDemo, isDemo, leaveDemo, MODE_KEY } from './mode';
import { browserStorage } from './storage';

describe('browserStorage', () => {
  it('reads and writes the browser storage, under a prefix', () => {
    const backing = new MemoryStorage();
    const storage = browserStorage('demo:', backing);
    storage.setItem('winzero', '{"a":1}');
    expect(storage.persistent).toBe(true);
    expect(backing.getItem('demo:winzero')).toBe('{"a":1}');
    expect(storage.getItem('winzero')).toBe('{"a":1}');
    storage.removeItem('winzero');
    expect(backing.getItem('demo:winzero')).toBeNull();
  });

  it('keeps the tab going in memory when storage is blocked', () => {
    const storage = browserStorage('', null);
    expect(storage.persistent).toBe(false);
    storage.setItem('winzero', 'x');
    expect(storage.getItem('winzero')).toBe('x');
  });

  it('never throws when storage refuses a write', () => {
    const storage = browserStorage('', new MemoryStorage(true));
    expect(() => storage.setItem('winzero', 'x')).not.toThrow();
    expect(storage.getItem('winzero')).toBe('x');
    expect(() => storage.removeItem('winzero')).not.toThrow();
  });
});

describe('demo mode', () => {
  it('starts from a copy of the real progress and leaves the real progress alone', () => {
    const backing = new MemoryStorage();
    backing.setItem(STORE_KEY, 'real');
    backing.setItem(DEMO_PREFIX + STORE_BACKUP_KEY, 'old demo backup');
    expect(isDemo(backing)).toBe(false);
    expect(enterDemo(backing)).toBe(true);
    expect(isDemo(backing)).toBe(true);
    expect(backing.getItem(DEMO_PREFIX + STORE_KEY)).toBe('real');
    expect(backing.getItem(DEMO_PREFIX + STORE_BACKUP_KEY)).toBeNull();

    backing.setItem(DEMO_PREFIX + STORE_KEY, 'day 250');
    leaveDemo(backing);
    expect(isDemo(backing)).toBe(false);
    expect(backing.getItem(MODE_KEY)).toBeNull();
    expect(backing.getItem(DEMO_PREFIX + STORE_KEY)).toBeNull();
    expect(backing.getItem(STORE_KEY)).toBe('real');
  });

  it('starts empty when there is no progress yet, and needs storage', () => {
    const backing = new MemoryStorage();
    backing.setItem(DEMO_PREFIX + STORE_KEY, 'stale');
    expect(enterDemo(backing)).toBe(true);
    expect(backing.getItem(DEMO_PREFIX + STORE_KEY)).toBeNull();
    expect(enterDemo(null)).toBe(false);
    expect(isDemo(new MemoryStorage(true))).toBe(false);
  });
});
