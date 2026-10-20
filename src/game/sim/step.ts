'worklet';
// One frame of the round. The frame callback calls step() with the time since the last frame.
// The round's mode moves its own pieces; effects and the ending are shared by every mode.
import { updateBullets } from './bullets';
import { HIT_FLASH, MAX_DT } from './constants';
import { updateEffects } from './effects';
import { stepCatch } from './modes/catch';
import { stepOrbit } from './modes/orbit';
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

/** Advance the round by `dt` seconds (capped at MAX_DT). */
export function step(state: GameState, dt: number): void {
  const d = Math.min(MAX_DT, Math.max(0, dt));
  state.time += d;
  state.phaseT += d;
  state.sinceShot += d;
  state.sinceDamage += d;
  switch (state.mode) {
    case 'catch':
      stepCatch(state, d);
      break;
    case 'orbit':
      updateFiring(state);
      stepOrbit(state, d);
      updateBullets(state, d);
      break;
    case 'shooter':
    default:
      updateFiring(state);
      updateZeros(state, d);
      updateBullets(state, d);
  }
  updateEffects(state, d);
  updatePhase(state, d);
}
