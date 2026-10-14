// Building a round from composeRound, and the zeros moving around the play area.
import { describe, expect, it } from '@jest/globals';

import { composeRound, FILL_GLYPH_CAP } from '@/engine';

import { HUD_BOTTOM, HUD_TOP, MAX_DT, SPAWN_DELAY_MAX, SPEED_MAX, TURRET_Y_FROM_BOTTOM } from '../constants';
import { moveZero, step } from '../step';
import { config, game, run, SCREEN } from './fixtures';

const SIZES = [1, 2, 7, 8, 60, 61, 250, 997, 1000];

const speed = (z: { vx: number; vy: number }) => Math.hypot(z.vx, z.vy);
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

describe('createGame', () => {
  it.each(SIZES)('n = %i: the objects and their values match composeRound', (n) => {
    const s = game(n);
    const round = composeRound(n);
    expect(s.zeros).toHaveLength(round.objectCount);
    expect(s.zeros.every((z) => z.alive)).toBe(true);
    expect(s.zeros.reduce((sum, z) => sum + z.value, 0)).toBe(n);
    expect(s.valueLeft).toBe(n);
    for (const g of round.groups) {
      const matching = s.zeros.filter((z) => z.kind === g.kind && z.value === g.value);
      expect(matching).toHaveLength(g.count);
      expect(matching.every((z) => z.hp === g.hp && z.maxHp === g.hp && z.energyBar === g.energyBar)).toBe(true);
    }
  });

  it.each(SIZES)('n = %i: every zero starts inside the play area, moving', (n) => {
    const s = game(n);
    for (const z of s.zeros) {
      expect(z.x).toBeGreaterThanOrEqual(z.rx);
      expect(z.x).toBeLessThanOrEqual(s.width - z.rx);
      expect(z.y).toBeGreaterThanOrEqual(s.top + z.ry);
      expect(z.y).toBeLessThanOrEqual(s.bottom - z.ry);
      expect(speed(z)).toBeGreaterThan(0);
      expect(z.delay).toBeGreaterThanOrEqual(0);
      expect(z.delay).toBeLessThanOrEqual(SPAWN_DELAY_MAX);
    }
  });

  it('keeps the play area clear of the HUD, inside the safe area', () => {
    const s = game(10);
    expect(s.top).toBe(SCREEN.insetTop + HUD_TOP);
    expect(s.bottom).toBe(SCREEN.height - SCREEN.insetBottom - HUD_BOTTOM);
    expect(s.muzzleX).toBe(SCREEN.width / 2);
    expect(s.muzzleY).toBe(SCREEN.height - SCREEN.insetBottom - TURRET_Y_FROM_BOTTOM);
  });

  it('makes armored zeros bigger and slower than the standard ones', () => {
    const s = game(250);
    const armored = s.zeros.filter((z) => z.kind === 'armored');
    const standard = s.zeros.filter((z) => z.kind === 'standard');
    expect(mean(armored.map((z) => z.ry))).toBeGreaterThan(mean(standard.map((z) => z.ry)));
    expect(mean(armored.map(speed))).toBeLessThan(mean(standard.map(speed)));
  });

  it('gives a one-zero round one big zero', () => {
    const [z] = game(1).zeros;
    expect(z?.ry).toBeGreaterThan(game(60).zeros[0]!.ry * 2);
  });

  it('cycles the zero palette', () => {
    expect(game(8).zeros.map((z) => z.color)).toEqual([0, 1, 2, 3, 0, 1, 2, 3]);
  });

  it('allocates the fill glyphs, up to the cap', () => {
    expect(game(7).glyphs).toHaveLength(7);
    expect(game(1000).glyphs).toHaveLength(FILL_GLYPH_CAP);
  });

  it('is reproducible from its seed', () => {
    expect(game(61, { seed: 9 })).toEqual(game(61, { seed: 9 }));
    expect(game(61, { seed: 9 }).zeros[0]).not.toEqual(game(61, { seed: 10 }).zeros[0]);
  });

  it('starts aiming straight up, with nothing in flight', () => {
    const s = game(30);
    expect(s.phase).toBe('play');
    expect(s.aim).toBeCloseTo(-Math.PI / 2);
    expect([s.bullets.count, s.particles.count, s.rings.count, s.beams.count, s.bolts.count]).toEqual([0, 0, 0, 0, 0]);
  });
});

describe('movement', () => {
  it('bounces off all four edges', () => {
    const s = game(1);
    const z = s.zeros[0]!;
    const cases = [
      { x: z.rx + 1, y: 400, vx: -100, vy: 0 },
      { x: s.width - z.rx - 1, y: 400, vx: 100, vy: 0 },
      { x: 195, y: s.top + z.ry + 1, vx: 0, vy: -100 },
      { x: 195, y: s.bottom - z.ry - 1, vx: 0, vy: 100 },
    ];
    for (const c of cases) {
      Object.assign(z, c);
      moveZero(z, s, 0.05);
      if (c.vx) expect(Math.sign(z.vx)).toBe(-Math.sign(c.vx));
      if (c.vy) expect(Math.sign(z.vy)).toBe(-Math.sign(c.vy));
      expect(z.x).toBeGreaterThanOrEqual(z.rx);
      expect(z.x).toBeLessThanOrEqual(s.width - z.rx);
      expect(z.y).toBeGreaterThanOrEqual(s.top + z.ry);
      expect(z.y).toBeLessThanOrEqual(s.bottom - z.ry);
    }
  });

  it.each([7, 60, 250])('n = %i: zeros stay in the play area for a long round', (n) => {
    const s = game(n, { seed: n });
    for (let i = 0; i < 20 * 60; i++) {
      step(s, 1 / 60);
      for (const z of s.zeros) {
        expect(z.x).toBeGreaterThanOrEqual(z.rx - 1e-9);
        expect(z.x).toBeLessThanOrEqual(s.width - z.rx + 1e-9);
        expect(z.y).toBeGreaterThanOrEqual(s.top + z.ry - 1e-9);
        expect(z.y).toBeLessThanOrEqual(s.bottom - z.ry + 1e-9);
      }
    }
  });

  it('caps a long frame at MAX_DT', () => {
    const s = game(1);
    const z = s.zeros[0]!;
    Object.assign(z, { x: 195, y: 400, vx: SPEED_MAX, vy: 0 });
    step(s, 2);
    expect(z.x).toBeCloseTo(195 + SPEED_MAX * MAX_DT);
    expect(s.time).toBeCloseTo(MAX_DT);
  });

  it('ignores a negative frame', () => {
    const s = game(1);
    step(s, -1);
    expect(s.time).toBe(0);
  });

  it('ages zeros and freezes them during the fill', () => {
    const s = game(3);
    run(s, 1);
    expect(s.zeros[0]!.age).toBeCloseTo(1);
    s.phase = 'fill';
    const before = s.zeros.map((z) => [z.x, z.y]);
    run(s, 1);
    expect(s.zeros.map((z) => [z.x, z.y])).toEqual(before);
  });

  it('uses the same config shape the screen builds', () => {
    expect(config(5).groups).toEqual(composeRound(5).groups);
  });
});
