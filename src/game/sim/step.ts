'worklet';
// One frame of the round. The frame callback calls step() with the time since the last frame.
// The round's mode moves its own pieces, and sets off a boss's rings its own way; effects and the
// ending are shared by every mode.
import { shedShooter, updateBoss } from './boss';
import { updateBullets } from './bullets';
import { HIT_FLASH, MAX_DT } from './constants';
import { updateEffects } from './effects';
import { shedBreaker, stepBreaker } from './modes/breaker';
import { shedCatch, stepCatch } from './modes/catch';
import { shedOrbit, stepOrbit } from './modes/orbit';
import { shedSlice, stepSlice } from './modes/slice';
import { moveZero } from './move';
import { updatePhase } from './phase';
import { updateFiring } from './trigger';
import type { GameState } from './types';

export { moveZero } from './move';

function updateZeros(state: GameState, dt: number): void {
  // The fill freezes whatever's left behind it.
  const moving = state.phase === 'play' || state.phase === 'celebrate';
  for (let i = 0; i < state.zeros.length; i++) {
    const z = state.zeros[i];
    if (!z || !z.alive) continue;
    z.age += dt;
    if (z.hitFlash > 0) z.hitFlash = Math.max(0, z.hitFlash - dt / HIT_FLASH);
    if (moving) moveZero(z, state, dt);
  }
}

/**
 * A boss round: set off the ring a broken stage left in the spare slots (boss.ts), in the round's
 * mode's way, and keep the boss's shield up until the ring is gone.
 */
function bossFrame(state: GameState, dt: number): void {
  const bs = state.boss;
  if (bs === null) return;
  const boss = state.zeros[bs.slot];
  let count = 0;
  for (let j = bs.ringFrom; j < state.zeros.length; j++) if (bs.fresh[j]) count++;
  let k = 0;
  for (let j = bs.ringFrom; j < state.zeros.length && boss && count > 0; j++) {
    const r = state.zeros[j];
    if (!r || !bs.fresh[j]) continue;
    bs.fresh[j] = false;
    const ms = state.modeState;
    switch (ms.mode) {
      case 'catch':
        shedCatch(state, ms, boss, r, j, k, count);
        break;
      case 'orbit':
        shedOrbit(state, ms, bs.slot, r, j, k, count);
        break;
      case 'slice':
        shedSlice(state, ms, boss, r, j, k, count);
        break;
      case 'breaker':
        shedBreaker(state, boss, r, k, count);
        break;
      case 'shooter':
      default:
        shedShooter(state, boss, r, k, count);
    }
    k++;
  }
  updateBoss(state, dt);
}

/** Advance the round by `dt` seconds (capped at MAX_DT). */
export function step(state: GameState, dt: number): void {
  const d = Math.min(MAX_DT, Math.max(0, dt));
  state.time += d;
  state.phaseT += d;
  state.sinceShot += d;
  state.sinceDamage += d;
  if (state.boss !== null) bossFrame(state, d);
  switch (state.mode) {
    case 'catch':
      stepCatch(state, d);
      break;
    case 'orbit':
      updateFiring(state);
      stepOrbit(state, d);
      updateBullets(state, d);
      break;
    case 'slice':
      stepSlice(state, d);
      break;
    case 'breaker':
      stepBreaker(state, d);
      break;
    case 'shooter':
    default:
      updateFiring(state);
      updateZeros(state, d);
      updateBullets(state, d);
  }
  updateEffects(state, d);
  updatePhase(state, d);
  // Last, so a flash between frames (a bomb) and one in this step (the final) count as one.
  state.sinceFlash += d;
}
