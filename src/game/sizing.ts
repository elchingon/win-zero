// Zero sizes, ported from the prototype's zeroRadius(). Shared by the background field and the game.

/** Zeros never get smaller than this, in points. */
export const ZERO_MIN_RADIUS = 10;
/** Or bigger than this fraction of the screen's shorter side. */
export const ZERO_MAX_SIDE_FRACTION = 0.19;
/** n zeros together cover about this fraction of the screen. */
export const ZERO_AREA_FRACTION = 0.1;
/** Zeros are ovals: horizontal radius over vertical. */
export const ZERO_ASPECT = 0.72;
/** Ring thickness as a fraction of the vertical radius. */
export const ZERO_STROKE = 0.3;

/** Vertical radius of each zero when `n` share a `width` × `height` screen. */
export function zeroRadius(n: number, width: number, height: number): number {
  const byArea = Math.sqrt((width * height * ZERO_AREA_FRACTION) / Math.max(1, n)) / 2;
  return Math.max(ZERO_MIN_RADIUS, Math.min(Math.min(width, height) * ZERO_MAX_SIDE_FRACTION, byArea));
}
