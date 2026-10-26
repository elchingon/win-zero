'worklet';
// A zero's straight-line flight, bouncing off the play area's edges, as the Shooter moves them.
// A leaf file, so modes can use it without importing step.ts, which imports them.
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
