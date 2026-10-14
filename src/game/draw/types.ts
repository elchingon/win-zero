'worklet';
// What the scene drawing needs. The kit is built once on the JS thread (Skia objects are shared
// with the UI thread by reference); the scratch is built on the UI thread and reused every frame.
import type { SkPaint, SkPath, SkPicture, SkRect } from '@shopify/react-native-skia';

/** A cell of the sprite sheet, in sheet pixels, and the zero radius (px) it was drawn at. */
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
  };
  /** tokens.zeroPalette: amber, flare, teal, fg. */
  palette: Rgba[];
  colors: { fg: Rgba; amber: Rgba; panel2: Rgba };
}

/** One RSXform: rotation and scale (scos, ssin) and translation. */
export interface Xform {
  scos: number;
  ssin: number;
  tx: number;
  ty: number;
}

/** Sprites waiting for one drawAtlas call. srcs / dsts are trimmed to `count` before drawing. */
export interface Batch {
  srcs: Sprite[];
  dsts: Xform[];
  /** Backing transforms, reused. */
  xforms: Xform[];
  count: number;
}

export interface Scratch {
  zeros: Batch;
  rect: SkRect;
  rgba: Rgba;
  /** The development frame meter: time and frames since it last reported, and the slowest frame (ms). */
  meter: { t: number; frames: number; worst: number };
}
