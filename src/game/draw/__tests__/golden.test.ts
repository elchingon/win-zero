// Golden fingerprints of the Shooter's drawing, taken before the scene learned other modes (M5).
// The sim's scripted rounds (sim/__tests__/script.ts) are drawn every frame onto a canvas that
// records each call as it's made (the scene reuses its arrays, so later is too late): which
// sprite and paint, every transform and tint, every rect, line, circle and text. If a line
// changes, the Shooter now looks different: fix the code, never these lines.
import { describe, expect, it } from '@jest/globals';
import type { SkCanvas, SkImage } from '@shopify/react-native-skia';

import { fillPlan } from '@/engine';

import { moveAim, pressFire, releaseFire } from '../../sim/input';
import { makeCheckpoints, makeHasher, runScript, scriptConfig, type Hands, type Hasher } from '../../sim/__tests__/script';
import { drawScene, makeScratch } from '../scene';
import type { Kit, Sprite } from '../types';

const ROUNDS = [7, 60, 250, 1000] as const;

const PRESS: Hands = { down: pressFire, move: moveAim, up: releaseFire };

/** The canvas and its paints write into whichever hasher is current. */
let h: Hasher = makeHasher();
/** Every stub object the scene hands back to the canvas, by name. */
const names = new Map<object, string>();

function named<T extends object>(name: string, value: T): T {
  names.set(value, name);
  return value;
}

function nameOf(v: unknown): string {
  return (typeof v === 'object' && v !== null && names.get(v)) || 'unnamed';
}

function nums(values: ArrayLike<number>): void {
  h.num(values.length);
  for (let i = 0; i < values.length; i++) h.num(values[i] ?? NaN);
}

function stubPaint(name: string) {
  return named(name, {
    setColor: (c: ArrayLike<number>) => {
      h.str(`${name}.setColor`);
      nums(c);
    },
    setAlphaf: (a: number) => {
      h.str(`${name}.setAlphaf`);
      h.num(a);
    },
    setStrokeWidth: (w: number) => {
      h.str(`${name}.setStrokeWidth`);
      h.num(w);
    },
  });
}

type Rect = { x: number; y: number; width: number; height: number };
type Xform = { scos: number; ssin: number; tx: number; ty: number };

let calls = 0;
function call(name: string): void {
  calls++;
  h.str(name);
}

const recorder = {
  save: () => call('save'),
  restore: () => call('restore'),
  translate: (dx: number, dy: number) => {
    call('translate');
    nums([dx, dy]);
  },
  rotate: (deg: number, rx: number, ry: number) => {
    call('rotate');
    nums([deg, rx, ry]);
  },
  scale: (sx: number, sy: number) => {
    call('scale');
    nums([sx, sy]);
  },
  drawPicture: (p: object) => {
    call('drawPicture');
    h.str(nameOf(p));
  },
  drawRect: (r: Rect, paint: object) => {
    call('drawRect');
    nums([r.x, r.y, r.width, r.height]);
    h.str(nameOf(paint));
  },
  drawCircle: (cx: number, cy: number, radius: number, paint: object) => {
    call('drawCircle');
    nums([cx, cy, radius]);
    h.str(nameOf(paint));
  },
  drawLine: (x0: number, y0: number, x1: number, y1: number, paint: object) => {
    call('drawLine');
    nums([x0, y0, x1, y1]);
    h.str(nameOf(paint));
  },
  drawPath: (path: object, paint: object) => {
    call('drawPath');
    h.str(nameOf(path));
    h.str(nameOf(paint));
  },
  drawText: (text: string, x: number, y: number, paint: object, font: object) => {
    call('drawText');
    h.str(text);
    nums([x, y]);
    h.str(nameOf(paint));
    h.str(nameOf(font));
  },
  drawAtlas: (...args: unknown[]) => {
    call('drawAtlas');
    h.num(args.length);
    const [image, srcs, dsts, paint, blend, colors] = args as [object, object[], Xform[], object, number?, number[][]?];
    h.str(nameOf(image));
    h.num(srcs.length);
    for (const src of srcs) h.str(nameOf(src));
    h.num(dsts.length);
    for (const d of dsts) nums([d.scos, d.ssin, d.tx, d.ty]);
    h.str(nameOf(paint));
    if (args.length > 4) h.num(blend ?? NaN);
    if (colors) {
      h.num(colors.length);
      for (const c of colors) nums(c);
    }
  },
};
const canvas = recorder as unknown as SkCanvas;

/** A sheet cell with its own size, so a sprite swapped for another changes the transforms too. */
let cells = 0;
function cell(name: string): Sprite {
  cells++;
  return named(name, { x: cells * 11, y: cells * 7, width: 18 + cells, height: 24 + cells, ry: 4 + cells });
}

function stubKit(n: number): Kit {
  const fill = fillPlan(n);
  cells = 0;
  const W = 390;
  const H = 844;
  const kit = {
    width: W,
    height: H,
    bounds: { x: 0, y: 0, width: W, height: H },
    sheet: {
      width: 512,
      height: 512,
      zero: [0, 1, 2, 3].map((i) => cell(`zero${i}`)),
      armored: [0, 1, 2, 3].map((i) => cell(`armored${i}`)),
      bullets: [0, 1, 2].map((i) => cell(`bullet${i}`)),
      badges: [0, 1, 2, 3].map((i) => cell(`badge${i}`)),
      glyph: cell('glyph'),
      fx: { dot: cell('dot'), confetti: cell('confetti'), ring: cell('ring') },
    },
    background: named('background', {}),
    turretBase: named('turretBase', {}),
    paints: {
      sprite: stubPaint('sprite'),
      fill: stubPaint('fill'),
      stroke: stubPaint('stroke'),
      glowFill: stubPaint('glowFill'),
      spriteAdd: stubPaint('spriteAdd'),
      glowStroke: stubPaint('glowStroke'),
      fillGlow: stubPaint('fillGlow'),
      overlayStroke: stubPaint('overlayStroke'),
      overlayFill: stubPaint('overlayFill'),
    },
    overlay: fill.overlayNumber ? { label: n.toLocaleString('en-US'), font: named('font', {}), x: -150, y: 40 } : null,
    blend: { modulate: 7 },
    palette: [
      [1, 0.71, 0.18, 1],
      [1, 0.31, 0.43, 1],
      [0.25, 0.86, 0.8, 1],
      [0.96, 0.94, 0.9, 1],
    ],
    colors: { fg: [0.96, 0.94, 0.9, 1], amber: [1, 0.71, 0.18, 1], teal: [0.25, 0.86, 0.8, 1], panel2: [0.15, 0.17, 0.41, 1] },
  };
  return kit as unknown as Kit;
}

function fingerprint(n: number): string[] {
  const kit = stubKit(n);
  const atlas = named('atlas', { width: 512, height: 512 }) as unknown as SkImage;
  const sc = makeScratch();
  const lines: string[] = [];
  const due = makeCheckpoints();
  h = makeHasher();
  runScript(scriptConfig(n), PRESS, (s, f) => {
    calls = 0;
    drawScene(canvas, s, kit, atlas, sc);
    if (due(s, f)) lines.push(`f${f} ${s.phase} calls=${calls} h=${h.hex()}`);
  });
  return lines;
}

const GOLDEN: Record<(typeof ROUNDS)[number], string[]> = {
  7: [
    'f0 play calls=18 h=839e5507',
    'f5 play calls=26 h=911d9be9',
    'f99 play calls=30 h=b850ddd7',
    'f199 play calls=25 h=8144982b',
    'f254 celebrate calls=26 h=e6dff8fb',
    'f259 celebrate calls=26 h=43c9e86b',
    'f299 celebrate calls=19 h=4cab72a8',
    'f302 fill calls=9 h=bc4b58bb',
    'f307 fill calls=8 h=0854bbe5',
    'f399 fill calls=7 h=1a7a58b6',
    'f445 done calls=7 h=794340bb',
    'f450 done calls=7 h=535cedde',
    'f499 done calls=7 h=b5f06363',
    'f599 done calls=7 h=1faf4396',
    'f699 done calls=7 h=43bf8986',
    'f799 done calls=7 h=53938052',
    'f899 done calls=7 h=09335991',
    'f999 done calls=7 h=12bfd7be',
    'f1099 done calls=7 h=588340e7',
    'f1199 done calls=7 h=11f885dc',
  ],
  60: [
    'f0 play calls=18 h=065e0299',
    'f5 play calls=18 h=c409c54c',
    'f99 play calls=24 h=0208d934',
    'f199 play calls=26 h=4748c9ba',
    'f299 play calls=18 h=3bc4bacf',
    'f399 play calls=19 h=7780ed4c',
    'f480 celebrate calls=26 h=2499cc9e',
    'f485 celebrate calls=24 h=835d800f',
    'f499 celebrate calls=24 h=67a235a8',
    'f528 fill calls=10 h=d3b0fc1e',
    'f533 fill calls=8 h=5a826608',
    'f599 fill calls=7 h=625d5bef',
    'f689 done calls=7 h=f10daf20',
    'f694 done calls=7 h=851380d8',
    'f699 done calls=7 h=e0c6da81',
    'f799 done calls=7 h=62e9de13',
    'f899 done calls=7 h=2e2fd700',
    'f999 done calls=7 h=b3e21ecf',
    'f1099 done calls=7 h=ddc7e4d7',
    'f1199 done calls=7 h=dddc1bfc',
  ],
  250: [
    'f0 play calls=18 h=eac8ec2e',
    'f5 play calls=28 h=a6d3869b',
    'f99 play calls=68 h=48a854bf',
    'f199 play calls=64 h=497d67c6',
    'f299 play calls=111 h=af46e0b2',
    'f399 play calls=43 h=0e443a4b',
    'f480 celebrate calls=26 h=e1bf5043',
    'f485 celebrate calls=25 h=0cf83d18',
    'f499 celebrate calls=25 h=b11b64d8',
    'f528 fill calls=10 h=78ed9517',
    'f533 fill calls=9 h=5f4fce5e',
    'f599 fill calls=7 h=f004a09c',
    'f689 done calls=7 h=2c79986b',
    'f694 done calls=7 h=05f7e4ae',
    'f699 done calls=7 h=ab64462b',
    'f799 done calls=7 h=cd7f19c6',
    'f899 done calls=7 h=cb17482a',
    'f999 done calls=7 h=f3ff5800',
    'f1099 done calls=7 h=d73611b8',
    'f1199 done calls=7 h=049f9fc5',
  ],
  1000: [
    'f0 play calls=18 h=9f45ce7a',
    'f5 play calls=32 h=59824527',
    'f99 play calls=100 h=996dd80c',
    'f199 play calls=99 h=85696a99',
    'f299 play calls=150 h=55a06517',
    'f399 play calls=257 h=af46e51b',
    'f499 play calls=49 h=5604454c',
    'f599 play calls=22 h=454fa0a7',
    'f699 play calls=20 h=a51aa4ef',
    'f799 play calls=20 h=13d342fc',
    'f899 play calls=18 h=2008c1ba',
    'f900 celebrate calls=23 h=990c3940',
    'f905 celebrate calls=23 h=7ec9da47',
    'f949 fill calls=9 h=0b61759d',
    'f954 fill calls=9 h=401fbace',
    'f999 fill calls=7 h=304e67c6',
    'f1099 fill calls=13 h=71d85b03',
    'f1111 done calls=13 h=abcee7e7',
    'f1116 done calls=13 h=b5bb2c9d',
    'f1199 done calls=13 h=288e6b72',
  ],
};

describe('the Shooter, drawn as it shipped', () => {
  it.each(ROUNDS)('Day %i looks exactly as it did', (n) => {
    expect(fingerprint(n)).toEqual(GOLDEN[n]);
  });
});
