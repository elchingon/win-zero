'worklet';
// Collecting sprites for one drawAtlas call without allocating: transforms (and tints) come
// from a fixed set, and the arrays handed to Skia are trimmed to the frame's count.
import type { Batch, Rgba, Sprite, Xform } from './types';

/** A batch of up to `capacity` sprites. A tinted batch also carries a color per sprite. */
export function makeBatch(capacity: number, tinted = false): Batch {
  const xforms: Xform[] = [];
  const tints: Rgba[] = [];
  for (let i = 0; i < capacity; i++) {
    xforms.push({ scos: 1, ssin: 0, tx: 0, ty: 0 });
    if (tinted) tints.push([1, 1, 1, 1]);
  }
  return { srcs: [], dsts: [], cols: [], xforms, tints, tinted, count: 0 };
}

export function beginBatch(b: Batch): void {
  b.count = 0;
}

/** Queue `sprite` centered on (x, y), scaled and rotated (radians). False when the batch is full. */
export function pushSprite(b: Batch, sprite: Sprite, x: number, y: number, scale: number, rotation: number): boolean {
  const xf = b.xforms[b.count];
  if (!xf) return false;
  const c = Math.cos(rotation) * scale;
  const s = Math.sin(rotation) * scale;
  const hw = sprite.width / 2;
  const hh = sprite.height / 2;
  xf.scos = c;
  xf.ssin = s;
  xf.tx = x - (c * hw - s * hh);
  xf.ty = y - (s * hw + c * hh);
  b.srcs[b.count] = sprite;
  b.dsts[b.count] = xf;
  if (b.tinted) {
    const tint = b.tints[b.count];
    if (tint) {
      tint[0] = 1;
      tint[1] = 1;
      tint[2] = 1;
      tint[3] = 1;
      b.cols[b.count] = tint;
    }
  }
  b.count++;
  return true;
}

/** Tint the sprite just pushed: `color` times `alpha`. Only for tinted batches. */
export function tintLast(b: Batch, color: Rgba, alpha: number): void {
  const tint = b.cols[b.count - 1];
  if (!tint) return;
  tint[0] = color[0] ?? 1;
  tint[1] = color[1] ?? 1;
  tint[2] = color[2] ?? 1;
  tint[3] = Math.max(0, Math.min(1, (color[3] ?? 1) * alpha));
}

/** Trim the arrays to this frame's sprites, ready to hand to drawAtlas. */
export function endBatch(b: Batch): void {
  b.srcs.length = b.count;
  b.dsts.length = b.count;
  if (b.tinted) b.cols.length = b.count;
}
