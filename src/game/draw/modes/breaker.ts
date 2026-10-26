'worklet';
// Breaker's paddle and balls (SPEC 9): a pill under the board's bottom edge with its top in the
// shot color (and the Laser Paddle's two emitters), and each ball as a soft additive halo
// around a bright core: the Fireball in the palette's danger color, the Lightning Ball in the
// chain color, the Mega Ball bigger. Rects and circles only, in the round's theme.
import type { SkCanvas } from '@shopify/react-native-skia';

import { FLARE } from '../../sim/constants';
import type { BreakerState, GameState } from '../../sim/types';

import type { Kit, Rgba, Scratch } from '../types';
import { paintColor, rect } from '../util';

/** The paddle: its height below the rim, and its top's highlight. */
const PADDLE_HEIGHT = 12;
const PADDLE_TOP = 3;
/** The Laser Paddle's emitters: their size, and how far in from the paddle's ends. */
const EMITTER = { width: 6, height: 6, inset: 0.75 };
/** A ball's halo, as a multiple of its radius, and how strong. */
const BALL_HALO = 2.2;
const BALL_HALO_ALPHA = 0.35;

function ballColor(bs: BreakerState, kit: Kit): Rgba {
  if (bs.look === 'fire') return kit.palette[FLARE] ?? kit.colors.shot;
  if (bs.look === 'lightning') return kit.colors.chain;
  return kit.colors.shot;
}

function drawPaddle(canvas: SkCanvas, s: GameState, bs: BreakerState, kit: Kit, sc: Scratch): void {
  const { fill } = kit.paints;
  const end = PADDLE_HEIGHT / 2;
  const left = bs.paddleX - bs.half;
  const top = s.bottom;
  paintColor(fill, sc, kit.colors.fg, 1);
  canvas.drawRect(rect(sc, left + end, top, bs.half * 2 - PADDLE_HEIGHT, PADDLE_HEIGHT), fill);
  canvas.drawCircle(left + end, top + end, end, fill);
  canvas.drawCircle(left + bs.half * 2 - end, top + end, end, fill);
  paintColor(fill, sc, kit.colors.shot, 1);
  canvas.drawRect(rect(sc, left + end, top, bs.half * 2 - PADDLE_HEIGHT, PADDLE_TOP), fill);
  if (bs.laser) {
    for (let side = -1; side <= 1; side += 2) {
      const x = bs.paddleX + side * bs.half * EMITTER.inset;
      canvas.drawRect(rect(sc, x - EMITTER.width / 2, top - EMITTER.height, EMITTER.width, EMITTER.height), fill);
    }
  }
}

/** The paddle and every ball in play. */
export function drawBreaker(canvas: SkCanvas, s: GameState, kit: Kit, sc: Scratch): void {
  const bs = s.modeState;
  if (bs.mode !== 'breaker') return;
  drawPaddle(canvas, s, bs, kit, sc);
  const color = ballColor(bs, kit);
  const { fill, glowFill } = kit.paints;
  for (let k = 0; k < bs.ball.length; k++) {
    const b = bs.ball[k];
    if (!b || !b.live) continue;
    paintColor(glowFill, sc, color, BALL_HALO_ALPHA);
    canvas.drawCircle(b.x, b.y, bs.radius * BALL_HALO, glowFill);
    paintColor(fill, sc, kit.colors.fg, 1);
    canvas.drawCircle(b.x, b.y, bs.radius, fill);
  }
}
