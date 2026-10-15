'worklet';
// Which zeros can be hit, and whether a point lands on one (the prototype's hitTest).
import { HIT_MIN_RX, HIT_MIN_RY, HIT_PAD } from './constants';
import type { Zero } from './types';

/** On the board and popped in. Nothing touches a zero before it appears. */
export function hittable(z: Zero): boolean {
  return z.alive && z.age >= z.delay;
}

/** Is (x, y) on the zero? Its ellipse, with small zeros padded out to a fair target. */
export function hitTest(x: number, y: number, z: Zero): boolean {
  const rx = Math.max(z.rx, HIT_MIN_RX) + HIT_PAD;
  const ry = Math.max(z.ry, HIT_MIN_RY) + HIT_PAD;
  const dx = (x - z.x) / rx;
  const dy = (y - z.y) / ry;
  return dx * dx + dy * dy <= 1;
}
