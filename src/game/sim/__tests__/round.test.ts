// Whole rounds, played by a simple bot through the press calls the website makes (the app's
// canvas goes through the pointer calls: clear.test.ts): every weapon can finish, the round ends
// once and shows its result once, and nothing overflows on the way.
import { describe, expect, it } from '@jest/globals';

import { type WeaponId } from '@/engine';

import { dropBomb } from '../bomb';
import { MAX_BOLTS, MAX_BULLETS, MAX_PARTICLES, MAX_RINGS } from '../constants';
import { moveAim, pressFire, releaseFire } from '../input';
import { resetReport } from '../report';
import { step } from '../step';
import type { GameState } from '../types';
import { lead, target } from './bot';
import { game } from './fixtures';

const FPS = 60;
/** Give up on a round after this long. */
const LIMIT_S = 240;
/** With auto-fire, the bot only taps to aim, this many frames apart (twice a second). */
const TAP_FRAMES = FPS / 2;

interface Played {
  seconds: number;
  finals: number;
  results: number;
  shots: number;
  peakParticles: number;
  state: GameState;
}

function play(
  n: number,
  weapon: WeaponId,
  opts: { bombs?: number; seed?: number; reduceMotion?: boolean; autoFire?: boolean } = {},
): Played {
  const s = game(n, { weapon, seed: opts.seed ?? n, reduceMotion: opts.reduceMotion ?? false, autoFire: opts.autoFire });
  let peakParticles = 0;
  let bombs = opts.bombs ?? 0;
  let finals = 0;
  let results = 0;
  let shots = 0;
  let held = false;
  let frame = 0;
  for (; frame < LIMIT_S * FPS && s.phase !== 'done'; frame++) {
    const z = target(s);
    if (z && s.phase === 'play') {
      const aim = lead(s, z);
      if (opts.autoFire) {
        if (frame % TAP_FRAMES === 0) {
          pressFire(s, aim.x, aim.y);
          releaseFire(s);
        }
      } else if (held) moveAim(s, aim.x, aim.y);
      else pressFire(s, aim.x, aim.y);
      held = true;
    }
    // Bombs once everything has popped in.
    if (bombs > 0 && frame === FPS) {
      dropBomb(s);
      bombs--;
    }
    step(s, 1 / FPS);
    for (const z2 of s.zeros) {
      if (!Number.isFinite(z2.x) || !Number.isFinite(z2.y)) throw new Error('A zero left the number line');
    }
    expect(s.bullets.count).toBeLessThanOrEqual(MAX_BULLETS);
    expect(s.particles.count).toBeLessThanOrEqual(MAX_PARTICLES);
    peakParticles = Math.max(peakParticles, s.particles.count);
    expect(s.rings.count).toBeLessThanOrEqual(MAX_RINGS);
    expect(s.bolts.count).toBeLessThanOrEqual(MAX_BOLTS);
    // What GameCanvas does after each frame.
    if (s.report.final) finals++;
    if (s.report.showResult) results++;
    shots += s.report.shots;
    resetReport(s.report);
  }
  return { seconds: frame / FPS, finals, results, shots, peakParticles, state: s };
}

describe('a whole round', () => {
  it.each<[number, WeaponId]>([
    [1, 'pea'],
    [7, 'pea'],
    [3, 'twin'],
    [8, 'scatter'],
    [30, 'rocket'],
    [60, 'chain'],
    [61, 'laser'],
    [250, 'nuke'],
    [1000, 'nuke'],
  ])('n = %i with the %s: finishes, ends once, shows the result once', (n, weapon) => {
    const { seconds, finals, results, state } = play(n, weapon);
    expect(state.phase).toBe('done');
    expect(state.valueLeft).toBe(0);
    expect(state.zeros.every((z) => !z.alive)).toBe(true);
    expect([finals, results]).toEqual([1, 1]);
    expect(seconds).toBeLessThan(LIMIT_S);
  });

  it('plays out the same for the same seed', () => {
    const a = play(60, 'scatter', { seed: 5 });
    const b = play(60, 'scatter', { seed: 5 });
    expect([a.seconds, a.shots]).toEqual([b.seconds, b.shots]);
  });

  it('goes faster with a bomb', () => {
    const plain = play(60, 'pea');
    const bombed = play(60, 'pea', { bombs: 1 });
    expect(bombed.seconds).toBeLessThan(plain.seconds);
  });

  it('plays an auto-fire round through on taps alone, twice a second', () => {
    const tapped = play(30, 'rocket', { autoFire: true });
    expect(tapped.state.phase).toBe('done');
    expect([tapped.finals, tapped.results]).toEqual([1, 1]);
  });

  it('plays a reduce-motion round through, with far fewer particles', () => {
    const calm = play(30, 'rocket', { reduceMotion: true });
    const full = play(30, 'rocket');
    expect(calm.state.phase).toBe('done');
    expect(calm.peakParticles).toBeLessThan(full.peakParticles * 0.7);
  });
});
