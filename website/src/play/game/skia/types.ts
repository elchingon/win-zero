// Stands in for '@shopify/react-native-skia' on the website (tsconfig paths). The shared drawing
// code (src/game/draw) imports Skia for types only, and draws through these few methods, which
// skia/canvas.ts implements on a 2D canvas. If the app's drawing starts calling something new,
// the website's type check fails here first.

/** A color as [r, g, b, a], each 0..1 (draw/util.ts reuses one array). */
export type SkColor = Float32Array | number[];

export interface SkRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** One sprite's placement: rotation and scale (scos, ssin) and translation. */
export interface SkRSXform {
  scos: number;
  ssin: number;
  tx: number;
  ty: number;
}

/** The sprite sheet: a canvas. */
export interface SkImage {
  readonly width: number;
  readonly height: number;
}

/** A pre-rendered layer (the backdrop), drawn at width × height points. */
export interface SkPicture {
  readonly image: CanvasImageSource;
  readonly width: number;
  readonly height: number;
}

export type SkPath = Path2D;

/** A font, as a CSS font string. */
export interface SkFont {
  readonly css: string;
  readonly size: number;
}

/** Only Modulate is used (drawAtlas tints), and the canvas does it with pre-tinted sprites. */
export type BlendMode = number;

export interface SkPaint {
  setColor(color: SkColor): void;
  setAlphaf(alpha: number): void;
  setStrokeWidth(width: number): void;
}

export interface SkCanvas {
  save(): void;
  restore(): void;
  translate(dx: number, dy: number): void;
  /** Degrees, around (rx, ry). */
  rotate(degrees: number, rx: number, ry: number): void;
  scale(sx: number, sy: number): void;
  drawPicture(picture: SkPicture): void;
  drawRect(rect: SkRect, paint: SkPaint): void;
  drawCircle(cx: number, cy: number, radius: number, paint: SkPaint): void;
  drawLine(x0: number, y0: number, x1: number, y1: number, paint: SkPaint): void;
  drawPath(path: SkPath, paint: SkPaint): void;
  /** `y` is the baseline. */
  drawText(text: string, x: number, y: number, paint: SkPaint, font: SkFont): void;
  drawAtlas(image: SkImage, srcs: SkRect[], dsts: SkRSXform[], paint: SkPaint, blendMode?: BlendMode, colors?: SkColor[]): void;
}
