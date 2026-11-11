'worklet';
// The board every game mode plays on: keeping a zero inside it, which zeros a catch or a cut can
// take, and how many are left. A leaf file, so any mode can use it.
import { ASSIST_LAST } from './constants';
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

/**
 * Late in the round, when a mode helps with the last few (SPEC 9): ASSIST_LAST or fewer zeros
 * left. A boss round's boss alone isn't few until its last stage; its ring's last few are.
 */
export function fewLeft(s: GameState): boolean {
  const live = liveZeros(s);
  if (s.boss === null) return live <= ASSIST_LAST;
  return s.boss.stage >= s.boss.stages - 1 || (live > 1 && live <= ASSIST_LAST);
}
