'worklet';
// Damage and kills. Every weapon, splash, chain and bomb comes through damageZero, so the
// counter, the report and the end of the round are handled in one place.
import { explode, wound } from './effects';
import { hittable } from './hit';
import { splitZero } from './modes/split';
import { celebrate } from './phase';
import type { GameState, Zero } from './types';

/** The last zero went at `z`: stop the shooting and start the celebration. Happens once a round. */
function finishRound(s: GameState, z: Zero): void {
  s.phase = 'celebrate';
  s.phaseT = 0;
  s.firing = false;
  s.report.final = true;
  s.report.dirty = true;
  celebrate(s, z);
}

/** Destroy a zero. `quiet` skips its explosion (Finish round clears the board at once). */
export function killZero(s: GameState, z: Zero, quiet = false): void {
  if (!z.alive) return;
  z.alive = false;
  z.hp = 0;
  s.valueLeft = Math.max(0, s.valueLeft - z.value);
  const r = s.report;
  r.valueLeft = s.valueLeft;
  r.kills++;
  if (z.kind === 'armored') r.armoredKills++;
  r.dirty = true;
  if (!quiet) explode(s, z);
  if (s.valueLeft === 0 && s.phase === 'play') finishRound(s, z);
}

/** Take `damage` off a zero. True when it kills. Only while the round is being played. */
export function damageZero(s: GameState, z: Zero, damage: number): boolean {
  if (s.phase !== 'play' || damage <= 0 || !hittable(z)) return false;
  s.sinceDamage = 0;
  z.hp -= damage;
  if (z.hp <= 0) {
    // Orbit: an armored zero splits into smaller zeros that keep its value (SPEC 9). Only a hit
    // splits one; Finish round's kills never do, so the round always ends.
    if (s.modeState.mode === 'orbit' && z.kind === 'armored') splitZero(s, s.modeState, z);
    killZero(s, z);
    return true;
  }
  wound(s, z);
  s.report.hits++;
  s.report.dirty = true;
  return false;
}
