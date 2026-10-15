'worklet';
// The celebration fill (the prototype's fill mode): a warm glow, then the round's zeros as
// Bungee "0"s popping in from the middle out, breathing gently, and the full number on top
// when there are too many to draw.
import type { SkCanvas, SkColor, SkImage, SkRSXform, SkRect } from '@shopify/react-native-skia';

import { FILL_POP } from '../sim/constants';
import { clamp01, easeBack } from '../sim/ease';
import type { GameState } from '../sim/types';

import { beginBatch, endBatch, pushSprite, tintLast } from './batch';
import type { Kit, Scratch } from './types';
import { rect } from './util';

/** The glow fades in over this long. */
const GLOW_IN = 0.6;
/** Glyphs breathe: scale ± AMOUNT, at SPEED rad/s, out of step by PHASE per point across. */
const BREATHE = { speed: 3, phase: 0.02, amount: 0.02 };
/** The overlaid number sits this far down the screen and pops in as the last glyphs land. */
const OVERLAY_Y = 0.5;

function drawGlyphs(canvas: SkCanvas, s: GameState, kit: Kit, atlas: SkImage, sc: Scratch): void {
  const batch = sc.glyphs;
  const sprite = kit.sheet.glyph;
  const base = s.glyphSize / sprite.ry;
  beginBatch(batch);
  for (let i = 0; i < s.glyphCount; i++) {
    const g = s.glyphs[i];
    if (!g) continue;
    const p = clamp01((s.phaseT - g.delay) / FILL_POP);
    if (p <= 0) continue;
    const breathe = s.reduceMotion ? 1 : 1 + Math.sin(s.time * BREATHE.speed + g.x * BREATHE.phase) * BREATHE.amount;
    if (!pushSprite(batch, sprite, g.x, g.y, easeBack(p) * breathe * base, 0)) break;
    tintLast(batch, kit.palette[g.color] ?? kit.colors.fg, 1);
  }
  endBatch(batch);
  if (batch.count === 0) return;
  canvas.drawAtlas(
    atlas,
    batch.srcs as unknown as SkRect[],
    batch.dsts as unknown as SkRSXform[],
    kit.paints.sprite,
    kit.blend.modulate,
    batch.cols as unknown as SkColor[],
  );
}

function drawOverlay(canvas: SkCanvas, s: GameState, kit: Kit): void {
  const o = kit.overlay;
  if (!o || !s.overlayNumber) return;
  const p = clamp01((s.phaseT - (s.fillLen - FILL_POP)) / FILL_POP);
  if (p <= 0) return;
  const scale = easeBack(p);
  canvas.save();
  canvas.translate(s.width / 2, s.height * OVERLAY_Y);
  canvas.scale(scale, scale);
  canvas.drawText(o.label, o.x, o.y, kit.paints.overlayStroke, o.font);
  canvas.drawText(o.label, o.x, o.y, kit.paints.overlayFill, o.font);
  canvas.restore();
}

export function drawFill(canvas: SkCanvas, s: GameState, kit: Kit, atlas: SkImage | null, sc: Scratch): void {
  const glow = kit.paints.fillGlow;
  glow.setAlphaf(s.phase === 'done' ? 1 : clamp01(s.phaseT / GLOW_IN));
  canvas.drawRect(rect(sc, 0, 0, s.width, s.height), glow);
  if (atlas) drawGlyphs(canvas, s, kit, atlas, sc);
  drawOverlay(canvas, s, kit);
}
