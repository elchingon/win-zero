'worklet';
// The zeros: rings (with armored ×V badges) from the atlas in one call, an additive flash on
// the ones just hit, and energy bars over the tough ones.
import type { SkCanvas, SkColor, SkImage, SkRSXform, SkRect } from '@shopify/react-native-skia';

import { FG, POP_IN } from '../sim/constants';
import { clamp01, easeBack } from '../sim/ease';
import type { GameState, Zero } from '../sim/types';

import { beginBatch, endBatch, pushSprite, tintLast } from './batch';
import type { Kit, Scratch } from './types';
import { paintColor, rect } from './util';

/** A zero swells by this much when hit, settling as its flash fades. */
const HIT_SWELL = 0.08;
/** Badges hang this many ry below the zero's center, overlapping the bottom of the ring. */
const BADGE_DROP = 0.92;
/** Energy bars: points above the ring, height, and the narrowest a bar gets. */
const BAR_GAP = 5;
const BAR_HEIGHT = 4;
const BAR_MIN_WIDTH = 18;
/** Bar width as a fraction of the ring's width. */
const BAR_WIDTH = 0.9;
const BAR_TRACK_ALPHA = 0.85;

/** A zero's pop-in scale: easeBack from 0 once its spawn delay is over. */
export function popScale(z: Zero): number {
  return z.delay > 0 ? easeBack(clamp01((z.age - z.delay) / POP_IN)) : 1;
}

/** Drawn size: the pop-in, plus a swell while it's flashing from a hit. */
function zeroScale(z: Zero): number {
  return popScale(z) * (1 + HIT_SWELL * z.hitFlash);
}

export function drawZeros(canvas: SkCanvas, s: GameState, kit: Kit, atlas: SkImage, sc: Scratch): void {
  const batch = sc.zeros;
  const sheet = kit.sheet;
  beginBatch(batch);
  for (let i = 0; i < s.zeros.length; i++) {
    const z = s.zeros[i];
    if (!z || !z.alive) continue;
    const scale = zeroScale(z);
    if (scale <= 0.001) continue;
    const ring = z.kind === 'armored' ? sheet.armored[z.color] : sheet.zero[z.color];
    if (!ring) continue;
    pushSprite(batch, ring, z.x, z.y, (z.ry * scale) / ring.ry, 0);
    const badge = z.badge >= 0 ? sheet.badges[z.badge] : undefined;
    if (badge) pushSprite(batch, badge, z.x, z.y + z.ry * BADGE_DROP * scale, scale / badge.ry, 0);
  }
  endBatch(batch);
  if (batch.count === 0) return;
  canvas.drawAtlas(atlas, batch.srcs as unknown as SkRect[], batch.dsts as unknown as SkRSXform[], kit.paints.sprite);
}

/** Zeros that were just hit glow white for a moment: their fg ring, added on top. */
export function drawHitFlashes(canvas: SkCanvas, s: GameState, kit: Kit, atlas: SkImage, sc: Scratch): void {
  const batch = sc.flashes;
  const sheet = kit.sheet;
  beginBatch(batch);
  for (let i = 0; i < s.zeros.length; i++) {
    const z = s.zeros[i];
    if (!z || !z.alive || z.hitFlash <= 0) continue;
    const ring = z.kind === 'armored' ? sheet.armored[FG] : sheet.zero[FG];
    if (!ring) continue;
    if (!pushSprite(batch, ring, z.x, z.y, (z.ry * zeroScale(z)) / ring.ry, 0)) break;
    tintLast(batch, kit.colors.fg, z.hitFlash);
  }
  endBatch(batch);
  if (batch.count === 0) return;
  canvas.drawAtlas(
    atlas,
    batch.srcs as unknown as SkRect[],
    batch.dsts as unknown as SkRSXform[],
    kit.paints.spriteAdd,
    kit.blend.modulate,
    batch.cols as unknown as SkColor[],
  );
}

/** HP bars over energy and armored zeros, in the zero's own color, draining per hit. */
export function drawEnergyBars(canvas: SkCanvas, s: GameState, kit: Kit, sc: Scratch): void {
  const paint = kit.paints.fill;
  for (let i = 0; i < s.zeros.length; i++) {
    const z = s.zeros[i];
    if (!z || !z.alive || !z.energyBar || z.maxHp <= 0) continue;
    const pop = popScale(z);
    if (pop < 0.5) continue;
    const width = Math.max(BAR_MIN_WIDTH, z.rx * 2 * BAR_WIDTH) * pop;
    const x = z.x - width / 2;
    const y = z.y - z.ry * pop - BAR_GAP - BAR_HEIGHT;
    const alpha = clamp01(pop);
    paintColor(paint, sc, kit.colors.panel2, BAR_TRACK_ALPHA * alpha);
    canvas.drawRect(rect(sc, x, y, width, BAR_HEIGHT), paint);
    paintColor(paint, sc, kit.palette[z.color] ?? kit.colors.fg, alpha);
    canvas.drawRect(rect(sc, x, y, width * clamp01(z.hp / z.maxHp), BAR_HEIGHT), paint);
  }
}
