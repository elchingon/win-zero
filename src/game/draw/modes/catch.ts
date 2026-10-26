'worklet';
// Catch's cups (SPEC 9): a U under the board's bottom edge for each cup, its rims in the shot
// color, and what the power-up pulls with: the Magnet's faint field, the Vacuum Beam's column
// while the finger is down, the Black Hole's rings closing in. Drawn with the stand-in canvas's
// rects, circles and lines only, in the round's theme.
import type { SkCanvas } from '@shopify/react-native-skia';

import { cupMid, MAGNET_REACH } from '../../sim/modes/catch';
import type { CatchState, GameState } from '../../sim/types';

import type { Kit, Scratch } from '../types';
import { paintColor, rect } from '../util';

/** A cup: how deep it hangs below the rim, its walls' and base's thickness, and the rim's height. */
const CUP_DEPTH = 26;
const CUP_WALL = 5;
const CUP_RIM = 4;
/** The soft glow inside a cup. */
const CUP_GLOW_ALPHA = 0.14;
/** The Magnet's field: a faint ring at its reach, breathing in size. */
const MAGNET_ALPHA = 0.16;
const MAGNET_WIDTH = 2;
const MAGNET_BREATHE = { speed: 3, amount: 0.04 };
/** The Vacuum Beam's column: a soft fill and its two edges. */
const VACUUM_ALPHA = 0.1;
const VACUUM_EDGE_ALPHA = 0.35;
const VACUUM_EDGE_WIDTH = 2;
/** The Black Hole: rings closing in on the cup, RINGS at a time, each taking PERIOD seconds from REACH × the board's width. */
const HOLE_RINGS = 3;
const HOLE_PERIOD = 1.2;
const HOLE_REACH = 0.45;
const HOLE_ALPHA = 0.3;
const HOLE_WIDTH = 2;

function drawCup(canvas: SkCanvas, s: GameState, cs: CatchState, kit: Kit, sc: Scratch, k: number): void {
  const { fill, glowFill } = kit.paints;
  const mid = cupMid(cs, k);
  const left = mid - cs.half;
  const width = cs.half * 2;
  const top = s.bottom;
  paintColor(glowFill, sc, kit.colors.shot, CUP_GLOW_ALPHA);
  canvas.drawRect(rect(sc, left, top, width, CUP_DEPTH), glowFill);
  paintColor(fill, sc, kit.colors.fg, 1);
  canvas.drawRect(rect(sc, left, top, CUP_WALL, CUP_DEPTH), fill);
  canvas.drawRect(rect(sc, left + width - CUP_WALL, top, CUP_WALL, CUP_DEPTH), fill);
  canvas.drawRect(rect(sc, left, top + CUP_DEPTH - CUP_WALL, width, CUP_WALL), fill);
  paintColor(fill, sc, kit.colors.shot, 1);
  canvas.drawRect(rect(sc, left, top, CUP_WALL, CUP_RIM), fill);
  canvas.drawRect(rect(sc, left + width - CUP_WALL, top, CUP_WALL, CUP_RIM), fill);
}

/** What draws zeros in, behind the cups. */
function drawPull(canvas: SkCanvas, s: GameState, cs: CatchState, kit: Kit, sc: Scratch): void {
  const paint = kit.paints.glowStroke;
  const mid = cupMid(cs, 0);
  if (cs.pull === 'magnet') {
    const breathe = s.reduceMotion ? 1 : 1 + Math.sin(s.time * MAGNET_BREATHE.speed) * MAGNET_BREATHE.amount;
    paintColor(paint, sc, kit.colors.chain, MAGNET_ALPHA);
    paint.setStrokeWidth(MAGNET_WIDTH);
    canvas.drawCircle(mid, s.bottom, MAGNET_REACH * s.width * breathe, paint);
  } else if (cs.pull === 'vacuum' && cs.pulling) {
    paintColor(kit.paints.glowFill, sc, kit.colors.shot, VACUUM_ALPHA);
    canvas.drawRect(rect(sc, mid - cs.half, s.top, cs.half * 2, s.bottom - s.top), kit.paints.glowFill);
    paintColor(paint, sc, kit.colors.shot, VACUUM_EDGE_ALPHA);
    paint.setStrokeWidth(VACUUM_EDGE_WIDTH);
    canvas.drawLine(mid - cs.half, s.top, mid - cs.half, s.bottom, paint);
    canvas.drawLine(mid + cs.half, s.top, mid + cs.half, s.bottom, paint);
  } else if (cs.pull === 'hole') {
    paint.setStrokeWidth(HOLE_WIDTH);
    const reach = HOLE_REACH * s.width;
    for (let r = 0; r < HOLE_RINGS; r++) {
      // Each ring shrinks toward the cup and fades in as it goes; still under Reduce Motion.
      const t = s.reduceMotion ? (r + 1) / (HOLE_RINGS + 1) : 1 - ((s.time / HOLE_PERIOD + r / HOLE_RINGS) % 1);
      paintColor(paint, sc, kit.colors.chain, HOLE_ALPHA * (1 - t));
      canvas.drawCircle(mid, s.bottom, cs.half + t * reach, paint);
    }
  }
}

/** The cups, and their power-up's pull. */
export function drawCatch(canvas: SkCanvas, s: GameState, kit: Kit, sc: Scratch): void {
  const cs = s.modeState;
  if (cs.mode !== 'catch') return;
  drawPull(canvas, s, cs, kit, sc);
  for (let k = 0; k < cs.cups; k++) drawCup(canvas, s, cs, kit, sc, k);
}
