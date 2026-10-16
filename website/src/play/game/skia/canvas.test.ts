import { describe, expect, it } from 'vitest';

import { Canvas2D, rgbKey, WebPaint, type TintTable } from './canvas';
import { FakeContext } from './fakeContext';

const sprite = { x: 10, y: 20, width: 30, height: 40 };
const sheet = { width: 100, height: 100 };

function setup(tints: TintTable = new Map()) {
  const ctx = new FakeContext();
  const canvas = new Canvas2D(ctx as unknown as CanvasRenderingContext2D, tints);
  return { ctx, canvas };
}

describe('Canvas2D.drawAtlas', () => {
  it('places each sprite with its RSXform on top of the current transform, then puts it back', () => {
    const { ctx, canvas } = setup();
    ctx.setTransform(2, 0, 0, 2, 0, 0); // the screen's pixel ratio
    canvas.translate(5, 7); // a screen shake
    const angle = Math.PI / 2;
    const scale = 0.5;
    canvas.drawAtlas(sheet, [sprite], [{ scos: Math.cos(angle) * scale, ssin: Math.sin(angle) * scale, tx: 100, ty: 50 }], new WebPaint());
    const [d] = ctx.drawn;
    expect(d?.op).toBe('drawImage');
    expect(d?.args).toEqual([sheet, 10, 20, 30, 40, 0, 0, 30, 40]);
    // A point at the sprite's (1, 0) lands at shake + (tx, ty) + rotated, scaled, all × 2.
    const m = d!.matrix;
    expect(m.a * 1 + m.e).toBeCloseTo(2 * (5 + 100 + 0));
    expect(m.b * 1 + m.f).toBeCloseTo(2 * (7 + 50 + scale));
    expect(m.c).toBeCloseTo(-2 * scale);
    expect(ctx.matrix).toEqual({ a: 2, b: 0, c: 0, d: 2, e: 10, f: 14 });
  });

  it('draws additive paints with lighter', () => {
    const { ctx, canvas } = setup();
    canvas.drawAtlas(sheet, [sprite], [{ scos: 1, ssin: 0, tx: 0, ty: 0 }], new WebPaint({ additive: true }));
    expect(ctx.drawn[0]?.composite).toBe('lighter');
    canvas.drawAtlas(sheet, [sprite], [{ scos: 1, ssin: 0, tx: 0, ty: 0 }], new WebPaint());
    expect(ctx.drawn[1]?.composite).toBe('source-over');
  });

  it('draws a tinted sprite from its copy in that color, at the tint’s alpha', () => {
    const amberCopy = { name: 'amber copy' } as unknown as CanvasImageSource;
    const tints: TintTable = new Map([[sprite, new Map([[rgbKey(1, 181 / 255, 46 / 255), amberCopy]])]]);
    const { ctx, canvas } = setup(tints);
    const xf = { scos: 1, ssin: 0, tx: 0, ty: 0 };
    canvas.drawAtlas(sheet, [sprite, sprite], [xf, xf], new WebPaint(), 0, [
      [1, 181 / 255, 46 / 255, 0.25],
      [0.2, 0.2, 0.2, 1],
    ]);
    expect(ctx.drawn[0]?.args).toEqual([amberCopy, 0, 0, 30, 40, 0, 0, 30, 40]);
    expect(ctx.drawn[0]?.alpha).toBeCloseTo(0.25);
    // A color nobody baked falls back to the plain sprite, and is counted.
    expect(ctx.drawn[1]?.args[0]).toBe(sheet);
    expect(canvas.tintMisses).toBe(1);
  });

  it('skips sprites tinted fully transparent', () => {
    const { ctx, canvas } = setup();
    canvas.drawAtlas(sheet, [sprite], [{ scos: 1, ssin: 0, tx: 0, ty: 0 }], new WebPaint(), 0, [[1, 1, 1, 0]]);
    expect(ctx.drawn).toHaveLength(0);
  });
});

describe('Canvas2D', () => {
  it('rotates in degrees around a point', () => {
    const { ctx, canvas } = setup();
    canvas.rotate(90, 10, 0);
    // (10, 0) stays put; the origin swings to (10, -10).
    const m = ctx.matrix;
    expect(m.a * 10 + m.e).toBeCloseTo(10);
    expect(m.b * 10 + m.f).toBeCloseTo(0);
    expect(m.e).toBeCloseTo(10);
    expect(m.f).toBeCloseTo(-10);
  });

  it('sets color and alpha from a paint, and strokes lines whatever the paint style', () => {
    const { ctx, canvas } = setup();
    const paint = new WebPaint({ style: 'fill' });
    paint.setColor([1, 0, 0, 0.5]);
    paint.setStrokeWidth(3);
    canvas.drawRect({ x: 1, y: 2, width: 3, height: 4 }, paint);
    canvas.drawLine(0, 0, 5, 5, paint);
    expect(ctx.drawn[0]).toMatchObject({ op: 'fillRect', args: [1, 2, 3, 4], alpha: 0.5, style: 'rgb(255 0 0)' });
    expect(ctx.drawn[1]).toMatchObject({ op: 'stroke', style: 'rgb(255 0 0)' });
    expect(ctx.lineWidth).toBe(3);
    paint.setAlphaf(0.2);
    canvas.drawCircle(0, 0, 4, paint);
    expect(ctx.drawn[2]).toMatchObject({ op: 'fill', alpha: 0.2 });
  });

  it('draws text at its baseline, outlined or filled by the paint', () => {
    const { ctx, canvas } = setup();
    const font = { css: '40px Bungee', size: 40 };
    canvas.drawText('1,000', -10, 12, new WebPaint({ style: 'stroke', strokeWidth: 3, join: 'round' }), font);
    canvas.drawText('1,000', -10, 12, new WebPaint(), font);
    expect(ctx.drawn.map((d) => d.op)).toEqual(['strokeText', 'fillText']);
    expect(ctx.font).toBe('40px Bungee');
    expect(ctx.textBaseline).toBe('alphabetic');
    expect(ctx.lineJoin).toBe('round');
  });
});
