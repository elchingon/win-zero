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
/** Laser beams, at full strength: a soft glow and the beam in the shot color, and a fg core (widths in points). */
const BEAM_GLOW = { width: 30, alpha: 0.3 };
const BEAM_WIDTH = 14;
const BEAM_CORE = 4;
/** Lightning bolts: a glow under a thin line, in the chain shot's color. */
const BOLT_GLOW = { width: 9, alpha: 0.35 };
const BOLT_WIDTH = 3;

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
    // Rockets and nukes are big shots, the zapper's are chain shots, the rest the usual.
    const sprite = w.splash ? kinds[2] : w.chain ? kinds[1] : kinds[0];
    if (!sprite) continue;
    pushSprite(batch, sprite, b.x, b.y, 1 / sprite.ry, Math.atan2(b.vy, b.vx));
  }
  endBatch(batch);
  drawBatch(canvas, kit, atlas, batch);
}

/** Rail Laser beams: three additive strokes standing in for the prototype's blurred glow. */
export function drawBeams(canvas: SkCanvas, s: GameState, kit: Kit, sc: Scratch): void {
  const paint = kit.paints.glowStroke;
  for (let i = 0; i < s.beams.count; i++) {
    const b = s.beams.items[i];
    if (!b) continue;
    const k = 1 - b.t / b.dur;
    paintColor(paint, sc, kit.colors.shot, k * BEAM_GLOW.alpha);
    paint.setStrokeWidth(BEAM_GLOW.width * k);
    canvas.drawLine(b.x1, b.y1, b.x2, b.y2, paint);
    paintColor(paint, sc, kit.colors.shot, k);
    paint.setStrokeWidth(BEAM_WIDTH * k);
    canvas.drawLine(b.x1, b.y1, b.x2, b.y2, paint);
    paintColor(paint, sc, kit.colors.fg, 1);
    paint.setStrokeWidth(BEAM_CORE * k);
    canvas.drawLine(b.x1, b.y1, b.x2, b.y2, paint);
  }
}

function boltPass(canvas: SkCanvas, s: GameState, kit: Kit, sc: Scratch, width: number, alpha: number): void {
  const paint = kit.paints.glowStroke;
  paint.setStrokeWidth(width);
  for (let i = 0; i < s.bolts.count; i++) {
    const b = s.bolts.items[i];
    if (!b) continue;
    paintColor(paint, sc, kit.colors.chain, (1 - b.t / b.dur) * alpha);
    for (let p = 1; p < b.xs.length; p++) {
      canvas.drawLine(b.xs[p - 1] ?? 0, b.ys[p - 1] ?? 0, b.xs[p] ?? 0, b.ys[p] ?? 0, paint);
    }
  }
}

/** Chain Zapper bolts: a glow pass, then the line, both fading. */
export function drawBolts(canvas: SkCanvas, s: GameState, kit: Kit, sc: Scratch): void {
  if (s.bolts.count === 0) return;
  boltPass(canvas, s, kit, sc, BOLT_GLOW.width, BOLT_GLOW.alpha);
  boltPass(canvas, s, kit, sc, BOLT_WIDTH, 1);
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
