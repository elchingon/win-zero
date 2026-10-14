'worklet';
// Bullets in flight. They move in short sub-steps so a fast one can't skip over a small zero.
import { BULLET_SUBSTEP, OFFSCREEN_MARGIN } from './constants';
import { damageZero } from './damage';
import { hitTest, hittable } from './hit';
import { release } from './pool';
import type { Bullet, GameState, Zero } from './types';

function offscreen(s: GameState, b: Bullet): boolean {
  return b.x < -OFFSCREEN_MARGIN || b.x > s.width + OFFSCREEN_MARGIN || b.y < -OFFSCREEN_MARGIN || b.y > s.height + OFFSCREEN_MARGIN;
}

/** The first zero under (x, y), in board order, or null. */
function zeroAt(s: GameState, x: number, y: number): Zero | null {
  for (let i = 0; i < s.zeros.length; i++) {
    const z = s.zeros[i];
    if (z && hittable(z) && hitTest(x, y, z)) return z;
  }
  return null;
}

export function updateBullets(s: GameState, dt: number): void {
  const pool = s.bullets;
  if (pool.count === 0) return;
  const steps = Math.max(1, Math.ceil(dt / BULLET_SUBSTEP));
  const h = dt / steps;
  for (let k = 0; k < steps; k++) {
    for (let i = pool.count - 1; i >= 0; i--) {
      const b = pool.items[i];
      if (!b) continue;
      b.x += b.vx * h;
      b.y += b.vy * h;
      if (offscreen(s, b)) {
        release(pool, i);
        continue;
      }
      // After the last zero goes, bullets still in the air fly on harmlessly.
      if (s.phase !== 'play') continue;
      const z = zeroAt(s, b.x, b.y);
      if (!z) continue;
      const weapon = b.weapon;
      release(pool, i);
      damageZero(s, z, weapon.damage);
    }
  }
}
