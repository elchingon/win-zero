'worklet';
// The board every game mode plays on: keeping a zero inside it, which zeros a catch or a cut can
// take, and how many are left. A leaf file, so any mode can use it.
import { hittable } from './hit';
import type { GameState, Zero } from './types';

/** Keep a zero inside the play area: x in [rx, width − rx], y in [top + ry, bottom − ry]. */
export function keepOnBoard(z: Zero, s: GameState): void {
  if (z.x < z.rx) z.x = z.rx;
  else if (z.x > s.width - z.rx) z.x = s.width - z.rx;
  if (z.y < s.top + z.ry) z.y = s.top + z.ry;
  else if (z.y > s.bottom - z.ry) z.y = s.bottom - z.ry;
}

/** On the board, popped in, and not just caught or cut: ready to be caught or cut (Catch, Slice). */
export function catchable(z: Zero): boolean {
  return hittable(z) && z.cooldown <= 0;
}

/** Zeros still on the board, popped in or not. */
export function liveZeros(s: GameState): number {
  let count = 0;
  for (let i = 0; i < s.zeros.length; i++) if (s.zeros[i]?.alive) count++;
  return count;
}
