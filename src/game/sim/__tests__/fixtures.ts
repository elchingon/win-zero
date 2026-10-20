// Shared setup for sim tests: a phone-sized screen and a round built from the real engine.
import { composeRound, fillPlan, weaponById, type ModeId, type WeaponId } from '@/engine';

import { FINAL_RINGS } from '../constants';
import { acquire } from '../pool';
import { buildGame, createGame } from '../spawn';
import { step } from '../step';
import type { Bullet, GameConfig, GameState, Ring, Zero } from '../types';

/** An iPhone-sized screen with a notch and a home indicator. */
export const SCREEN = { width: 390, height: 844, insetTop: 47, insetBottom: 34 };

export function config(n: number, opts: Partial<Omit<GameConfig, 'weapon'>> & { weapon?: WeaponId } = {}): GameConfig {
  const { weapon = 'pea', ...rest } = opts;
  return {
    n,
    groups: composeRound(n).groups,
    fill: fillPlan(n),
    ...SCREEN,
    weapon: weaponById(weapon),
    seed: 1,
    reduceMotion: false,
    ...rest,
  };
}

export function game(n: number, opts: Parameters<typeof config>[1] = {}): GameState {
  return createGame(config(n, opts));
}

/** A round in exactly `mode`, whether or not it's offered yet. */
export function modeGame(mode: ModeId, n: number, opts: Parameters<typeof config>[1] = {}): GameState {
  return buildGame(config(n, { ...opts, mode }), mode);
}

/** Leave only zero `i` on the board, the counter showing its value. */
export function only(s: GameState, i: number): Zero {
  for (let j = 0; j < s.zeros.length; j++) if (j !== i) s.zeros[j]!.alive = false;
  const z = s.zeros[i]!;
  s.valueLeft = z.value;
  s.report.valueLeft = z.value;
  return z;
}

/** Run the round for `seconds` at 60 fps. */
export function run(state: GameState, seconds: number, fps = 60): void {
  const frames = Math.round(seconds * fps);
  for (let i = 0; i < frames; i++) step(state, 1 / fps);
}

/** Zeros still on the board. */
export const alive = (s: GameState) => s.zeros.filter((z) => z.alive);

/** Make every zero visible and hittable now. */
export function popIn(s: GameState): void {
  for (const z of s.zeros) z.delay = 0;
}

/** Stop every zero where it is. */
export function freeze(s: GameState): void {
  for (const z of s.zeros) {
    z.vx = 0;
    z.vy = 0;
  }
}

/**
 * Keep zero `i` at (x, y), still and hittable, and park every other live zero at the top-left
 * corner, well away from anything fired from the turret.
 */
export function isolate(s: GameState, i: number, x: number, y: number): Zero {
  popIn(s);
  freeze(s);
  for (const z of s.zeros) {
    z.x = z.rx;
    z.y = s.top + z.ry;
  }
  const z = s.zeros[i]!;
  z.x = x;
  z.y = y;
  return z;
}

/** Put a bullet from the current weapon at (x, y), moving at (vx, vy). */
export function bulletAt(s: GameState, x: number, y: number, vx: number, vy: number): Bullet {
  const b = acquire(s.bullets)!;
  Object.assign(b, { x, y, vx, vy, weapon: s.weapon });
  return b;
}

/** The colors of the final zero's shockwaves from (x, y), in the order they were thrown. */
export function finalRings(s: GameState, x: number, y: number): number[] {
  const diagonal = Math.hypot(s.width, s.height);
  const isFinal = (r: Ring) =>
    FINAL_RINGS.some((f) => f.duration === r.dur && f.color === r.color && Math.abs(diagonal * f.reach - r.max) < 1e-6);
  return s.rings.items
    .slice(0, s.rings.count)
    .filter((r) => r.x === x && r.y === y && isFinal(r))
    .map((r) => r.color);
}
