'worklet';
// Finish round, for players using a screen reader: the round is visual only, so the HUD offers
// a way to clear it. Every zero left goes at once, quietly, and the one nearest the middle goes
// last, setting off the usual finale from there.
import { killZero } from './damage';
import type { GameState, Zero } from './types';

/** Clear the board. False (and nothing happens) unless the round is being played. */
export function finishAll(s: GameState): boolean {
  if (s.phase !== 'play') return false;
  const cx = s.width / 2;
  const cy = (s.top + s.bottom) / 2;
  let last: Zero | null = null;
  let nearest = Infinity;
  for (let i = 0; i < s.zeros.length; i++) {
    const z = s.zeros[i];
    if (!z || !z.alive) continue;
    const d = Math.hypot(z.x - cx, z.y - cy);
    if (d < nearest) {
      nearest = d;
      last = z;
    }
  }
  if (!last) return false;
  for (let i = 0; i < s.zeros.length; i++) {
    const z = s.zeros[i];
    if (z && z.alive && z !== last) killZero(s, z, true);
  }
  // Still on its way in: it appears now, for its finale.
  if (last.age < last.delay) last.delay = last.age;
  killZero(s, last);
  return true;
}
