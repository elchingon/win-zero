'worklet';
// Which zeros can be hit, and whether a point (the prototype's hitTest) or a blade's stroke lands on one.
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

/**
 * Does the segment from (x1, y1) to (x2, y2) cross the zero: its ellipse, padded as hitTest's,
 * plus `reach` all round? In the zero's own scaled space the ellipse is the unit circle, so the
 * question is whether the segment comes within 1 of the middle.
 */
export function segmentHitsZero(x1: number, y1: number, x2: number, y2: number, z: Zero, reach: number): boolean {
  const rx = Math.max(z.rx, HIT_MIN_RX) + HIT_PAD + reach;
  const ry = Math.max(z.ry, HIT_MIN_RY) + HIT_PAD + reach;
  const ax = (x1 - z.x) / rx;
  const ay = (y1 - z.y) / ry;
  const dx = (x2 - x1) / rx;
  const dy = (y2 - y1) / ry;
  const len2 = dx * dx + dy * dy;
  const t = len2 > 0 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2)) : 0;
  const px = ax + dx * t;
  const py = ay + dy * t;
  return px * px + py * py <= 1;
}
