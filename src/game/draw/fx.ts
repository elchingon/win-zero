'worklet';
// Shots and effects, drawn additively over the zeros like the prototype's 'lighter' passes.
import type { SkCanvas, SkColor, SkImage, SkRSXform, SkRect } from '@shopify/react-native-skia';

import { easeOut } from '../sim/ease';
import type { GameState } from '../sim/types';

import { beginBatch, endBatch, pushSprite, tintLast } from './batch';
import type { Batch, Kit, Scratch } from './types';
import { paintColor } from './util';

/** Shockwaves start at this opacity and never get thinner than RING_MIN_WIDTH. */
const RING_ALPHA = 0.9;
const RING_MIN_WIDTH = 0.5;

function drawBatch(canvas: SkCanvas, kit: Kit, atlas: SkImage, batch: Batch): void {
  if (batch.count === 0) return;
  const srcs = batch.srcs as unknown as SkRect[];
  const dsts = batch.dsts as unknown as SkRSXform[];
  if (batch.tinted) {
    canvas.drawAtlas(atlas, srcs, dsts, kit.paints.spriteAdd, kit.blend.modulate, batch.cols as unknown as SkColor[]);
  } else {
    canvas.drawAtlas(atlas, srcs, dsts, kit.paints.spriteAdd);
  }
}

/** Bullets: a baked streak per kind, turned to face where each one is going. */
export function drawBullets(canvas: SkCanvas, s: GameState, kit: Kit, atlas: SkImage, sc: Scratch): void {
  const batch = sc.bullets;
  const kinds = kit.sheet.bullets;
  beginBatch(batch);
  for (let i = 0; i < s.bullets.count; i++) {
    const b = s.bullets.items[i];
    if (!b) continue;
    const w = b.weapon;
    // Rockets and nukes are big flare bolts, the zapper's are teal, the rest amber.
    const sprite = w.splash ? kinds[2] : w.chain ? kinds[1] : kinds[0];
    if (!sprite) continue;
    pushSprite(batch, sprite, b.x, b.y, 1 / sprite.ry, Math.atan2(b.vy, b.vx));
  }
  endBatch(batch);
  drawBatch(canvas, kit, atlas, batch);
}

/** Shockwave rings: growing, thinning and fading. */
export function drawRings(canvas: SkCanvas, s: GameState, kit: Kit, sc: Scratch): void {
  const paint = kit.paints.glowStroke;
  for (let i = 0; i < s.rings.count; i++) {
    const r = s.rings.items[i];
    if (!r) continue;
    const k = r.t / r.dur;
    const radius = r.r + (r.max - r.r) * easeOut(k);
    paintColor(paint, sc, kit.palette[r.color] ?? kit.colors.fg, (1 - k) * RING_ALPHA);
    paint.setStrokeWidth(Math.max(RING_MIN_WIDTH, r.width * (1 - k)));
    canvas.drawCircle(r.x, r.y, radius, paint);
  }
}

/** Every particle in one call: white shapes tinted to their color and faded as they age. */
export function drawParticles(canvas: SkCanvas, s: GameState, kit: Kit, atlas: SkImage, sc: Scratch): void {
  const batch = sc.particles;
  const fx = kit.sheet.fx;
  beginBatch(batch);
  for (let i = 0; i < s.particles.count; i++) {
    const p = s.particles.items[i];
    if (!p) continue;
    const fade = 1 - p.life / p.max;
    if (fade <= 0) continue;
    const sprite = p.shape === 'dot' ? fx.dot : p.shape === 'confetti' ? fx.confetti : fx.ring;
    if (!pushSprite(batch, sprite, p.x, p.y, p.size / sprite.ry, p.shape === 'dot' ? 0 : p.rot)) break;
    tintLast(batch, kit.palette[p.color] ?? kit.colors.fg, fade);
  }
  endBatch(batch);
  drawBatch(canvas, kit, atlas, batch);
}
