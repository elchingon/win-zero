// A stand-in for the drawing tests: a canvas that records each call by name and throws on any the
// website's stand-in canvas lacks, and a kit of placeholder sprites and paints.
import type { SkCanvas, SkImage } from '@shopify/react-native-skia';

import type { GameState } from '../../sim/types';
import { drawScene, makeScratch } from '../scene';
import type { Kit, Rgba, Scratch, Sprite } from '../types';

/** The calls the website's stand-in canvas has (website/src/play/game/skia/types.ts). */
export const STAND_IN = ['save', 'restore', 'translate', 'rotate', 'scale', 'drawPicture', 'drawRect', 'drawCircle', 'drawLine', 'drawPath', 'drawText', 'drawAtlas'];

export function recorder(): { canvas: SkCanvas; calls: string[] } {
  const calls: string[] = [];
  const canvas = new Proxy(
    {},
    {
      get: (_, name: string) => {
        if (!STAND_IN.includes(name)) throw new Error(`The website's canvas has no ${name}`);
        return (...args: unknown[]) => {
          calls.push(`${name}(${args.filter((a) => typeof a === 'number').map((a) => Math.round(a as number)).join(',')})`);
        };
      },
    },
  );
  return { canvas: canvas as SkCanvas, calls };
}

/** A paint that hands each color it's given to `onColor`. */
const paint = (onColor?: (color: Rgba) => void) => ({
  setColor: (c: Rgba) => onColor?.([...c]),
  setAlphaf: () => {},
  setStrokeWidth: () => {},
});
export const sprite = (): Sprite => ({ x: 0, y: 0, width: 10, height: 10, ry: 5 });

/** A kit for `s`'s screen. `boss` adds a boss row; `onFill` hears every color the fill paint is set to. */
export function stubKit(s: GameState, opts: { boss?: boolean; onFill?: (color: Rgba) => void } = {}): Kit {
  const kit = {
    width: s.width,
    height: s.height,
    bounds: {},
    sheet: {
      width: 64,
      height: 64,
      zero: [0, 1, 2, 3].map(sprite),
      armored: [0, 1, 2, 3].map(sprite),
      bullets: [0, 1, 2].map(sprite),
      badges: [0, 1, 2, 3].map(sprite),
      glyph: sprite(),
      fx: { dot: sprite(), confetti: sprite(), ring: sprite() },
      ...(opts.boss ? { boss: { ring: sprite(), flash: sprite() } } : {}),
    },
    background: {},
    turretBase: {},
    paints: {
      sprite: paint(),
      fill: paint(opts.onFill),
      stroke: paint(),
      glowFill: paint(),
      spriteAdd: paint(),
      glowStroke: paint(),
      fillGlow: paint(),
      overlayStroke: paint(),
      overlayFill: paint(),
    },
    overlay: null,
    blend: { modulate: 7 },
    palette: [0, 1, 2, 3].map(() => [1, 1, 1, 1]),
    colors: { fg: [1, 1, 1, 1], shot: [1, 0.7, 0.2, 1], chain: [0.2, 0.9, 0.8, 1], panel2: [0.1, 0.2, 0.4, 1] },
  };
  return kit as unknown as Kit;
}

export const ATLAS = { width: 64, height: 64 } as unknown as SkImage;

/** Draw `s` once, and the calls it made. */
export function draw(s: GameState, kit: Kit = stubKit(s), sc: Scratch = makeScratch()): string[] {
  const { canvas, calls } = recorder();
  drawScene(canvas, s, kit, ATLAS, sc);
  return calls;
}
