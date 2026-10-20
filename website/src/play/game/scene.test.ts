// The shared round, drawn through the canvas stand-in, from the first frame to the result
// sheet: every weapon, a bomb, then Finish round and the celebration fill (with the big number
// on top). This is where the website adds risk to the app's sim and drawing code.
import { describe, expect, it } from 'vitest';

import { composeRound, fillPlan, unlockedWeapons, type FillPlan } from '@/engine';
import { drawScene, makeScratch } from '@/game/draw/scene';
import type { Kit, Sprite } from '@/game/draw/types';
import { dropBomb } from '@/game/sim/bomb';
import { finishAll } from '@/game/sim/finish';
import { moveAim, pressFire, releaseFire, setWeapon } from '@/game/sim/input';
import { resetReport } from '@/game/sim/report';
import { createGame } from '@/game/sim/spawn';
import { step } from '@/game/sim/step';
import { colors, zeroPalette } from '@/theme/tokens';

import { rgba } from './bake';
import { Canvas2D, rgbKey, WebPaint, type TintTable } from './skia/canvas';
import { FakeContext } from './skia/fakeContext';

const W = 390;
const H = 844;
const cell = (ry = 10): Sprite => ({ x: 0, y: 0, width: 20, height: 28, ry });

function stubKit(n: number, fill: FillPlan, tints: TintTable): Kit {
  const tintAll = (s: Sprite, palette: readonly string[]) => {
    tints.set(s, new Map(palette.map((hex) => {
      const [r = 0, g = 0, b = 0] = rgba(hex);
      return [rgbKey(r, g, b), {} as CanvasImageSource] as const;
    })));
    return s;
  };
  const zero = zeroPalette.map(() => cell());
  const armored = zeroPalette.map(() => cell());
  tintAll(zero[3]!, [colors.fg]);
  tintAll(armored[3]!, [colors.fg]);
  return {
    width: W,
    height: H,
    bounds: { x: 0, y: 0, width: W, height: H },
    sheet: {
      width: 100,
      height: 100,
      zero,
      armored,
      bullets: [cell(1), cell(1), cell(1)],
      badges: Array.from({ length: 8 }, () => cell(1)),
      glyph: tintAll(cell(40), zeroPalette),
      fx: { dot: tintAll(cell(8), zeroPalette), confetti: tintAll(cell(16), zeroPalette), ring: tintAll(cell(12), zeroPalette) },
    },
    background: { image: {} as CanvasImageSource, width: W, height: H },
    turretBase: {} as Path2D,
    paints: {
      sprite: new WebPaint(),
      fill: new WebPaint(),
      stroke: new WebPaint({ style: 'stroke' }),
      glowFill: new WebPaint({ additive: true }),
      spriteAdd: new WebPaint({ additive: true }),
      glowStroke: new WebPaint({ style: 'stroke', additive: true, cap: 'round' }),
      fillGlow: new WebPaint({ shader: {} as CanvasGradient }),
      overlayStroke: new WebPaint({ style: 'stroke', color: rgba(colors.ink), strokeWidth: 8, join: 'round' }),
      overlayFill: new WebPaint({ color: rgba(colors.amber) }),
    },
    overlay: fill.overlayNumber ? { label: n.toLocaleString('en-US'), font: { css: '100px Bungee', size: 100 }, x: -150, y: 40 } : null,
    blend: { modulate: 0 },
    palette: zeroPalette.map((c) => rgba(c)),
    colors: { fg: rgba(colors.fg), shot: rgba(colors.amber), chain: rgba(colors.teal), panel2: rgba(colors.panel2) },
  };
}

function playThrough(n: number) {
  const fill = fillPlan(n);
  const tints: TintTable = new Map();
  const kit = stubKit(n, fill, tints);
  const weapons = unlockedWeapons(100);
  const s = createGame({
    n,
    groups: composeRound(n).groups,
    fill,
    width: W,
    height: H,
    insetTop: 0,
    insetBottom: 0,
    weapon: weapons[0]!,
    seed: 1234,
    reduceMotion: false,
  });
  const ctx = new FakeContext();
  const canvas = new Canvas2D(ctx as unknown as CanvasRenderingContext2D, tints);
  const scratch = makeScratch();
  const phases = new Set<string>();
  let showResult = false;
  const frame = () => {
    step(s, 1 / 60);
    ctx.setTransform(2, 0, 0, 2, 0, 0);
    drawScene(canvas, s, kit, kit.sheet, scratch);
    expect(ctx.depth).toBe(0);
    phases.add(s.phase);
    if (s.report.showResult) showResult = true;
    resetReport(s.report);
  };

  pressFire(s, W / 2, H * 0.3);
  for (const w of weapons) {
    setWeapon(s, w);
    for (let i = 0; i < 40; i++) {
      moveAim(s, W * (0.1 + 0.8 * ((i % 10) / 10)), H * 0.3);
      frame();
    }
  }
  releaseFire(s);
  dropBomb(s);
  for (let i = 0; i < 20; i++) frame();
  finishAll(s);
  for (let i = 0; i < 60 * 30 && !showResult; i++) frame();
  for (let i = 0; i < 30; i++) frame();
  return { ctx, canvas, phases, showResult, kit };
}

describe('the round, drawn on the web', () => {
  it.each([1, 30, 100, 1000])('plays a Day %i round through to the result sheet', (n) => {
    const { ctx, canvas, phases, showResult, kit } = playThrough(n);
    expect(showResult).toBe(true);
    expect([...phases]).toEqual(expect.arrayContaining(['play', 'celebrate', 'fill', 'done']));
    expect(canvas.tintMisses).toBe(0);
    expect(ctx.depth).toBe(0);
    const ops = new Set(ctx.drawn.map((d) => d.op));
    expect(ops).toContain('drawImage');
    if (kit.overlay) expect(ops).toContain('strokeText');
    // Additive effects use lighter; nothing leaves an unknown blend.
    expect(new Set(ctx.drawn.map((d) => d.composite))).toEqual(new Set(['source-over', 'lighter']));
  });
});
