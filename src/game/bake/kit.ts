// Built once per round on the JS thread: the sprite sheet (zero rings with their glow baked in,
// so the frame loop never blurs), the backdrop, and the paints the scene reuses every frame.
import {
  BlendMode,
  BlurStyle,
  createPicture,
  PaintStyle,
  PointMode,
  Skia,
  StrokeCap,
  StrokeJoin,
  TileMode,
  vec,
  type SkCanvas,
  type SkFont,
  type SkPaint,
  type SkPicture,
} from '@shopify/react-native-skia';
import { PixelRatio } from 'react-native';

import type { FillPlan, ZeroGroup } from '@/engine';
import { formatCount } from '@/lib/format';
import { colors, withAlpha, zeroPalette } from '@/theme/tokens';

import { TURRET_BASE_RADIUS } from '../draw/scene';
import type { Kit, Rgba, Sprite, SpriteSheet } from '../draw/types';
import {
  ARMOR_EDGE_ALPHA,
  ARMOR_EDGE_WIDTH,
  ARMOR_SHEEN,
  ARMOR_SHEEN_STOPS,
  ARMOR_SHEEN_WIDTH,
  ARMOR_STROKE_SCALE,
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
  HIGHLIGHT_ALPHA,
  HIGHLIGHT_WIDTH,
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
} from '../look';
import { armorBadges } from '../sim/badges';
import { ARMOR_SIZE_SCALE } from '../sim/constants';
import { fillGrid } from '../sim/fill';
import { ZERO_ASPECT, ZERO_STROKE } from '../sim/sizing';
import { highlightPath } from '../ZeroRing';

export function rgba(hex: string, alpha = 1): Rgba {
  const c = Skia.Color(hex);
  return [c[0] ?? 0, c[1] ?? 0, c[2] ?? 0, (c[3] ?? 1) * alpha];
}

function paint(style: PaintStyle, setup?: (p: SkPaint) => void): SkPaint {
  const p = Skia.Paint();
  p.setAntiAlias(true);
  p.setStyle(style);
  setup?.(p);
  return p;
}

/** One zero ring centered on (cx, cy), matching ZeroRing (and the prototype's drawZero). */
function drawRing(canvas: SkCanvas, cx: number, cy: number, ry: number, color: string, armored: boolean): void {
  const lw = ry * ZERO_STROKE * (armored ? ARMOR_STROKE_SCALE : 1);
  const rx = ry * ZERO_ASPECT;
  const ox = Math.max(1, rx - lw / 2);
  const oy = Math.max(1, ry - lw / 2);
  const oval = Skia.XYWHRect(cx - ox, cy - oy, ox * 2, oy * 2);

  canvas.drawOval(
    oval,
    paint(PaintStyle.Stroke, (p) => {
      p.setStrokeWidth(lw);
      p.setColor(Skia.Color(color));
      p.setMaskFilter(Skia.MaskFilter.MakeBlur(BlurStyle.Solid, ry * ZERO_GLOW, false));
    }),
  );

  if (armored) {
    const sheen = Skia.Shader.MakeLinearGradient(
      vec(cx - ox, cy - oy),
      vec(cx + ox, cy + oy),
      ARMOR_SHEEN.map((a) => Skia.Color(`rgba(255,255,255,${a})`)),
      ARMOR_SHEEN_STOPS,
      TileMode.Clamp,
    );
    canvas.drawOval(
      oval,
      paint(PaintStyle.Stroke, (p) => {
        p.setStrokeWidth(lw * ARMOR_SHEEN_WIDTH);
        p.setShader(sheen);
      }),
    );
    const inner = Skia.XYWHRect(cx - ox + lw / 2, cy - oy + lw / 2, (ox - lw / 2) * 2, (oy - lw / 2) * 2);
    canvas.drawOval(
      inner,
      paint(PaintStyle.Stroke, (p) => {
        p.setStrokeWidth(Math.max(1, lw * ARMOR_EDGE_WIDTH));
        p.setColor(Skia.Color(colors.ink));
        p.setAlphaf(ARMOR_EDGE_ALPHA);
      }),
    );
  }

  canvas.save();
  canvas.translate(cx, cy);
  canvas.drawPath(
    highlightPath(rx, ry, lw),
    paint(PaintStyle.Stroke, (p) => {
      p.setStrokeWidth(Math.max(1, lw * HIGHLIGHT_WIDTH));
      p.setStrokeCap(StrokeCap.Round);
      p.setColor(Skia.Color(colors.fg));
      p.setAlphaf(HIGHLIGHT_ALPHA);
    }),
  );
  canvas.restore();
}

interface Cell {
  w: number;
  h: number;
  ry: number;
  draw: (canvas: SkCanvas, cx: number, cy: number) => void;
}

function ringCell(ry: number, color: string, armored: boolean): Cell {
  const reach = ry * ZERO_GLOW * GLOW_REACH + SPRITE_PAD;
  return {
    w: Math.ceil(2 * (ry * ZERO_ASPECT + reach)),
    h: Math.ceil(2 * (ry + reach)),
    ry,
    draw: (canvas, cx, cy) => drawRing(canvas, cx, cy, ry, color, armored),
  };
}

/** A bullet streak pointing right, its head on the cell's center. Drawn at `d` px per point. */
function bulletCell(look: BulletLook, d: number): Cell {
  const reach = (look.tail + look.width / 2) * d + SPRITE_PAD;
  return {
    w: Math.ceil(2 * reach),
    h: Math.ceil(2 * (Math.max(look.head, look.width / 2) * d + SPRITE_PAD)),
    ry: d,
    draw: (canvas, cx, cy) => {
      canvas.drawLine(
        cx - look.tail * d,
        cy,
        cx,
        cy,
        paint(PaintStyle.Stroke, (p) => {
          p.setStrokeWidth(look.width * d);
          p.setStrokeCap(StrokeCap.Round);
          p.setColor(Skia.Color(look.color));
          p.setAlphaf(BULLET_TAIL_ALPHA);
        }),
      );
      canvas.drawCircle(cx, cy, look.head * d, paint(PaintStyle.Fill, (p) => p.setColor(Skia.Color(colors.fg))));
    },
  };
}

function white(style: PaintStyle, setup?: (p: SkPaint) => void): SkPaint {
  return paint(style, (p) => {
    p.setColor(Skia.Color(TINT_BASE));
    setup?.(p);
  });
}

/** The effect shapes, drawn at `d` px per point. Each sprite's ry is its reference size in px. */
function fxCells(d: number): Cell[] {
  const dot = FX_DOT * d;
  const conf = FX_CONFETTI * d;
  const ring = FX_RING * d;
  const ringStroke = ring * FX_RING_STROKE;
  return [
    {
      w: Math.ceil(dot + 2 * SPRITE_PAD),
      h: Math.ceil(dot + 2 * SPRITE_PAD),
      ry: dot,
      draw: (canvas, cx, cy) => canvas.drawRect(Skia.XYWHRect(cx - dot / 2, cy - dot / 2, dot, dot), white(PaintStyle.Fill)),
    },
    {
      w: Math.ceil(conf + 2 * SPRITE_PAD),
      h: Math.ceil(conf / 2 + 2 * SPRITE_PAD),
      ry: conf,
      draw: (canvas, cx, cy) =>
        canvas.drawRect(Skia.XYWHRect(cx - conf / 2, cy - conf / 4, conf, conf / 2), white(PaintStyle.Fill)),
    },
    {
      w: Math.ceil(2 * (ring * ZERO_ASPECT + ringStroke / 2 + SPRITE_PAD)),
      h: Math.ceil(2 * (ring + ringStroke / 2 + SPRITE_PAD)),
      ry: ring,
      draw: (canvas, cx, cy) =>
        canvas.drawOval(
          Skia.XYWHRect(cx - ring * ZERO_ASPECT, cy - ring, 2 * ring * ZERO_ASPECT, 2 * ring),
          white(PaintStyle.Stroke, (p) => p.setStrokeWidth(ringStroke)),
        ),
    },
  ];
}

/** A ×V pill for armored zeros worth `value`, drawn at `d` px per point. */
function badgeCell(value: number, font: SkFont, d: number): Cell {
  const sized = Skia.Font(font.getTypeface() ?? undefined, BADGE_FONT * d);
  const label = `×${value}`;
  const bounds = sized.measureText(label);
  const h = BADGE_HEIGHT * d;
  const w = Math.max(h, bounds.width + 2 * BADGE_PAD_X * d);
  return {
    w: Math.ceil(w + 2 * SPRITE_PAD),
    h: Math.ceil(h + 2 * SPRITE_PAD),
    ry: d,
    draw: (canvas, cx, cy) => {
      const pill = Skia.RRectXY(Skia.XYWHRect(cx - w / 2, cy - h / 2, w, h), h / 2, h / 2);
      canvas.drawRRect(
        pill,
        paint(PaintStyle.Fill, (p) => {
          p.setColor(Skia.Color(colors.ink));
          p.setAlphaf(BADGE_FILL_ALPHA);
        }),
      );
      canvas.drawRRect(
        pill,
        paint(PaintStyle.Stroke, (p) => {
          p.setStrokeWidth(BADGE_EDGE * d);
          p.setColor(Skia.Color(colors.fg));
          p.setAlphaf(BADGE_EDGE_ALPHA);
        }),
      );
      canvas.drawText(
        label,
        cx - bounds.x - bounds.width / 2,
        cy - bounds.y - bounds.height / 2,
        paint(PaintStyle.Fill, (p) => p.setColor(Skia.Color(colors.fg))),
        sized,
      );
    },
  };
}

/** The fill's Bungee "0", white so each glyph can be tinted, centered on its ink. ry is the font size in px. */
function glyphCell(sizePx: number, font: SkFont, glow: boolean): Cell {
  const sized = Skia.Font(font.getTypeface() ?? undefined, sizePx);
  const bounds = sized.measureText('0');
  const sigma = glow ? sizePx * GLYPH_GLOW : 0;
  const reach = sigma * GLOW_REACH + SPRITE_PAD;
  return {
    w: Math.ceil(bounds.width + 2 * reach),
    h: Math.ceil(bounds.height + 2 * reach),
    ry: sizePx,
    draw: (canvas, cx, cy) =>
      canvas.drawText(
        '0',
        cx - bounds.x - bounds.width / 2,
        cy - bounds.y - bounds.height / 2,
        white(PaintStyle.Fill, (p) => {
          if (glow) p.setMaskFilter(Skia.MaskFilter.MakeBlur(BlurStyle.Solid, sigma, false));
        }),
        sized,
      ),
  };
}

/** Lay out rows of cells left to right, top to bottom, and record them into one picture. */
function pack(rows: Cell[][]): { picture: SkPicture; sprites: Sprite[][]; width: number; height: number } {
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
  width = Math.max(1, width);
  height = Math.max(1, height);
  const picture = createPicture(
    (canvas) => {
      for (const { cell, sprite } of placed) cell.draw(canvas, sprite.x + sprite.width / 2, sprite.y + sprite.height / 2);
    },
    { width, height },
  );
  return { picture, sprites, width, height };
}

export { spriteRadius } from '../look';

export interface BakedSprites {
  picture: SkPicture;
  sheet: SpriteSheet;
}

/**
 * The round's sprite sheet: a ring per palette color, armored rings and their ×V badges when
 * the round has them, and the shots and effects. `font` is Bungee, at any size.
 */
export function bakeSprites(opts: {
  groups: readonly ZeroGroup[];
  fill: FillPlan;
  width: number;
  height: number;
  font: SkFont;
}): BakedSprites {
  const objectCount = opts.groups.reduce((sum, g) => sum + g.count, 0);
  const badgeValues = armorBadges(opts.groups);
  const armoredRound = badgeValues.length > 0;
  const ryPt = spriteRadius(objectCount, opts.width, opts.height);
  const biggest = ryPt * (armoredRound ? ARMOR_SIZE_SCALE : 1);
  const density = ringDensity(PixelRatio.get(), biggest);
  const fxScale = fxDensity(PixelRatio.get());
  const glyphPt = fillGrid(opts.fill.glyphs, opts.width, opts.height).size;
  const rows = {
    zero: zeroPalette.map((c) => ringCell(ryPt * density, c, false)),
    armored: armoredRound ? zeroPalette.map((c) => ringCell(ryPt * ARMOR_SIZE_SCALE * density, c, true)) : [],
    badges: badgeValues.map((v) => badgeCell(v, opts.font, fxScale)),
    bullets: BULLET_LOOKS.map((look) => bulletCell(look, fxScale)),
    fx: fxCells(fxScale),
    glyph: [glyphCell(Math.min(glyphPt * fxScale, GLYPH_MAX_PX), opts.font, opts.fill.glyphs <= GLYPH_GLOW_MAX)],
  };
  const { picture, sprites, width, height } = pack(Object.values(rows));
  const [zero = [], armored = [], badges = [], bullets = [], fx = [], glyphs = []] = sprites;
  const [dot, confetti, ring] = fx;
  const [glyph] = glyphs;
  if (!dot || !confetti || !ring || !glyph) throw new Error('The effect sprites failed to pack');
  return { picture, sheet: { width, height, zero, armored, badges, bullets, glyph, fx: { dot, confetti, ring } } };
}

function background(width: number, height: number): SkPicture {
  return createPicture(
    (canvas) => {
      const glow = paint(PaintStyle.Fill, (p) =>
        p.setShader(
          Skia.Shader.MakeRadialGradient(
            vec(width / 2, height * GLOW_Y),
            Math.max(width, height) * GLOW_RADIUS,
            [Skia.Color(colors.ink2), Skia.Color(colors.ink)],
            null,
            TileMode.Clamp,
          ),
        ),
      );
      canvas.drawRect(Skia.XYWHRect(0, 0, width, height), glow);
      const dots = [];
      for (let y = DOT_ORIGIN.y; y < height; y += DOT_SPACING) {
        for (let x = DOT_ORIGIN.x; x < width; x += DOT_SPACING) dots.push(vec(x, y));
      }
      if (dots.length > 0) {
        canvas.drawPoints(
          PointMode.Points,
          dots,
          paint(PaintStyle.Stroke, (p) => {
            p.setStrokeWidth(DOT_SIZE);
            p.setColor(Skia.Color(colors.line));
            p.setAlphaf(DOT_ALPHA);
          }),
        );
      }
    },
    { width, height },
  );
}

/** The full number for a fill too big to draw, sized to fit, centered on (0, 0). */
function overlay(n: number, font: SkFont, width: number, height: number): Kit['overlay'] {
  const label = formatCount(n);
  const typeface = font.getTypeface() ?? undefined;
  const measured = Skia.Font(typeface, MEASURE_SIZE).measureText(label).width || 1;
  const size = Math.min(height * OVERLAY_HEIGHT, (width * OVERLAY_WIDTH * MEASURE_SIZE) / measured);
  const sized = Skia.Font(typeface, size);
  const bounds = sized.measureText(label);
  return { label, font: sized, x: -bounds.x - bounds.width / 2, y: -bounds.y - bounds.height / 2 };
}

export function makeKit(
  width: number,
  height: number,
  sheet: SpriteSheet,
  round: { n: number; fill: FillPlan; font: SkFont },
): Kit {
  const r = TURRET_BASE_RADIUS;
  const big = round.fill.overlayNumber ? overlay(round.n, round.font, width, height) : null;
  const turretBase = Skia.Path.Make();
  turretBase.addArc(Skia.XYWHRect(-r, -r, r * 2, r * 2), 180, 180);
  turretBase.close();
  return {
    width,
    height,
    bounds: Skia.XYWHRect(0, 0, width, height),
    sheet,
    background: background(width, height),
    turretBase,
    paints: {
      sprite: paint(PaintStyle.Fill),
      fill: paint(PaintStyle.Fill),
      stroke: paint(PaintStyle.Stroke),
      glowFill: paint(PaintStyle.Fill, (p) => p.setBlendMode(BlendMode.Plus)),
      spriteAdd: paint(PaintStyle.Fill, (p) => p.setBlendMode(BlendMode.Plus)),
      glowStroke: paint(PaintStyle.Stroke, (p) => {
        p.setBlendMode(BlendMode.Plus);
        p.setStrokeCap(StrokeCap.Round);
      }),
      fillGlow: paint(PaintStyle.Fill, (p) =>
        p.setShader(
          Skia.Shader.MakeRadialGradient(
            vec(width / 2, height / 2),
            Math.max(width, height) * FILL_GLOW_RADIUS,
            [Skia.Color(withAlpha(colors.amber, FILL_GLOW_ALPHA)), Skia.Color(withAlpha(colors.flare, 0))],
            null,
            TileMode.Clamp,
          ),
        ),
      ),
      overlayStroke: paint(PaintStyle.Stroke, (p) => {
        p.setColor(Skia.Color(colors.ink));
        p.setStrokeWidth((big?.font.getSize() ?? 0) * OVERLAY_OUTLINE);
        p.setStrokeJoin(StrokeJoin.Round);
      }),
      overlayFill: paint(PaintStyle.Fill, (p) => p.setColor(Skia.Color(colors.amber))),
    },
    overlay: big,
    blend: { modulate: BlendMode.Modulate },
    palette: zeroPalette.map((c) => rgba(c)),
    colors: { fg: rgba(colors.fg), shot: rgba(colors.amber), chain: rgba(colors.teal), panel2: rgba(colors.panel2) },
  };
}
