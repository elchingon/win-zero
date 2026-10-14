'worklet';
// One frame of the round. The frame callback calls step() with the time since the last frame.
import { updateBullets } from './bullets';
import { HIT_FLASH, MAX_DT } from './constants';
import { updateEffects } from './effects';
import { updateFiring } from './input';
import { updatePhase } from './phase';
import type { GameState, Zero } from './types';

/** Move a zero and bounce it off the play area's edges. */
export function moveZero(z: Zero, state: GameState, dt: number): void {
  z.x += z.vx * dt;
  z.y += z.vy * dt;
  if (z.x < z.rx) {
    z.x = z.rx;
    z.vx = Math.abs(z.vx);
  } else if (z.x > state.width - z.rx) {
    z.x = state.width - z.rx;
    z.vx = -Math.abs(z.vx);
  }
  if (z.y < state.top + z.ry) {
    z.y = state.top + z.ry;
    z.vy = Math.abs(z.vy);
  } else if (z.y > state.bottom - z.ry) {
    z.y = state.bottom - z.ry;
    z.vy = -Math.abs(z.vy);
  }
}

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
  updateFiring(state);
  updateZeros(state, d);
  updateBullets(state, d);
  updateEffects(state, d);
  updatePhase(state, d);
}
