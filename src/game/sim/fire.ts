'worklet';
// Shots leaving the turret, as in the prototype's fire(): one bullet, two side by side, a fan
// of pellets, or the laser's beam.
import { BIG_BULLET_SPEED, BULLET_SPEED, FAN_STEP, MUZZLE_OFFSET, PARALLEL_OFFSET } from './constants';
import { acquire } from './pool';
import type { GameState } from './types';
import { fireBeam } from './weapons';

/** Launch one bullet from (x, y) at `angle`. Dropped quietly when the pool is full. */
function launch(s: GameState, x: number, y: number, angle: number, speed: number): void {
  const b = acquire(s.bullets);
  if (!b) return;
  b.x = x;
  b.y = y;
  b.vx = Math.cos(angle) * speed;
  b.vy = Math.sin(angle) * speed;
  b.weapon = s.weapon;
}

/** Fire the current weapon along the current aim. */
export function fireShot(s: GameState): void {
  const w = s.weapon;
  const a = s.aim;
  s.muzzle = 1;
  s.sinceShot = 0;
  s.report.shots++;
  s.report.dirty = true;
  if (w.pattern === 'beam') {
    fireBeam(s, w, a);
    return;
  }
  // Rockets and nukes fly slower.
  const speed = w.splash ? BIG_BULLET_SPEED : BULLET_SPEED;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  for (let i = 0; i < w.projectiles; i++) {
    // -1/2 … +1/2 of the spread for two shots, -2 … +2 for five.
    const slot = i - (w.projectiles - 1) / 2;
    const angle = w.pattern === 'fan' ? a + slot * FAN_STEP : a;
    // Parallel shots sit side by side, PARALLEL_OFFSET either side of the aim line.
    const offset = w.pattern === 'parallel' ? slot * 2 * PARALLEL_OFFSET : 0;
    launch(
      s,
      s.muzzleX - sin * offset + Math.cos(angle) * MUZZLE_OFFSET,
      s.muzzleY + cos * offset + Math.sin(angle) * MUZZLE_OFFSET,
      angle,
      speed,
    );
  }
}
