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
  TileMode,
  vec,
  type SkCanvas,
  type SkPaint,
  type SkPicture,
} from '@shopify/react-native-skia';
import { PixelRatio } from 'react-native';

import { colors, zeroPalette } from '@/theme/tokens';
import { DOT_ALPHA, DOT_ORIGIN, DOT_SIZE, DOT_SPACING, GLOW_RADIUS, GLOW_Y } from '@/ui/ZeroField';

import { TURRET_BASE_RADIUS } from '../draw/scene';
import type { Kit, Rgba, Sprite, SpriteSheet } from '../draw/types';
import { ARMOR_SIZE_SCALE, SIZE_JITTER } from '../sim/constants';
import { ZERO_ASPECT, ZERO_STROKE, zeroRadius } from '../sim/sizing';
import { HIGHLIGHT_ALPHA, HIGHLIGHT_WIDTH, highlightPath, ZERO_GLOW } from '../ZeroRing';

/** Sprites are drawn at screen density, up to this. */
const SPRITE_MAX_DENSITY = 3;
/** And never with a radius above this many pixels, to keep the sheet small. */
const SPRITE_MAX_RY_PX = 200;
/** A blur reaches about this many sigmas. */
const GLOW_REACH = 3;
const SPRITE_PAD = 2;
/** Armored rings: a thicker band with a metallic sheen and a dark inner edge. */
const ARMOR_STROKE_SCALE = 1.4;
const ARMOR_SHEEN_WIDTH = 0.55;
const ARMOR_SHEEN = [0.7, 0, 0.35, 0];
const ARMOR_SHEEN_STOPS = [0, 0.4, 0.7, 1];
const ARMOR_EDGE_WIDTH = 0.1;
const ARMOR_EDGE_ALPHA = 0.55;
/** Bullet streaks, in points: the prototype's tail length, line width and head radius. */
const BULLET_LOOKS = [
  { color: colors.amber, tail: 18, width: 4, head: 3 },
  { color: colors.teal, tail: 18, width: 4, head: 3 },
  { color: colors.flare, tail: 26, width: 8, head: 5 },
];
const BULLET_TAIL_ALPHA = 0.55;
/**
 * White effect shapes, in points, tinted per particle when drawn: a square dot, a 2:1 confetti
 * strip, and a fragment ring (an oval with the prototype's stroke).
 */
const FX_DOT = 8;
const FX_CONFETTI = 16;
const FX_RING = 12;
const FX_RING_STROKE = 0.3;
/** Tinted sprites are baked white, so a tint multiplies straight to its color. */
const TINT_BASE = '#FFFFFF';

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
function bulletCell(look: (typeof BULLET_LOOKS)[number], d: number): Cell {
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

/** The zero radius (points) the round's sprites are baked at: the biggest a zero gets. */
export function spriteRadius(objectCount: number, width: number, height: number): number {
  return zeroRadius(objectCount, width, height) * (1 + SIZE_JITTER / 2);
}

export interface BakedSprites {
  picture: SkPicture;
  sheet: SpriteSheet;
}

/**
 * The round's sprite sheet: a ring per palette color, armored rings when the round has them,
 * and the shots and effects.
 */
export function bakeSprites(opts: { objectCount: number; width: number; height: number; armored: boolean }): BakedSprites {
  const ryPt = spriteRadius(opts.objectCount, opts.width, opts.height);
  const biggest = ryPt * (opts.armored ? ARMOR_SIZE_SCALE : 1);
  const density = Math.max(1, Math.min(PixelRatio.get(), SPRITE_MAX_DENSITY, SPRITE_MAX_RY_PX / biggest));
  const fxDensity = Math.min(PixelRatio.get(), SPRITE_MAX_DENSITY);
  const rows = {
    zero: zeroPalette.map((c) => ringCell(ryPt * density, c, false)),
    armored: opts.armored ? zeroPalette.map((c) => ringCell(ryPt * ARMOR_SIZE_SCALE * density, c, true)) : [],
    bullets: BULLET_LOOKS.map((look) => bulletCell(look, fxDensity)),
    fx: fxCells(fxDensity),
  };
  const { picture, sprites, width, height } = pack(Object.values(rows));
  const [zero = [], armored = [], bullets = [], fx = []] = sprites;
  const [dot, confetti, ring] = fx;
  if (!dot || !confetti || !ring) throw new Error('The effect sprites failed to pack');
  return { picture, sheet: { width, height, zero, armored, bullets, fx: { dot, confetti, ring } } };
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

export function makeKit(width: number, height: number, sheet: SpriteSheet): Kit {
  const r = TURRET_BASE_RADIUS;
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
    },
    blend: { modulate: BlendMode.Modulate },
    palette: zeroPalette.map((c) => rgba(c)),
    colors: { fg: rgba(colors.fg), amber: rgba(colors.amber), panel2: rgba(colors.panel2) },
  };
}
