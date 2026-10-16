// One zero ring on a 2D canvas, as the app's ZeroRing and sprite bake draw it (the prototype's
// drawZero): a glowing oval band with a soft highlight, centered on (cx, cy). Armored rings get
// a thicker band, a metallic sheen and a dark inner edge.
import {
  ARMOR_EDGE_ALPHA,
  ARMOR_EDGE_WIDTH,
  ARMOR_SHEEN,
  ARMOR_SHEEN_STOPS,
  ARMOR_SHEEN_WIDTH,
  ARMOR_STROKE_SCALE,
  HIGHLIGHT_ALPHA,
  HIGHLIGHT_INSET,
  HIGHLIGHT_START,
  HIGHLIGHT_SWEEP,
  HIGHLIGHT_WIDTH,
  ZERO_GLOW,
} from '@/game/look';
import { ZERO_ASPECT, ZERO_STROKE } from '@/game/sim/sizing';
import { colors } from '@/theme/tokens';

const DEG = Math.PI / 180;

/**
 * Skia's solid blur at sigma σ draws the shape plus a glow; a canvas shadow does the same, and its
 * blur is twice the standard deviation.
 */
export const shadowBlurFor = (sigma: number) => sigma * 2;

export function drawRing(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  ry: number,
  color: string,
  opts: { armored?: boolean; glow?: boolean } = {},
): void {
  const { armored = false, glow = true } = opts;
  const lw = ry * ZERO_STROKE * (armored ? ARMOR_STROKE_SCALE : 1);
  const rx = ry * ZERO_ASPECT;
  const ox = Math.max(1, rx - lw / 2);
  const oy = Math.max(1, ry - lw / 2);

  ctx.save();
  ctx.lineWidth = lw;
  ctx.strokeStyle = color;
  if (glow) {
    ctx.shadowColor = color;
    ctx.shadowBlur = shadowBlurFor(ry * ZERO_GLOW);
  }
  ctx.beginPath();
  ctx.ellipse(cx, cy, ox, oy, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  if (armored) {
    ctx.save();
    const sheen = ctx.createLinearGradient(cx - ox, cy - oy, cx + ox, cy + oy);
    ARMOR_SHEEN.forEach((a, i) => sheen.addColorStop(ARMOR_SHEEN_STOPS[i] ?? 0, `rgba(255,255,255,${a})`));
    ctx.lineWidth = lw * ARMOR_SHEEN_WIDTH;
    ctx.strokeStyle = sheen;
    ctx.beginPath();
    ctx.ellipse(cx, cy, ox, oy, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = ARMOR_EDGE_ALPHA;
    ctx.lineWidth = Math.max(1, lw * ARMOR_EDGE_WIDTH);
    ctx.strokeStyle = colors.ink;
    ctx.beginPath();
    ctx.ellipse(cx, cy, Math.max(0.5, ox - lw / 2), Math.max(0.5, oy - lw / 2), 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  const hx = Math.max(1, rx - lw * HIGHLIGHT_INSET);
  const hy = Math.max(1, ry - lw * HIGHLIGHT_INSET);
  ctx.save();
  ctx.globalAlpha = HIGHLIGHT_ALPHA;
  ctx.lineWidth = Math.max(1, lw * HIGHLIGHT_WIDTH);
  ctx.lineCap = 'round';
  ctx.strokeStyle = colors.fg;
  ctx.beginPath();
  ctx.ellipse(cx, cy, hx, hy, 0, HIGHLIGHT_START * DEG, (HIGHLIGHT_START + HIGHLIGHT_SWEEP) * DEG);
  ctx.stroke();
  ctx.restore();
}

/** How far past the ring its glow reaches, in px, for sizing a canvas around it. */
export function ringReach(ry: number, glow = true): number {
  return glow ? ry * ZERO_GLOW * 3 + 2 : 2;
}
