'worklet';
// A small seeded random number generator (mulberry32). Its state lives in the game state, so
// a round is reproducible from its seed and tests are deterministic.
import type { Rng } from './types';

export function makeRng(seed: number): Rng {
  return { s: seed | 0 };
}

/** A number in [0, 1). */
export function random(rng: Rng): number {
  rng.s = (rng.s + 0x6d2b79f5) | 0;
  let t = rng.s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** A number in [min, max). */
export function between(rng: Rng, min: number, max: number): number {
  return min + random(rng) * (max - min);
}

/** A number in [-half, half). */
export function spread(rng: Rng, half: number): number {
  return (random(rng) - 0.5) * 2 * half;
}
