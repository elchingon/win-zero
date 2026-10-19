'worklet';
// Drawing one frame of the round, as in the prototype's draw(). Sprites come from the baked
// sheet a whole layer per drawAtlas call; nothing here allocates Skia objects.
import type { SkCanvas, SkImage, SkRect } from '@shopify/react-native-skia';

import { MAX_BULLETS, MAX_GLYPHS, MAX_PARTICLES } from '../sim/constants';
import type { GameState } from '../sim/types';

import { makeBatch } from './batch';
import { drawFill } from './fill';
import { drawBeams, drawBolts, drawBullets, drawParticles, drawRings } from './fx';
import type { Kit, Scratch } from './types';
import { paintColor, rect } from './util';
import { drawEnergyBars, drawHitFlashes, drawZeros } from './zeros';

/** The turret's barrel: a fg bar with an amber tip, pivoting on the muzzle point. */
const BARREL_WIDTH = 14;
const BARREL_LENGTH = 36;
/** The barrel starts this far out from the pivot. */
const BARREL_REACH = 40;
const BARREL_TIP = 6;
/** Muzzle flash: a circle this far out, radius MUZZLE_FLASH_BASE + MUZZLE_FLASH_GROW × flash. */
const MUZZLE_FLASH_AT = 46;
const MUZZLE_FLASH_BASE = 4;
const MUZZLE_FLASH_GROW = 12;
const MUZZLE_FLASH_MIN = 0.05;
/** The base's center sits this far below the pivot. */
export const TURRET_BASE_DROP = 14;
export const TURRET_BASE_RADIUS = 32;
export const TURRET_BASE_STROKE = 3;
/** The white flash never fully whites out the screen. */
const FLASH_MAX = 0.85;
const FLASH_MIN = 0.02;
/** Most zeros a round can have on screen (engine OBJECT_CAP), with room to spare, and their badges. */
const ZERO_BATCH = 64;
const RAD_TO_DEG = 180 / Math.PI;

export function makeScratch(): Scratch {
  return {
    zeros: makeBatch(ZERO_BATCH * 2),
    flashes: makeBatch(ZERO_BATCH, true),
    glyphs: makeBatch(MAX_GLYPHS, true),
    bullets: makeBatch(MAX_BULLETS),
    particles: makeBatch(MAX_PARTICLES, true),
    rect: { x: 0, y: 0, width: 0, height: 0 } as SkRect,
    rgba: [0, 0, 0, 1],
    meter: { t: 0, frames: 0, worst: 0 },
  };
}

function drawTurret(canvas: SkCanvas, s: GameState, kit: Kit, sc: Scratch): void {
  const { fill, stroke, glowFill } = kit.paints;
  canvas.save();
  canvas.translate(s.muzzleX, s.muzzleY);
  canvas.rotate((s.aim + Math.PI / 2) * RAD_TO_DEG, 0, 0);
  paintColor(fill, sc, kit.colors.fg, 1);
  canvas.drawRect(rect(sc, -BARREL_WIDTH / 2, -BARREL_REACH, BARREL_WIDTH, BARREL_LENGTH), fill);
  paintColor(fill, sc, kit.colors.amber, 1);
  canvas.drawRect(rect(sc, -BARREL_WIDTH / 2, -BARREL_REACH, BARREL_WIDTH, BARREL_TIP), fill);
  if (s.muzzle > MUZZLE_FLASH_MIN) {
    paintColor(glowFill, sc, kit.colors.amber, s.muzzle);
    canvas.drawCircle(0, -MUZZLE_FLASH_AT, MUZZLE_FLASH_GROW * s.muzzle + MUZZLE_FLASH_BASE, glowFill);
  }
  canvas.restore();

  canvas.save();
  canvas.translate(s.muzzleX, s.muzzleY + TURRET_BASE_DROP);
  paintColor(fill, sc, kit.colors.panel2, 1);
  canvas.drawPath(kit.turretBase, fill);
  paintColor(stroke, sc, kit.colors.amber, 1);
  stroke.setStrokeWidth(TURRET_BASE_STROKE);
  canvas.drawPath(kit.turretBase, stroke);
  canvas.restore();
}

/** Draw the round as it stands. `atlas` is null until the sprite sheet reaches the GPU. */
export function drawScene(canvas: SkCanvas, s: GameState, kit: Kit, atlas: SkImage | null, sc: Scratch): void {
  canvas.drawPicture(kit.background);
  canvas.save();
  canvas.translate(s.shakeX, s.shakeY);
  if (s.phase === 'fill' || s.phase === 'done') {
    drawFill(canvas, s, kit, atlas, sc);
  } else if (atlas) {
    drawZeros(canvas, s, kit, atlas, sc);
    drawHitFlashes(canvas, s, kit, atlas, sc);
  }
  drawEnergyBars(canvas, s, kit, sc);
  drawBeams(canvas, s, kit, sc);
  drawBolts(canvas, s, kit, sc);
  if (atlas) drawBullets(canvas, s, kit, atlas, sc);
  drawRings(canvas, s, kit, sc);
  if (atlas) drawParticles(canvas, s, kit, atlas, sc);
  if (s.phase === 'play' || s.phase === 'celebrate') {
    // What the player plays with, by mode.
    switch (s.mode) {
      case 'shooter':
      default:
        drawTurret(canvas, s, kit, sc);
    }
  }
  canvas.restore();
  if (s.flash > FLASH_MIN) {
    paintColor(kit.paints.fill, sc, kit.colors.fg, Math.min(FLASH_MAX, s.flash * FLASH_MAX));
    canvas.drawRect(rect(sc, 0, 0, kit.width, kit.height), kit.paints.fill);
  }
}
