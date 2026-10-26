'worklet';
// Slice's blade (SPEC 9): the finger's recent path, drawn additively in the round's shot color
// with a bright core, thinning and fading as it ages; the Twin Blade's two edges either side of
// the stroke; the Lingering Blade's trail lasting longer. Lines only, from the stand-in canvas.
import type { SkCanvas } from '@shopify/react-native-skia';

import { SLICE_TRAIL_LIFE, SLICE_TWIN_GAP } from '../../sim/modes/slice';
import type { GameState, SliceState } from '../../sim/types';

import type { Kit, Rgba, Scratch } from '../types';
import { paintColor } from '../util';

/** The trail at its freshest: a soft glow, the blade, and a bright core (widths in points). */
const TRAIL_GLOW = { width: 16, alpha: 0.3 };
const TRAIL_BLADE = { width: 6, alpha: 0.9 };
const TRAIL_CORE = { width: 2, alpha: 1 };

/** One pass over every fresh segment of the trail, `offset` points to the side of the stroke. */
function pass(
  canvas: SkCanvas,
  ss: SliceState,
  kit: Kit,
  sc: Scratch,
  color: Rgba,
  look: { width: number; alpha: number },
  offset: number,
): void {
  const paint = kit.paints.glowStroke;
  const life = Math.max(SLICE_TRAIL_LIFE, ss.linger);
  const n = ss.trail.length;
  for (let k = 0; k + 1 < ss.count; k++) {
    const a = ss.trail[(ss.head - k - 1 + n) % n];
    const b = ss.trail[(ss.head - k + n) % n];
    if (!a || !b || a.stroke !== b.stroke) continue;
    const fade = 1 - b.age / life;
    if (fade <= 0) continue;
    let ox = 0;
    let oy = 0;
    if (offset !== 0) {
      const len = Math.sqrt((b.x - a.x) * (b.x - a.x) + (b.y - a.y) * (b.y - a.y)) || 1;
      ox = (-(b.y - a.y) / len) * offset;
      oy = ((b.x - a.x) / len) * offset;
    }
    paintColor(paint, sc, color, look.alpha * fade);
    paint.setStrokeWidth(look.width * fade);
    canvas.drawLine(a.x + ox, a.y + oy, b.x + ox, b.y + oy, paint);
  }
}

/** The blade: glow, blade and core, once, or twice side by side for the Twin Blade. */
export function drawSlice(canvas: SkCanvas, s: GameState, kit: Kit, sc: Scratch): void {
  const ss = s.modeState;
  if (ss.mode !== 'slice' || ss.count < 2) return;
  const edges = ss.blades > 1 ? 2 : 1;
  for (let e = 0; e < edges; e++) {
    const offset = edges > 1 ? (e === 0 ? -1 : 1) * (SLICE_TWIN_GAP / 2) : 0;
    pass(canvas, ss, kit, sc, kit.colors.shot, TRAIL_GLOW, offset);
    pass(canvas, ss, kit, sc, kit.colors.shot, TRAIL_BLADE, offset);
    pass(canvas, ss, kit, sc, kit.colors.fg, TRAIL_CORE, offset);
  }
}
