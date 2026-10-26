'worklet';
// Orbit's turret (SPEC 9): the Shooter's barrel and muzzle flash, turning all round on a whole
// disc in the middle of the board, in the round's theme.
import type { SkCanvas } from '@shopify/react-native-skia';

import type { GameState } from '../../sim/types';

import { drawBarrel, TURRET_BASE_RADIUS, TURRET_BASE_STROKE } from '../turret';
import type { Kit, Scratch } from '../types';
import { paintColor } from '../util';

/** The middle's base is a whole disc, this share of the Shooter's base radius. */
const ORBIT_BASE_SCALE = 0.85;

/** The turret in the middle: its disc, then the barrel over it. */
export function drawOrbit(canvas: SkCanvas, s: GameState, kit: Kit, sc: Scratch): void {
  const { fill, stroke } = kit.paints;
  const r = TURRET_BASE_RADIUS * ORBIT_BASE_SCALE;
  paintColor(fill, sc, kit.colors.panel2, 1);
  canvas.drawCircle(s.muzzleX, s.muzzleY, r, fill);
  paintColor(stroke, sc, kit.colors.shot, 1);
  stroke.setStrokeWidth(TURRET_BASE_STROKE);
  canvas.drawCircle(s.muzzleX, s.muzzleY, r, stroke);
  drawBarrel(canvas, s, kit, sc);
}
