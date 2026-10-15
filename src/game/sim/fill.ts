'worklet';
// The celebration fill: the screen fills with the round's zeros in a grid that rippled out from
// the middle (the prototype's layoutFill), with sparkles rising off them. Laid out once when the
// round is built, so the fill itself allocates nothing.
import {
  FILL_POP,
  FILL_SPARKLE,
  FILL_SPARKLE_CAP,
  FILL_SPARKLE_CHANCE,
  FILL_SPREAD_MAX,
  FILL_SPREAD_PER_GLYPH,
  GLYPH_ASPECT,
  GLYPH_CELL_FILL,
  PALETTE_SIZE,
} from './constants';
import { particle } from './effects';
import { random, spread } from './rng';
import type { GameState } from './types';

export interface FillGrid {
  cols: number;
  rows: number;
  /** Glyph height, in points. */
  size: number;
}

/** The grid that fits `count` glyphs biggest on a `width` × `height` screen. */
export function fillGrid(count: number, width: number, height: number): FillGrid {
  const best = { cols: 1, rows: Math.max(1, count), size: 0 };
  for (let cols = 1; cols <= count; cols++) {
    const rows = Math.ceil(count / cols);
    const size = Math.min((height / rows) * GLYPH_CELL_FILL, width / cols / GLYPH_ASPECT);
    if (size > best.size) {
      best.cols = cols;
      best.rows = rows;
      best.size = size;
    }
    if (rows === 1) break;
  }
  return best;
}

/** Seconds the fill's ripple takes to reach its last glyph. */
export function fillSpread(count: number): number {
  return Math.min(FILL_SPREAD_MAX, FILL_SPREAD_PER_GLYPH * count);
}

/** Place every fill glyph: rows centered, each popping in later the farther it is from the middle. */
export function layoutFill(s: GameState): void {
  const count = s.glyphCount;
  if (count <= 0) return;
  const { cols, rows, size } = fillGrid(count, s.width, s.height);
  const cw = s.width / cols;
  const ch = s.height / rows;
  const maxD = Math.hypot(s.width / 2, s.height / 2) || 1;
  const ripple = fillSpread(count);
  for (let i = 0; i < count; i++) {
    const g = s.glyphs[i];
    if (!g) continue;
    const r = Math.floor(i / cols);
    const inRow = r === rows - 1 ? count - r * cols : cols;
    const c = i - r * cols;
    g.x = (s.width - inRow * cw) / 2 + cw * (c + 0.5);
    g.y = ch * (r + 0.5);
    g.color = i % PALETTE_SIZE;
    g.delay = (Math.hypot(g.x - s.width / 2, g.y - s.height / 2) / maxD) * ripple;
  }
  s.glyphSize = size;
  s.fillLen = ripple + FILL_POP;
}

/** Sparkles rising off glyphs that have landed. None under reduce motion. */
export function updateFill(s: GameState, dt: number): void {
  if (s.reduceMotion || s.glyphCount === 0) return;
  if (s.particles.count >= FILL_SPARKLE_CAP || random(s.rng) >= FILL_SPARKLE_CHANCE * dt * 60) return;
  const g = s.glyphs[Math.floor(random(s.rng) * s.glyphCount)];
  if (!g || s.phaseT < g.delay) return;
  const size = s.glyphSize;
  const p = particle(
    s,
    'dot',
    g.x + spread(s.rng, (size * FILL_SPARKLE.spreadX) / 2),
    g.y + spread(s.rng, (size * FILL_SPARKLE.spreadY) / 2),
    g.color,
  );
  if (!p) return;
  p.vx = spread(s.rng, FILL_SPARKLE.drift);
  p.vy = -FILL_SPARKLE.riseMin - random(s.rng) * FILL_SPARKLE.riseRange;
  p.max = FILL_SPARKLE.life;
  p.size = FILL_SPARKLE.sizeMin + random(s.rng) * FILL_SPARKLE.sizeRange;
}
