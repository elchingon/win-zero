// Shared setup for sim tests: a phone-sized screen and a round built from the real engine.
import { composeRound, fillPlan, weaponById, type WeaponId } from '@/engine';

import { acquire } from '../pool';
import { createGame } from '../spawn';
import { step } from '../step';
import type { Bullet, GameConfig, GameState, Zero } from '../types';

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
