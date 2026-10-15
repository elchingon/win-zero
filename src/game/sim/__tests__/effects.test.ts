// Particles, shockwaves, shake and flash: what a kill throws, the caps, draining, and reduce motion.
import { describe, expect, it } from '@jest/globals';

import {
  KILL_FRAGMENTS,
  KILL_FRAGMENTS_BUSY,
  KILL_PARTICLE_CAP,
  KILL_SPARKS,
  KILL_SPARKS_BUSY,
  MAX_PARTICLES,
  MAX_RINGS,
  REDUCED_SHAKE,
  SHAKE_KILL_MAX,
  SHAKE_MIN,
} from '../constants';
import { killZero } from '../damage';
import { addShake, updateEffects } from '../effects';
import { step } from '../step';
import { game, popIn, run } from './fixtures';

const shapes = (s: ReturnType<typeof game>) =>
  s.particles.items.slice(0, s.particles.count).reduce<Record<string, number>>((acc, p) => {
    acc[p.shape] = (acc[p.shape] ?? 0) + 1;
    return acc;
  }, {});

describe('a kill', () => {
  it('throws sparks, fragments, a shockwave in its color, and a shake', () => {
    const s = game(8);
    const z = s.zeros[2]!;
    killZero(s, z);
    expect(shapes(s)).toEqual({ dot: KILL_SPARKS, ring: KILL_FRAGMENTS });
    expect(s.rings.count).toBe(1);
    expect(s.rings.items[0]).toMatchObject({ x: z.x, y: z.y, color: z.color });
    expect(s.shake).toBeGreaterThan(0);
    expect(s.shake).toBeLessThanOrEqual(SHAKE_KILL_MAX);
  });

  it('throws less in a crowded round', () => {
    const s = game(60);
    killZero(s, s.zeros[0]!);
    expect(shapes(s)).toEqual({ dot: KILL_SPARKS_BUSY, ring: KILL_FRAGMENTS_BUSY });
  });

  it('throws half as much, and shakes far less, under reduce motion', () => {
    const s = game(8, { reduceMotion: true });
    const calm = game(8);
    killZero(s, s.zeros[0]!);
    killZero(calm, calm.zeros[0]!);
    expect(s.particles.count).toBe(Math.ceil(KILL_SPARKS / 2) + Math.ceil(KILL_FRAGMENTS / 2));
    expect(s.shake).toBeCloseTo(calm.shake * REDUCED_SHAKE);
  });
});

describe('caps and draining', () => {
  it('keeps a full board going up at once inside the kill budget', () => {
    const s = game(60);
    // All but one, so the final's confetti (which may use the rest of the pool) stays out of it.
    for (const z of s.zeros.slice(1)) killZero(s, z);
    expect(s.particles.count).toBeLessThanOrEqual(KILL_PARTICLE_CAP);
    expect(s.rings.count).toBeLessThanOrEqual(MAX_RINGS);
  });

  it('never overfills the pools, however much goes on', () => {
    const s = game(60);
    popIn(s);
    for (let frame = 0; frame < 120; frame++) {
      for (const z of s.zeros) {
        z.alive = true;
        killZero(s, z);
      }
      step(s, 1 / 60);
      expect(s.particles.count).toBeLessThanOrEqual(MAX_PARTICLES);
      expect(s.rings.count).toBeLessThanOrEqual(MAX_RINGS);
    }
  });

  it('drains every pool and settles the screen', () => {
    const s = game(60);
    for (const z of s.zeros.slice(0, 20)) killZero(s, z);
    s.flash = 1;
    s.muzzle = 1;
    run(s, 3);
    expect([s.particles.count, s.rings.count, s.beams.count, s.bolts.count]).toEqual([0, 0, 0, 0]);
    expect(s.flash).toBeLessThan(0.01);
    expect(s.muzzle).toBeLessThan(0.01);
    expect([s.shakeX, s.shakeY]).toEqual([0, 0]);
  });

  it('lets fragments fall and sparks slow down', () => {
    const s = game(8);
    killZero(s, s.zeros[0]!);
    const ring = s.particles.items.slice(0, s.particles.count).find((p) => p.shape === 'ring')!;
    const dot = s.particles.items.slice(0, s.particles.count).find((p) => p.shape === 'dot')!;
    const [ringVy, dotSpeed] = [ring.vy, Math.hypot(dot.vx, dot.vy)];
    updateEffects(s, 1 / 60);
    expect(ring.vy).toBeGreaterThan(ringVy);
    expect(Math.hypot(dot.vx, dot.vy)).toBeLessThan(dotSpeed);
  });
});

describe('shake', () => {
  it('offsets the screen by up to half the shake each way, the same for the same seed', () => {
    const offsets = (seed: number) => {
      const s = game(8, { seed });
      addShake(s, 16);
      const out: number[] = [];
      for (let i = 0; i < 10; i++) {
        updateEffects(s, 1 / 60);
        expect(Math.abs(s.shakeX)).toBeLessThanOrEqual(s.shake / 2);
        out.push(s.shakeX, s.shakeY);
      }
      return out;
    };
    expect(offsets(3)).toEqual(offsets(3));
    expect(offsets(3)).not.toEqual(offsets(4));
    expect(offsets(3).some((v) => v !== 0)).toBe(true);
  });

  it('holds still once the shake is too small to see', () => {
    const s = game(8);
    s.shake = SHAKE_MIN / 2;
    updateEffects(s, 1 / 60);
    expect([s.shakeX, s.shakeY]).toEqual([0, 0]);
  });

  it('keeps the biggest shake rather than adding them up', () => {
    const s = game(8);
    addShake(s, 10);
    addShake(s, 4);
    expect(s.shake).toBe(10);
  });
});
