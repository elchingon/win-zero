// Built once per round: the website's version of the app's sprite bake (src/game/bake/kit.ts),
// on 2D canvases, from the same numbers (src/game/look.ts). It makes the sprite sheet (zero rings
// with their glow baked in, ×V badges, bullet streaks), tinted copies of the sprites the scene
// tints, the backdrop, and the paints the shared drawing code reuses every frame.
import type { FillPlan, ZeroGroup } from '@/engine';
import { TURRET_BASE_RADIUS } from '@/game/draw/scene';
import type { Kit, Rgba, Sprite, SpriteSheet } from '@/game/draw/types';
import {
  BADGE_EDGE,
  BADGE_EDGE_ALPHA,
  BADGE_FILL_ALPHA,
  BADGE_FONT,
  BADGE_HEIGHT,
  BADGE_PAD_X,
  BULLET_LOOKS,
  BULLET_TAIL_ALPHA,
  DOT_ALPHA,
  DOT_ORIGIN,
  DOT_SIZE,
  DOT_SPACING,
  FILL_GLOW_ALPHA,
  FILL_GLOW_RADIUS,
  fxDensity,
  FX_CONFETTI,
  FX_DOT,
  FX_RING,
  FX_RING_STROKE,
  GLOW_RADIUS,
  GLOW_REACH,
  GLOW_Y,
  GLYPH_GLOW,
  GLYPH_GLOW_MAX,
  GLYPH_MAX_PX,
  MEASURE_SIZE,
  OVERLAY_HEIGHT,
  OVERLAY_OUTLINE,
  OVERLAY_WIDTH,
  ringDensity,
  spriteRadius,
  SPRITE_PAD,
  TINT_BASE,
  ZERO_GLOW,
  type BulletLook,
} from '@/game/look';
import { armorBadges } from '@/game/sim/badges';
import { ARMOR_SIZE_SCALE, FG } from '@/game/sim/constants';
import { fillGrid } from '@/game/sim/fill';
import { ZERO_ASPECT } from '@/game/sim/sizing';
import { formatCount } from '@/lib/format';
import { colors, withAlpha, zeroPalette } from '@/theme/tokens';

import { drawRing, shadowBlurFor } from './ring';
import { rgbKey, WebPaint, type TintTable } from './skia/canvas';

/** The display font, as loaded by app.css (@fontsource/bungee). */
export const DISPLAY_FONT = 'Bungee';

export const fontCss = (size: number) => `${size}px ${DISPLAY_FONT}, sans-serif`;

/** A palette color as [r, g, b, a], each 0..1. */
export function rgba(hex: string, alpha = 1): Rgba {
  const n = Number.parseInt(hex.slice(1, 7), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, alpha];
}

function makeCanvas(width: number, height: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(width));
  c.height = Math.max(1, Math.ceil(height));
  return c;
}

function context(c: HTMLCanvasElement, readBack = false): CanvasRenderingContext2D {
  const ctx = c.getContext('2d', readBack ? { willReadFrequently: true } : undefined);
  if (!ctx) throw new Error('2D canvas unavailable');
  return ctx;
}

/** Ink bounds of `text`, relative to its baseline origin, as Skia's measureText gives them. */
function inkBounds(ctx: CanvasRenderingContext2D, text: string, size: number) {
  ctx.font = fontCss(size);
  const m = ctx.measureText(text);
  const left = m.actualBoundingBoxLeft;
  const ascent = m.actualBoundingBoxAscent;
  return { x: -left, y: -ascent, width: left + m.actualBoundingBoxRight, height: ascent + m.actualBoundingBoxDescent };
}

interface Cell {
  w: number;
  h: number;
  ry: number;
  draw: (ctx: CanvasRenderingContext2D, cx: number, cy: number) => void;
}

function ringCell(ry: number, color: string, armored: boolean): Cell {
  const reach = ry * ZERO_GLOW * GLOW_REACH + SPRITE_PAD;
  return {
    w: Math.ceil(2 * (ry * ZERO_ASPECT + reach)),
    h: Math.ceil(2 * (ry + reach)),
    ry,
    draw: (ctx, cx, cy) => drawRing(ctx, cx, cy, ry, color, { armored }),
  };
}

/** A bullet streak pointing right, its head on the cell's center. Drawn at `d` px per point. */
function bulletCell(look: BulletLook, d: number): Cell {
  const reach = (look.tail + look.width / 2) * d + SPRITE_PAD;
  return {
    w: Math.ceil(2 * reach),
    h: Math.ceil(2 * (Math.max(look.head, look.width / 2) * d + SPRITE_PAD)),
    ry: d,
    draw: (ctx, cx, cy) => {
      ctx.save();
      ctx.globalAlpha = BULLET_TAIL_ALPHA;
      ctx.strokeStyle = look.color;
      ctx.lineWidth = look.width * d;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx - look.tail * d, cy);
      ctx.lineTo(cx, cy);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = colors.fg;
      ctx.beginPath();
      ctx.arc(cx, cy, look.head * d, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    },
  };
}

/** The white effect shapes, drawn at `d` px per point: a square dot, a confetti strip, a fragment ring. */
function fxCells(d: number): [Cell, Cell, Cell] {
  const dot = FX_DOT * d;
  const conf = FX_CONFETTI * d;
  const ring = FX_RING * d;
  const ringStroke = ring * FX_RING_STROKE;
  return [
    {
      w: Math.ceil(dot + 2 * SPRITE_PAD),
      h: Math.ceil(dot + 2 * SPRITE_PAD),
      ry: dot,
      draw: (ctx, cx, cy) => {
        ctx.fillStyle = TINT_BASE;
        ctx.fillRect(cx - dot / 2, cy - dot / 2, dot, dot);
      },
    },
    {
      w: Math.ceil(conf + 2 * SPRITE_PAD),
      h: Math.ceil(conf / 2 + 2 * SPRITE_PAD),
      ry: conf,
      draw: (ctx, cx, cy) => {
        ctx.fillStyle = TINT_BASE;
        ctx.fillRect(cx - conf / 2, cy - conf / 4, conf, conf / 2);
      },
    },
    {
      w: Math.ceil(2 * (ring * ZERO_ASPECT + ringStroke / 2 + SPRITE_PAD)),
      h: Math.ceil(2 * (ring + ringStroke / 2 + SPRITE_PAD)),
      ry: ring,
      draw: (ctx, cx, cy) => {
        ctx.strokeStyle = TINT_BASE;
        ctx.lineWidth = ringStroke;
        ctx.beginPath();
        ctx.ellipse(cx, cy, ring * ZERO_ASPECT, ring, 0, 0, Math.PI * 2);
        ctx.stroke();
      },
    },
  ];
}

/** A ×V pill for armored zeros worth `value`, drawn at `d` px per point. */
function badgeCell(value: number, d: number, measure: CanvasRenderingContext2D): Cell {
  const size = BADGE_FONT * d;
  const label = `×${value}`;
  const bounds = inkBounds(measure, label, size);
  const h = BADGE_HEIGHT * d;
  const w = Math.max(h, bounds.width + 2 * BADGE_PAD_X * d);
  return {
    w: Math.ceil(w + 2 * SPRITE_PAD),
    h: Math.ceil(h + 2 * SPRITE_PAD),
    ry: d,
    draw: (ctx, cx, cy) => {
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(cx - w / 2, cy - h / 2, w, h, h / 2);
      ctx.globalAlpha = BADGE_FILL_ALPHA;
      ctx.fillStyle = colors.ink;
      ctx.fill();
      ctx.globalAlpha = BADGE_EDGE_ALPHA;
      ctx.lineWidth = BADGE_EDGE * d;
      ctx.strokeStyle = colors.fg;
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = colors.fg;
      ctx.font = fontCss(size);
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(label, cx - bounds.x - bounds.width / 2, cy - bounds.y - bounds.height / 2);
      ctx.restore();
    },
  };
}

/** The fill's Bungee "0", white so each glyph can be tinted, centered on its ink. ry is the font size in px. */
function glyphCell(sizePx: number, glow: boolean, measure: CanvasRenderingContext2D): Cell {
  const bounds = inkBounds(measure, '0', sizePx);
  const sigma = glow ? sizePx * GLYPH_GLOW : 0;
  const reach = sigma * GLOW_REACH + SPRITE_PAD;
  return {
    w: Math.ceil(bounds.width + 2 * reach),
    h: Math.ceil(bounds.height + 2 * reach),
    ry: sizePx,
    draw: (ctx, cx, cy) => {
      ctx.save();
      ctx.fillStyle = TINT_BASE;
      if (glow) {
        ctx.shadowColor = TINT_BASE;
        ctx.shadowBlur = shadowBlurFor(sigma);
      }
      ctx.font = fontCss(sizePx);
      ctx.textBaseline = 'alphabetic';
      ctx.fillText('0', cx - bounds.x - bounds.width / 2, cy - bounds.y - bounds.height / 2);
      ctx.restore();
    },
  };
}

/** Lay out rows of cells left to right, top to bottom, and draw them onto one sheet. */
function pack(rows: Cell[][]): { canvas: HTMLCanvasElement; sprites: Sprite[][] } {
  let width = 0;
  let height = 0;
  const sprites: Sprite[][] = [];
  const placed: { cell: Cell; sprite: Sprite }[] = [];
  for (const row of rows) {
    let x = 0;
    let rowHeight = 0;
    const out: Sprite[] = [];
    for (const cell of row) {
      const sprite = { x, y: height, width: cell.w, height: cell.h, ry: cell.ry };
      out.push(sprite);
      placed.push({ cell, sprite });
      x += cell.w;
      rowHeight = Math.max(rowHeight, cell.h);
    }
    sprites.push(out);
    width = Math.max(width, x);
    height += rowHeight;
  }
  const canvas = makeCanvas(width, height);
  const ctx = context(canvas);
  for (const { cell, sprite } of placed) cell.draw(ctx, sprite.x + sprite.width / 2, sprite.y + sprite.height / 2);
  return { canvas, sprites };
}

/**
 * Copies of `cell` multiplied by each color, as Skia's Modulate does to the plain sprite: every
 * pixel's color times the tint, alpha kept (the tint's alpha is applied when drawn).
 */
function tintCopies(cell: Cell, tints: readonly string[]): Map<number, CanvasImageSource> {
  const base = makeCanvas(cell.w, cell.h);
  const ctx = context(base, true);
  cell.draw(ctx, cell.w / 2, cell.h / 2);
  const src = ctx.getImageData(0, 0, base.width, base.height);
  const out = new Map<number, CanvasImageSource>();
  for (const hex of tints) {
    const [r = 1, g = 1, b = 1] = rgba(hex);
    const pixels = new ImageData(base.width, base.height);
    const s = src.data;
    const p = pixels.data;
    for (let i = 0; i < s.length; i += 4) {
      p[i] = (s[i] ?? 0) * r;
      p[i + 1] = (s[i + 1] ?? 0) * g;
      p[i + 2] = (s[i + 2] ?? 0) * b;
      p[i + 3] = s[i + 3] ?? 0;
    }
    const copy = makeCanvas(base.width, base.height);
    context(copy).putImageData(pixels, 0, 0);
    out.set(rgbKey(r, g, b), copy);
  }
  return out;
}

/** A cell kept only as tinted copies: the scene never draws it plain. */
function tintOnly(cell: Cell, tints: readonly string[], table: TintTable): Sprite {
  const sprite = { x: 0, y: 0, width: cell.w, height: cell.h, ry: cell.ry };
  table.set(sprite, tintCopies(cell, tints));
  return sprite;
}

function backdrop(width: number, height: number, density: number): HTMLCanvasElement {
  const canvas = makeCanvas(width * density, height * density);
  const ctx = context(canvas);
  ctx.scale(density, density);
  const glow = ctx.createRadialGradient(width / 2, height * GLOW_Y, 0, width / 2, height * GLOW_Y, Math.max(width, height) * GLOW_RADIUS);
  glow.addColorStop(0, colors.ink2);
  glow.addColorStop(1, colors.ink);
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);
  ctx.globalAlpha = DOT_ALPHA;
  ctx.fillStyle = colors.line;
  for (let y = DOT_ORIGIN.y; y < height; y += DOT_SPACING) {
    for (let x = DOT_ORIGIN.x; x < width; x += DOT_SPACING) ctx.fillRect(x - DOT_SIZE / 2, y - DOT_SIZE / 2, DOT_SIZE, DOT_SIZE);
  }
  return canvas;
}

/** The full number for a fill too big to draw, sized to fit, centered on (0, 0). */
function overlay(n: number, width: number, height: number, measure: CanvasRenderingContext2D): Kit['overlay'] {
  const label = formatCount(n);
  const measured = inkBounds(measure, label, MEASURE_SIZE).width || 1;
  const size = Math.min(height * OVERLAY_HEIGHT, (width * OVERLAY_WIDTH * MEASURE_SIZE) / measured);
  const bounds = inkBounds(measure, label, size);
  return { label, font: { css: fontCss(size), size }, x: -bounds.x - bounds.width / 2, y: -bounds.y - bounds.height / 2 };
}

export interface BakedRound {
  kit: Kit;
  /** The sprite sheet the scene's atlas draws come from. */
  atlas: HTMLCanvasElement;
  tints: TintTable;
}

/**
 * Everything a round of `n` zeros draws with, for a `width` × `height` point play area at
 * `pixelRatio`. `ctx` is the game canvas's context: gradients for the paints are made on it.
 * Bungee must be loaded first (badges, fill glyphs and the big number are Bungee).
 */
export function bakeRound(opts: {
  ctx: CanvasRenderingContext2D;
  n: number;
  groups: readonly ZeroGroup[];
  fill: FillPlan;
  width: number;
  height: number;
  pixelRatio: number;
}): BakedRound {
  const { ctx, n, groups, fill, width, height, pixelRatio } = opts;
  const measure = context(makeCanvas(1, 1));
  const objectCount = groups.reduce((sum, g) => sum + g.count, 0);
  const badgeValues = armorBadges(groups);
  const armoredRound = badgeValues.length > 0;
  const ryPt = spriteRadius(objectCount, width, height);
  const density = ringDensity(pixelRatio, ryPt * (armoredRound ? ARMOR_SIZE_SCALE : 1));
  const fxScale = fxDensity(pixelRatio);
  const glyphPt = fillGrid(fill.glyphs, width, height).size;

  const ringCells = zeroPalette.map((c) => ringCell(ryPt * density, c, false));
  const armoredCells = armoredRound ? zeroPalette.map((c) => ringCell(ryPt * ARMOR_SIZE_SCALE * density, c, true)) : [];
  const { canvas: atlas, sprites } = pack([
    ringCells,
    armoredCells,
    badgeValues.map((v) => badgeCell(v, fxScale, measure)),
    BULLET_LOOKS.map((look) => bulletCell(look, fxScale)),
  ]);
  const [zero = [], armored = [], badges = [], bullets = []] = sprites;

  // Hit flashes tint the fg ring with fg; particles and fill glyphs take any palette color.
  const tints: TintTable = new Map();
  const fgRing = zero[FG];
  const fgRingCell = ringCells[FG];
  if (fgRing && fgRingCell) tints.set(fgRing, tintCopies(fgRingCell, [colors.fg]));
  const fgArmored = armored[FG];
  const fgArmoredCell = armoredCells[FG];
  if (fgArmored && fgArmoredCell) tints.set(fgArmored, tintCopies(fgArmoredCell, [colors.fg]));
  const [dotCell, confettiCell, ringFxCell] = fxCells(fxScale);
  const fx = {
    dot: tintOnly(dotCell, zeroPalette, tints),
    confetti: tintOnly(confettiCell, zeroPalette, tints),
    ring: tintOnly(ringFxCell, zeroPalette, tints),
  };
  const glyph = tintOnly(glyphCell(Math.min(glyphPt * fxScale, GLYPH_MAX_PX), fill.glyphs <= GLYPH_GLOW_MAX, measure), zeroPalette, tints);

  const sheet: SpriteSheet = { width: atlas.width, height: atlas.height, zero, armored, badges, bullets, glyph, fx };
  const big = fill.overlayNumber ? overlay(n, width, height, measure) : null;
  const turretBase = new Path2D();
  turretBase.arc(0, 0, TURRET_BASE_RADIUS, Math.PI, Math.PI * 2);
  turretBase.closePath();
  const fillGlow = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, Math.max(width, height) * FILL_GLOW_RADIUS);
  fillGlow.addColorStop(0, withAlpha(colors.amber, FILL_GLOW_ALPHA));
  fillGlow.addColorStop(1, withAlpha(colors.flare, 0));

  const kit: Kit = {
    width,
    height,
    bounds: { x: 0, y: 0, width, height },
    sheet,
    background: { image: backdrop(width, height, pixelRatio), width, height },
    turretBase,
    paints: {
      sprite: new WebPaint(),
      fill: new WebPaint(),
      stroke: new WebPaint({ style: 'stroke' }),
      glowFill: new WebPaint({ additive: true }),
      spriteAdd: new WebPaint({ additive: true }),
      glowStroke: new WebPaint({ style: 'stroke', additive: true, cap: 'round' }),
      fillGlow: new WebPaint({ shader: fillGlow }),
      overlayStroke: new WebPaint({
        style: 'stroke',
        color: rgba(colors.ink),
        strokeWidth: (big?.font.size ?? 0) * OVERLAY_OUTLINE,
        join: 'round',
      }),
      overlayFill: new WebPaint({ color: rgba(colors.amber) }),
    },
    overlay: big,
    blend: { modulate: 0 },
    palette: zeroPalette.map((c) => rgba(c)),
    colors: { fg: rgba(colors.fg), amber: rgba(colors.amber), teal: rgba(colors.teal), panel2: rgba(colors.panel2) },
  };
  return { kit, atlas, tints };
}
