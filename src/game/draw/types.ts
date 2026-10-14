'worklet';
// What the scene drawing needs. The kit is built once on the JS thread (Skia objects are shared
// with the UI thread by reference); the scratch is built on the UI thread and reused every frame.
import type { BlendMode, SkFont, SkPaint, SkPath, SkPicture, SkRect } from '@shopify/react-native-skia';

/**
 * A cell of the sprite sheet, in sheet pixels. `ry` is the size it was drawn at, in px: a
 * zero's vertical radius, or for effects drawn at their natural size, the pixels per point.
 * Draw it at scale = wanted size / ry.
 */
export interface Sprite {
  x: number;
  y: number;
  width: number;
  height: number;
  ry: number;
}

export interface SpriteSheet {
  width: number;
  height: number;
  /** A zero ring per palette slot. */
  zero: Sprite[];
  /** An armored ring per palette slot; empty when the round has none. */
  armored: Sprite[];
  /** Bullet streaks, head at the sprite's center, pointing right: amber, teal (chain), flare (big). */
  bullets: Sprite[];
  /** A ×V badge per distinct armored value, in armorBadges order. Drawn at natural size (ry = px per point). */
  badges: Sprite[];
  /** The white Bungee "0" for the celebration fill, tinted per glyph. `ry` is its font size in px. */
  glyph: Sprite;
  /** White effect shapes, tinted per particle. `ry` is the dot's side, the confetti's length, the ring's ry. */
  fx: { dot: Sprite; confetti: Sprite; ring: Sprite };
}

/** A color as [r, g, b, a], each 0..1: what Skia's native calls accept without allocating. */
export type Rgba = number[];

export interface Kit {
  width: number;
  height: number;
  /** The whole screen, for recording each frame's picture. */
  bounds: SkRect;
  sheet: SpriteSheet;
  background: SkPicture;
  /** The turret's half-disc base, centered on (0, 0). */
  turretBase: SkPath;
  paints: {
    sprite: SkPaint;
    fill: SkPaint;
    stroke: SkPaint;
    /** Additive (the prototype's 'lighter'), for glows and effects. */
    glowFill: SkPaint;
    /** Additive sprites. */
    spriteAdd: SkPaint;
    /** Additive strokes: shockwaves, beams, bolts. */
    glowStroke: SkPaint;
    /** The fill's warm radial glow (a shader); its alpha ramps in. */
    fillGlow: SkPaint;
    /** The overlaid number: an ink outline under amber. */
    overlayStroke: SkPaint;
    overlayFill: SkPaint;
  };
  /** The full number drawn over a fill too big to show every zero, centered on (0, 0) at offset (x, y). */
  overlay: { label: string; font: SkFont; x: number; y: number } | null;
  /** Skia enum values the worklets can't import: drawAtlas tints multiply the sprite. */
  blend: { modulate: BlendMode };
  /** tokens.zeroPalette: amber, flare, teal, fg. */
  palette: Rgba[];
  colors: { fg: Rgba; amber: Rgba; teal: Rgba; panel2: Rgba };
}

/** One RSXform: rotation and scale (scos, ssin) and translation. */
export interface Xform {
  scos: number;
  ssin: number;
  tx: number;
  ty: number;
}

/** Sprites waiting for one drawAtlas call. srcs / dsts / cols are trimmed to `count` before drawing. */
export interface Batch {
  srcs: Sprite[];
  dsts: Xform[];
  /** One tint per sprite, for a tinted batch; empty otherwise. */
  cols: Rgba[];
  /** Backing transforms and tints, reused. */
  xforms: Xform[];
  tints: Rgba[];
  tinted: boolean;
  count: number;
}

export interface Scratch {
  zeros: Batch;
  flashes: Batch;
  glyphs: Batch;
  bullets: Batch;
  particles: Batch;
  rect: SkRect;
  rgba: Rgba;
  /** The development frame meter: time and frames since it last reported, and the slowest frame (ms). */
  meter: { t: number; frames: number; worst: number };
}
