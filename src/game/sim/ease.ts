'worklet';
// Easing and decay, as in the prototype.

/** How far easeBack overshoots before settling. */
export const EASE_BACK_OVERSHOOT = 1.9;

export function clamp01(t: number): number {
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

/** Cubic ease-out: fast start, gentle landing. */
export function easeOut(t: number): number {
  const u = 1 - t;
  return 1 - u * u * u;
}

/** Overshoots past 1, then settles back: the pop-in for zeros and fill glyphs. */
export function easeBack(t: number): number {
  const u = t - 1;
  return 1 + (EASE_BACK_OVERSHOOT + 1) * u * u * u + EASE_BACK_OVERSHOOT * u * u;
}

/** The factor that applies `perFrame` once per 1/60 s, for a step of `dt` seconds. */
export function decay(perFrame: number, dt: number): number {
  return Math.pow(perFrame, dt * 60);
}
