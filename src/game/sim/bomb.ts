'worklet';
// Bombs (SPEC 5): BOMB_DAMAGE to every zero within BOMB_RADIUS_FRACTION of the screen's longest
// side from the middle of the play area. Armor with more HP than that survives. Spending one
// from the bank is the screen's job; this is only the blast.
import { BOMB_DAMAGE, BOMB_RADIUS_FRACTION } from '@/engine';

import { AMBER, BOMB_MARGIN, BOMB_RING_INNER, BOMB_RING_OUTER, FLARE, FLASH_BOMB, SHAKE_BOMB } from './constants';
import { damageZero } from './damage';
import { addFlash, addRing, addShake } from './effects';
import type { GameState } from './types';

export function bombRadius(s: GameState): number {
  return Math.max(s.width, s.height) * BOMB_RADIUS_FRACTION;
}

/** Drop a bomb on the middle of the play area. False (and nothing happens) once the round is won. */
export function dropBomb(s: GameState): boolean {
  if (s.phase !== 'play') return false;
  const cx = s.width / 2;
  const cy = (s.top + s.bottom) / 2;
  const reach = bombRadius(s);
  addRing(s, cx, cy, BOMB_RING_OUTER.start, reach * BOMB_RING_OUTER.reach, BOMB_RING_OUTER.duration, FLARE, BOMB_RING_OUTER.width);
  addRing(s, cx, cy, BOMB_RING_INNER.start, reach * BOMB_RING_INNER.reach, BOMB_RING_INNER.duration, AMBER, BOMB_RING_INNER.width);
  addFlash(s, FLASH_BOMB);
  addShake(s, SHAKE_BOMB);
  s.report.bombs++;
  s.report.dirty = true;
  for (let i = 0; i < s.zeros.length; i++) {
    const z = s.zeros[i];
    if (!z || !z.alive || Math.hypot(z.x - cx, z.y - cy) >= reach + z.ry * BOMB_MARGIN) continue;
    // A bomb dropped as the round opens catches zeros still on their way in: they appear now.
    if (z.age < z.delay) z.delay = z.age;
    damageZero(s, z, BOMB_DAMAGE);
  }
  return true;
}
