'worklet';
// Damage and kills. Every weapon, splash, chain and bomb comes through damageZero, so the
// counter, the report and the end of the round are handled in one place.
import { hittable } from './hit';
import type { GameState, Zero } from './types';

/** The last zero went: stop the shooting and start the celebration. Happens once a round. */
function finishRound(s: GameState): void {
  s.phase = 'celebrate';
  s.phaseT = 0;
  s.firing = false;
  s.report.final = true;
  s.report.dirty = true;
}

export function killZero(s: GameState, z: Zero): void {
  if (!z.alive) return;
  z.alive = false;
  z.hp = 0;
  s.valueLeft = Math.max(0, s.valueLeft - z.value);
  const r = s.report;
  r.valueLeft = s.valueLeft;
  r.kills++;
  if (z.kind === 'armored') r.armoredKills++;
  r.dirty = true;
  if (s.valueLeft === 0 && s.phase === 'play') finishRound(s);
}

/** Take `damage` off a zero. True when it kills. Only while the round is being played. */
export function damageZero(s: GameState, z: Zero, damage: number): boolean {
  if (s.phase !== 'play' || damage <= 0 || !hittable(z)) return false;
  z.hp -= damage;
  if (z.hp <= 0) {
    killZero(s, z);
    return true;
  }
  z.hitFlash = 1;
  s.report.hits++;
  s.report.dirty = true;
  return false;
}
