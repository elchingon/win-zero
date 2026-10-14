// The end of a round: the final zero's celebration, the phase timing, and the celebration fill.
import { describe, expect, it } from '@jest/globals';

import { fillPlan } from '@/engine';

import {
  AMBER,
  CONFETTI,
  CONFETTI_RINGS,
  FILL_DELAY,
  FILL_POP,
  FILL_SPARKLE_CAP,
  FLARE,
  FLASH_FINAL,
  GLYPH_ASPECT,
  RESULT_DELAY,
  SHAKE_FINAL,
  TEAL,
} from '../constants';
import { killZero } from '../damage';
import { fillSpread } from '../fill';
import { acquire } from '../pool';
import { resetReport } from '../report';
import { step } from '../step';
import type { GameState } from '../types';
import { finalRings, game, run } from './fixtures';

const count = (s: GameState, shape: string) => s.particles.items.slice(0, s.particles.count).filter((p) => p.shape === shape).length;

/** Kill every zero, the last one at (x, y). */
function win(s: GameState, x = 195, y = 400): void {
  const last = s.zeros[s.zeros.length - 1]!;
  Object.assign(last, { x, y });
  for (const z of s.zeros) killZero(s, z);
}

/** Step at 60 fps until `done` holds; the seconds it took. */
function until(s: GameState, done: () => boolean, limit = 10): number {
  let t = 0;
  while (!done() && t < limit) {
    step(s, 1 / 60);
    t += 1 / 60;
  }
  return t;
}

describe('the celebration', () => {
  it('throws three shockwaves, confetti, a flash and a big shake from the last zero', () => {
    const s = game(8);
    win(s, 120, 300);
    expect(s.phase).toBe('celebrate');
    const rings = s.rings.items.slice(0, s.rings.count).filter((r) => r.x === 120 && r.y === 300);
    const diagonal = Math.hypot(s.width, s.height);
    expect(rings.slice(-3).map((r) => [r.color, Math.round(r.max)])).toEqual([
      [AMBER, Math.round(diagonal)],
      [FLARE, Math.round(diagonal * 0.7)],
      [TEAL, Math.round(diagonal * 0.45)],
    ]);
    expect(count(s, 'confetti')).toBe(CONFETTI);
    expect(count(s, 'ring')).toBeGreaterThanOrEqual(CONFETTI_RINGS);
    expect(s.flash).toBe(FLASH_FINAL);
    expect(s.shake).toBe(SHAKE_FINAL);
  });

  it('throws half the confetti under reduce motion', () => {
    const s = game(8, { reduceMotion: true });
    win(s);
    expect(count(s, 'confetti')).toBe(CONFETTI / 2);
    expect(s.shake).toBeLessThan(SHAKE_FINAL / 4);
  });

  it('keeps room for the confetti and the shockwaves after a full board goes up at once', () => {
    const s = game(60);
    win(s, 120, 300);
    expect(count(s, 'confetti')).toBe(CONFETTI);
    expect(finalRings(s, 120, 300)).toEqual([AMBER, FLARE, TEAL]);
  });
});

describe('phase timing', () => {
  it(`fills ${FILL_DELAY} s after the last zero, and shows the result fillLen + ${RESULT_DELAY} s after that`, () => {
    const s = game(60);
    win(s);
    resetReport(s.report);
    expect(until(s, () => s.phase === 'fill')).toBeCloseTo(FILL_DELAY, 1);
    let shown = 0;
    const t = until(s, () => {
      if (s.report.showResult) shown++;
      resetReport(s.report);
      return s.phase === 'done';
    });
    if (s.report.showResult) shown++;
    expect(t).toBeCloseTo(s.fillLen + RESULT_DELAY, 1);
    expect(shown).toBe(1);
    resetReport(s.report);
    run(s, 2);
    expect(s.report.showResult).toBe(false);
    expect(s.phase).toBe('done');
  });

  it('reports the final kill once', () => {
    const s = game(8);
    win(s);
    expect(s.report.final).toBe(true);
    resetReport(s.report);
    run(s, 5);
    expect(s.report.final).toBe(false);
  });
});

describe('layoutFill', () => {
  it.each([1, 7, 60, 500, 501, 1000])('n = %i: draws fillPlan(n) glyphs, all on screen, rippling out', (n) => {
    const s = game(n);
    const plan = fillPlan(n);
    expect(s.glyphCount).toBe(plan.glyphs);
    expect(s.overlayNumber).toBe(plan.overlayNumber);
    const size = s.glyphSize;
    expect(size).toBeGreaterThan(0);
    const spots = new Set<string>();
    for (const g of s.glyphs.slice(0, s.glyphCount)) {
      expect(g.x - (size * GLYPH_ASPECT) / 2).toBeGreaterThanOrEqual(-1e-6);
      expect(g.x + (size * GLYPH_ASPECT) / 2).toBeLessThanOrEqual(s.width + 1e-6);
      expect(g.y - size / 2).toBeGreaterThanOrEqual(-1e-6);
      expect(g.y + size / 2).toBeLessThanOrEqual(s.height + 1e-6);
      expect(g.delay).toBeGreaterThanOrEqual(0);
      expect(g.delay).toBeLessThanOrEqual(fillSpread(plan.glyphs) + 1e-9);
      spots.add(`${g.x.toFixed(2)},${g.y.toFixed(2)}`);
    }
    expect(spots.size).toBe(plan.glyphs);
    expect(s.fillLen).toBeCloseTo(fillSpread(plan.glyphs) + FILL_POP);
  });

  it('gives a one-zero fill one big zero in the middle', () => {
    const s = game(1);
    const [g] = s.glyphs;
    expect([g!.x, g!.y]).toEqual([s.width / 2, s.height / 2]);
    expect(g!.delay).toBe(0);
    expect(s.glyphSize).toBeGreaterThan(s.width * 0.9);
  });
});

describe('fill sparkles', () => {
  function landed(opts: { reduceMotion?: boolean } = {}) {
    const s = game(30, opts);
    s.phase = 'fill';
    s.phaseT = 10;
    return s;
  }

  it('rise off the glyphs', () => {
    const s = landed();
    run(s, 1);
    expect(s.particles.count).toBeGreaterThan(5);
    expect(count(s, 'dot')).toBe(s.particles.count);
  });

  it('stop at FILL_SPARKLE_CAP', () => {
    const s = landed();
    for (let i = 0; i < FILL_SPARKLE_CAP; i++) Object.assign(acquire(s.particles)!, { life: 0, max: 100 });
    run(s, 1);
    expect(s.particles.count).toBe(FILL_SPARKLE_CAP);
  });

  it('stay off under reduce motion', () => {
    const s = landed({ reduceMotion: true });
    run(s, 2);
    expect(s.particles.count).toBe(0);
  });
});
