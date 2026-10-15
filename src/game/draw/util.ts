'worklet';
// Small drawing helpers that reuse the frame scratch instead of allocating.
import type { SkColor, SkPaint, SkRect } from '@shopify/react-native-skia';

import type { Rgba, Scratch } from './types';

/** Set a paint's color from an [r, g, b, a] array, times `alpha`, without allocating. */
export function paintColor(paint: SkPaint, sc: Scratch, color: Rgba, alpha: number): void {
  const out = sc.rgba;
  out[0] = color[0] ?? 0;
  out[1] = color[1] ?? 0;
  out[2] = color[2] ?? 0;
  out[3] = (color[3] ?? 1) * alpha;
  paint.setColor(out as unknown as SkColor);
}

/** The scratch rect, set to (x, y, width, height). */
export function rect(sc: Scratch, x: number, y: number, width: number, height: number): SkRect {
  const r = sc.rect as { x: number; y: number; width: number; height: number };
  r.x = x;
  r.y = y;
  r.width = width;
  r.height = height;
  return sc.rect;
}
