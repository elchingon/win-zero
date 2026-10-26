// How the round and the backdrop look, as numbers: the zero field's dots and glow, the zero
// ring's glow and highlight, and the sizes and colors the sprite sheet is baked with. Plain data
// and arithmetic only, so the app's Skia bake and the website's canvas bake draw the same thing.
import { colors } from '@/theme/tokens';

import { SIZE_JITTER } from './sim/constants';
import { zeroRadius } from './sim/sizing';

// The backdrop behind every screen (ZeroField): a dot grid over a radial glow.
export const DOT_SPACING = 26;
export const DOT_SIZE = 1.5;
export const DOT_ALPHA = 0.35;
/** The first dot's offset from the top-left corner. */
export const DOT_ORIGIN = { x: 13, y: 14 };
/** The backdrop glow sits a little above center. */
export const GLOW_Y = 0.38;
export const GLOW_RADIUS = 0.8;

// The faint zeros drifting over the backdrop, like the prototype's attract mode.
export const FIELD_ZEROS = 7;
export const FIELD_ALPHA = 0.2;
/** The prototype sizes attract-mode zeros as if 6 shared the screen. */
export const FIELD_SIZE_AS_IF = 6;
export const FIELD_SIZE_JITTER = 0.3;
/** Drift speed, points per second, before jitter. */
export const FIELD_DRIFT_SPEED = 28;
export const FIELD_MAX_STEP_S = 0.05;

// One zero ring (the prototype's drawZero): a glowing oval with a soft highlight.
/** Glow size as a fraction of the vertical radius (the prototype's shadowBlur, as a blur sigma). */
export const ZERO_GLOW = 0.22;
export const HIGHLIGHT_ALPHA = 0.35;
/** The highlight arc, in degrees clockwise from 3 o'clock: 1.1π to 1.45π. */
export const HIGHLIGHT_START = 198;
export const HIGHLIGHT_SWEEP = 63;
/** The highlight sits this many ring widths in from the outer edge, and is this fraction of one thick. */
export const HIGHLIGHT_INSET = 0.75;
export const HIGHLIGHT_WIDTH = 0.18;

// The round's sprite sheet.
/** Sprites are drawn at screen density, up to this. */
export const SPRITE_MAX_DENSITY = 3;
/** And never with a radius above this many pixels, to keep the sheet small. */
export const SPRITE_MAX_RY_PX = 200;
/** A blur reaches about this many sigmas. */
export const GLOW_REACH = 3;
export const SPRITE_PAD = 2;
/** Armored rings: a thicker band with a metallic sheen and a dark inner edge. */
export const ARMOR_STROKE_SCALE = 1.4;
export const ARMOR_SHEEN_WIDTH = 0.55;
export const ARMOR_SHEEN = [0.7, 0, 0.35, 0];
export const ARMOR_SHEEN_STOPS = [0, 0.4, 0.7, 1];
export const ARMOR_EDGE_WIDTH = 0.1;
export const ARMOR_EDGE_ALPHA = 0.55;
export interface BulletLook {
  color: string;
  tail: number;
  width: number;
  head: number;
}
/**
 * Bullet streaks, in points: the prototype's tail length, line width and head radius: the usual
 * shot, the chain shot and the big shot. The colors are Classic's; a theme in the app swaps them.
 */
export const BULLET_LOOKS = [
  { color: colors.amber, tail: 18, width: 4, head: 3 },
  { color: colors.teal, tail: 18, width: 4, head: 3 },
  { color: colors.flare, tail: 26, width: 8, head: 5 },
] as const satisfies readonly BulletLook[];
export const BULLET_TAIL_ALPHA = 0.55;
/**
 * White effect shapes, in points, tinted per particle when drawn: a square dot, a 2:1 confetti
 * strip, and a fragment ring (an oval with the prototype's stroke).
 */
export const FX_DOT = 8;
export const FX_CONFETTI = 16;
export const FX_RING = 12;
export const FX_RING_STROKE = 0.3;
/** ×V badges, in points: Bungee on a dark pill with a faint fg edge. */
export const BADGE_FONT = 10;
export const BADGE_HEIGHT = 15;
export const BADGE_PAD_X = 5;
export const BADGE_FILL_ALPHA = 0.9;
export const BADGE_EDGE_ALPHA = 0.45;
export const BADGE_EDGE = 1;
/** Fill glyphs: baked no bigger than this many px (a one-zero fill scales up a little). */
export const GLYPH_MAX_PX = 1024;
/** Fills of up to this many glyphs glow, as in the prototype; the glow's blur is this × the size. */
export const GLYPH_GLOW_MAX = 40;
export const GLYPH_GLOW = 0.06;
/** The fill's glow: its middle color (amber in Classic) at this opacity, out to this × the longer side. */
export const FILL_GLOW_ALPHA = 0.22;
export const FILL_GLOW_RADIUS = 0.7;
/** The overlaid number: up to this share of the width, this share of the height, outlined this thick (× size). */
export const OVERLAY_WIDTH = 0.86;
export const OVERLAY_HEIGHT = 0.3;
export const OVERLAY_OUTLINE = 0.08;
/** Measuring size for fitting the overlaid number. */
export const MEASURE_SIZE = 100;
/** Tinted sprites are baked white, so a tint multiplies straight to its color. */
export const TINT_BASE = '#FFFFFF';

/** The zero radius (points) the round's sprites are baked at: the biggest a zero gets. */
export function spriteRadius(objectCount: number, width: number, height: number): number {
  return zeroRadius(objectCount, width, height) * (1 + SIZE_JITTER / 2);
}

/** Pixels per point for the zero rings: the screen's density, within the sheet's limits. */
export function ringDensity(pixelRatio: number, biggestRy: number): number {
  return Math.max(1, Math.min(pixelRatio, SPRITE_MAX_DENSITY, SPRITE_MAX_RY_PX / biggestRy));
}

/** Pixels per point for shots, effects, badges and fill glyphs. */
export function fxDensity(pixelRatio: number): number {
  return Math.min(pixelRatio, SPRITE_MAX_DENSITY);
}
