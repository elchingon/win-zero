'worklet';
// Shots leaving the turret, as in the prototype's fire().
import { BULLET_SPEED, MUZZLE_OFFSET } from './constants';
import { acquire } from './pool';
import type { GameState } from './types';

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
  const a = s.aim;
  s.muzzle = 1;
  s.sinceShot = 0;
  s.report.shots++;
  s.report.dirty = true;
  launch(s, s.muzzleX + Math.cos(a) * MUZZLE_OFFSET, s.muzzleY + Math.sin(a) * MUZZLE_OFFSET, a, BULLET_SPEED);
}
