// The sim's building blocks: the seeded random numbers, easing, and the fixed pools.
import { describe, expect, it } from '@jest/globals';

import { clamp01, decay, easeBack, easeOut } from '../ease';
import { acquire, makePool, release } from '../pool';
import { between, makeRng, random, spread } from '../rng';

describe('rng', () => {
  it('repeats for the same seed and differs for another', () => {
    const a = makeRng(42);
    const b = makeRng(42);
    const c = makeRng(43);
    const seqA = Array.from({ length: 20 }, () => random(a));
    expect(Array.from({ length: 20 }, () => random(b))).toEqual(seqA);
    expect(Array.from({ length: 20 }, () => random(c))).not.toEqual(seqA);
  });

  it('stays in range and spreads evenly', () => {
    const rng = makeRng(7);
    let sum = 0;
    for (let i = 0; i < 10_000; i++) {
      const x = random(rng);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
      sum += x;
    }
    expect(sum / 10_000).toBeCloseTo(0.5, 1);
  });

  it('scales to a range', () => {
    const rng = makeRng(1);
    for (let i = 0; i < 1000; i++) {
      const x = between(rng, 10, 20);
      expect(x).toBeGreaterThanOrEqual(10);
      expect(x).toBeLessThan(20);
      expect(Math.abs(spread(rng, 5))).toBeLessThanOrEqual(5);
    }
  });
});

describe('ease', () => {
  it('starts at 0 and ends at 1', () => {
    for (const f of [easeOut, easeBack]) {
      expect(f(0)).toBeCloseTo(0);
      expect(f(1)).toBeCloseTo(1);
    }
  });

  it('easeBack overshoots before settling', () => {
    const peak = Math.max(...Array.from({ length: 101 }, (_, i) => easeBack(i / 100)));
    expect(peak).toBeGreaterThan(1.05);
  });

  it('clamps and decays per frame', () => {
    expect([clamp01(-1), clamp01(0.4), clamp01(2)]).toEqual([0, 0.4, 1]);
    expect(decay(0.5, 1 / 60)).toBeCloseTo(0.5);
    expect(decay(0.5, 2 / 60)).toBeCloseTo(0.25);
  });
});

describe('pool', () => {
  it('hands out items until full', () => {
    const pool = makePool(3, () => ({ id: 0 }));
    const got = [acquire(pool), acquire(pool), acquire(pool)];
    expect(got.every(Boolean)).toBe(true);
    expect(acquire(pool)).toBeNull();
    expect(pool.count).toBe(3);
  });

  it('frees a slot by swapping the last live item in', () => {
    const pool = makePool(4, () => ({ id: 0 }));
    for (let i = 1; i <= 3; i++) acquire(pool)!.id = i;
    release(pool, 0);
    expect(pool.count).toBe(2);
    expect(pool.items.slice(0, 2).map((x) => x.id)).toEqual([3, 2]);
    release(pool, 5); // out of range: ignored
    expect(pool.count).toBe(2);
  });

  it('can release while walking backwards', () => {
    const pool = makePool(10, () => ({ id: 0 }));
    for (let i = 0; i < 10; i++) acquire(pool)!.id = i;
    for (let i = pool.count - 1; i >= 0; i--) if (pool.items[i]!.id % 2 === 0) release(pool, i);
    expect(pool.items.slice(0, pool.count).map((x) => x.id).sort()).toEqual([1, 3, 5, 7, 9]);
  });
});
