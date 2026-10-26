'worklet';
// The turret: a fg barrel with a tip in the shot color, pivoting on the muzzle point, its muzzle
// flash, and its base. The Shooter's sits at the bottom on a half disc; Orbit's in the middle on
// a whole one. A leaf file, so the modes' drawing can share it without importing scene.ts.
import type { SkCanvas } from '@shopify/react-native-skia';

import type { GameState } from '../sim/types';

import type { Kit, Scratch } from './types';
import { paintColor, rect } from './util';

/** The barrel: its width and length, and how far out from the pivot it starts. */
const BARREL_WIDTH = 14;
const BARREL_LENGTH = 36;
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
const RAD_TO_DEG = 180 / Math.PI;

/** The barrel and its muzzle flash, turned to the aim. */
export function drawBarrel(canvas: SkCanvas, s: GameState, kit: Kit, sc: Scratch): void {
  const { fill, glowFill } = kit.paints;
  canvas.save();
  canvas.translate(s.muzzleX, s.muzzleY);
  canvas.rotate((s.aim + Math.PI / 2) * RAD_TO_DEG, 0, 0);
  paintColor(fill, sc, kit.colors.fg, 1);
  canvas.drawRect(rect(sc, -BARREL_WIDTH / 2, -BARREL_REACH, BARREL_WIDTH, BARREL_LENGTH), fill);
  paintColor(fill, sc, kit.colors.shot, 1);
  canvas.drawRect(rect(sc, -BARREL_WIDTH / 2, -BARREL_REACH, BARREL_WIDTH, BARREL_TIP), fill);
  if (s.muzzle > MUZZLE_FLASH_MIN) {
    paintColor(glowFill, sc, kit.colors.shot, s.muzzle);
    canvas.drawCircle(0, -MUZZLE_FLASH_AT, MUZZLE_FLASH_GROW * s.muzzle + MUZZLE_FLASH_BASE, glowFill);
  }
  canvas.restore();
}

/** The Shooter's turret: the barrel over a half-disc base at the bottom of the board. */
export function drawTurret(canvas: SkCanvas, s: GameState, kit: Kit, sc: Scratch): void {
  const { fill, stroke } = kit.paints;
  drawBarrel(canvas, s, kit, sc);
  canvas.save();
  canvas.translate(s.muzzleX, s.muzzleY + TURRET_BASE_DROP);
  paintColor(fill, sc, kit.colors.panel2, 1);
  canvas.drawPath(kit.turretBase, fill);
  paintColor(stroke, sc, kit.colors.shot, 1);
  stroke.setStrokeWidth(TURRET_BASE_STROKE);
  canvas.drawPath(kit.turretBase, stroke);
  canvas.restore();
}
