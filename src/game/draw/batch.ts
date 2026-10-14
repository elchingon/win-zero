'worklet';
// Collecting sprites for one drawAtlas call without allocating: transforms come from a fixed
// set, and the arrays handed to Skia are trimmed to the frame's count.
import type { Batch, Sprite, Xform } from './types';

export function makeBatch(capacity: number): Batch {
  const xforms: Xform[] = [];
  for (let i = 0; i < capacity; i++) xforms.push({ scos: 1, ssin: 0, tx: 0, ty: 0 });
  return { srcs: [], dsts: [], xforms, count: 0 };
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
  b.count++;
  return true;
}

/** Trim the arrays to this frame's sprites, ready to hand to drawAtlas. */
export function endBatch(b: Batch): void {
  b.srcs.length = b.count;
  b.dsts.length = b.count;
}
