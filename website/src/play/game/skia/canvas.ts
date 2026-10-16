// The shared drawing code's canvas, on a browser 2D context. It draws in points; the context's
// base transform scales to the screen's pixels.
//
// - drawAtlas places each sprite with its RSXform composed onto the current transform.
// - Tinted atlas draws (Skia's Modulate with a color per sprite) use copies of the sprite baked in
//   each tint color (bake.ts), drawn at the tint's alpha. Tints only ever come from the palette.
// - Additive paints (Skia's Plus) draw with 'lighter', as the prototype did.
import type { BlendMode, SkCanvas, SkColor, SkFont, SkImage, SkPaint, SkPath, SkPicture, SkRect, SkRSXform } from './types';

const DEG = Math.PI / 180;

const css = new Map<number, string>();

/** An 0..1 RGB as one integer, the key for tinted copies and color strings. */
export function rgbKey(r: number, g: number, b: number): number {
  return (Math.round(r * 255) << 16) | (Math.round(g * 255) << 8) | Math.round(b * 255);
}

function cssColor(key: number): string {
  let s = css.get(key);
  if (!s) {
    s = `rgb(${(key >> 16) & 255} ${(key >> 8) & 255} ${key & 255})`;
    css.set(key, s);
  }
  return s;
}

export interface PaintOptions {
  style?: 'fill' | 'stroke';
  /** Additive, Skia's BlendMode.Plus. */
  additive?: boolean;
  cap?: CanvasLineCap;
  join?: CanvasLineJoin;
  strokeWidth?: number;
  /** A color as [r, g, b, a], 0..1. */
  color?: SkColor;
  /** A gradient in place of the color; the paint's alpha still applies. */
  shader?: CanvasGradient | null;
}

export class WebPaint implements SkPaint {
  readonly style: 'fill' | 'stroke';
  readonly composite: GlobalCompositeOperation;
  readonly cap: CanvasLineCap;
  readonly join: CanvasLineJoin;
  readonly shader: CanvasGradient | null;
  strokeWidth: number;
  color = cssColor(0);
  alpha = 1;

  constructor(opts: PaintOptions = {}) {
    this.style = opts.style ?? 'fill';
    this.composite = opts.additive ? 'lighter' : 'source-over';
    this.cap = opts.cap ?? 'butt';
    this.join = opts.join ?? 'miter';
    this.strokeWidth = opts.strokeWidth ?? 1;
    this.shader = opts.shader ?? null;
    if (opts.color) this.setColor(opts.color);
  }

  setColor(c: SkColor): void {
    this.color = cssColor(rgbKey(c[0] ?? 0, c[1] ?? 0, c[2] ?? 0));
    this.alpha = c[3] ?? 1;
  }

  setAlphaf(alpha: number): void {
    this.alpha = alpha;
  }

  setStrokeWidth(width: number): void {
    this.strokeWidth = width;
  }
}

/** For each sprite drawn tinted: its copies, by tint (rgbKey). */
export type TintTable = Map<SkRect, Map<number, CanvasImageSource>>;

export class Canvas2D implements SkCanvas {
  /** Tinted draws that found no baked copy and fell back to the plain sprite. Tests check it stays 0. */
  tintMisses = 0;

  constructor(
    readonly ctx: CanvasRenderingContext2D,
    private readonly tints: TintTable,
  ) {}

  private use(p: SkPaint, forceStroke = false): 'fill' | 'stroke' {
    const paint = p as WebPaint;
    const ctx = this.ctx;
    const style = forceStroke ? 'stroke' : paint.style;
    ctx.globalCompositeOperation = paint.composite;
    ctx.globalAlpha = paint.alpha;
    if (style === 'fill') {
      ctx.fillStyle = paint.shader ?? paint.color;
    } else {
      ctx.strokeStyle = paint.shader ?? paint.color;
      ctx.lineWidth = paint.strokeWidth;
      ctx.lineCap = paint.cap;
      ctx.lineJoin = paint.join;
    }
    return style;
  }

  save(): void {
    this.ctx.save();
  }

  restore(): void {
    this.ctx.restore();
  }

  translate(dx: number, dy: number): void {
    this.ctx.translate(dx, dy);
  }

  rotate(degrees: number, rx: number, ry: number): void {
    const ctx = this.ctx;
    if (rx !== 0 || ry !== 0) ctx.translate(rx, ry);
    ctx.rotate(degrees * DEG);
    if (rx !== 0 || ry !== 0) ctx.translate(-rx, -ry);
  }

  scale(sx: number, sy: number): void {
    this.ctx.scale(sx, sy);
  }

  drawPicture(picture: SkPicture): void {
    const ctx = this.ctx;
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.drawImage(picture.image, 0, 0, picture.width, picture.height);
  }

  drawRect(r: SkRect, paint: SkPaint): void {
    if (this.use(paint) === 'fill') this.ctx.fillRect(r.x, r.y, r.width, r.height);
    else this.ctx.strokeRect(r.x, r.y, r.width, r.height);
  }

  drawCircle(cx: number, cy: number, radius: number, paint: SkPaint): void {
    const ctx = this.ctx;
    const style = this.use(paint);
    ctx.beginPath();
    ctx.arc(cx, cy, Math.max(0, radius), 0, Math.PI * 2);
    if (style === 'fill') ctx.fill();
    else ctx.stroke();
  }

  drawLine(x0: number, y0: number, x1: number, y1: number, paint: SkPaint): void {
    const ctx = this.ctx;
    this.use(paint, true);
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }

  drawPath(path: SkPath, paint: SkPaint): void {
    if (this.use(paint) === 'fill') this.ctx.fill(path);
    else this.ctx.stroke(path);
  }

  drawText(text: string, x: number, y: number, paint: SkPaint, font: SkFont): void {
    const ctx = this.ctx;
    const style = this.use(paint);
    ctx.font = font.css;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    if (style === 'fill') ctx.fillText(text, x, y);
    else ctx.strokeText(text, x, y);
  }

  drawAtlas(image: SkImage, srcs: SkRect[], dsts: SkRSXform[], paint: SkPaint, _blend?: BlendMode, colors?: SkColor[]): void {
    const ctx = this.ctx;
    const p = paint as WebPaint;
    const m = ctx.getTransform();
    const sheet = image as unknown as CanvasImageSource;
    ctx.globalCompositeOperation = p.composite;
    for (let i = 0; i < srcs.length; i++) {
      const src = srcs[i];
      const d = dsts[i];
      if (!src || !d) continue;
      let img = sheet;
      let sx = src.x;
      let sy = src.y;
      let alpha = p.alpha;
      const tint = colors?.[i];
      if (tint) {
        const copy = this.tints.get(src)?.get(rgbKey(tint[0] ?? 1, tint[1] ?? 1, tint[2] ?? 1));
        if (copy) {
          img = copy;
          sx = 0;
          sy = 0;
        } else {
          this.tintMisses++;
        }
        alpha *= tint[3] ?? 1;
      }
      if (alpha <= 0) continue;
      ctx.globalAlpha = Math.min(1, alpha);
      // The current transform, then the sprite's: rotate and scale (scos, ssin), then move (tx, ty).
      ctx.setTransform(
        m.a * d.scos + m.c * d.ssin,
        m.b * d.scos + m.d * d.ssin,
        m.c * d.scos - m.a * d.ssin,
        m.d * d.scos - m.b * d.ssin,
        m.a * d.tx + m.c * d.ty + m.e,
        m.b * d.tx + m.d * d.ty + m.f,
      );
      ctx.drawImage(img, sx, sy, src.width, src.height, 0, 0, src.width, src.height);
    }
    ctx.setTransform(m);
  }
}
