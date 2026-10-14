'worklet';
// Fixed-size pools, so the frame loop never allocates. Live items are items[0 .. count).
// Loops that release items walk backwards: the item swapped into a freed slot has already
// been visited.
import type { Pool } from './types';

export function makePool<T>(capacity: number, make: () => T): Pool<T> {
  const items: T[] = [];
  for (let i = 0; i < capacity; i++) items.push(make());
  return { items, count: 0 };
}

/** The next free item, or null when the pool is full. Its fields still hold old values. */
export function acquire<T>(pool: Pool<T>): T | null {
  if (pool.count >= pool.items.length) return null;
  const item = pool.items[pool.count];
  if (item === undefined) return null;
  pool.count++;
  return item;
}

/** Free live item `i` by swapping the last live item into its slot. */
export function release<T>(pool: Pool<T>, i: number): void {
  const last = pool.count - 1;
  if (i < 0 || i > last) return;
  if (i !== last) {
    const freed = pool.items[i] as T;
    pool.items[i] = pool.items[last] as T;
    pool.items[last] = freed;
  }
  pool.count = last;
}
