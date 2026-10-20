// Each game mode draws what the player plays with (Catch's cups, …) while the round is played and
// celebrated, through only the calls the website's stand-in canvas has, and nothing of it over the
// fill. The canvas here records each call by name and throws on any other.
import { describe, expect, it } from '@jest/globals';
import type { SkCanvas, SkImage } from '@shopify/react-native-skia';

import type { ModeId, WeaponId } from '@/engine';

import { pointerDown, pointerMove } from '../../sim/input';
import { step } from '../../sim/step';
import type { GameState } from '../../sim/types';
import { modeGame, popIn } from '../../sim/__tests__/fixtures';
import { drawScene, makeScratch } from '../scene';
import type { Kit, Sprite } from '../types';

/** The calls the website's stand-in canvas has (website/src/play/game/skia/types.ts). */
const STAND_IN = ['save', 'restore', 'translate', 'rotate', 'scale', 'drawPicture', 'drawRect', 'drawCircle', 'drawLine', 'drawPath', 'drawText', 'drawAtlas'];

function recorder(): { canvas: SkCanvas; calls: string[] } {
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

const paint = () => ({ setColor: () => {}, setAlphaf: () => {}, setStrokeWidth: () => {} });
const sprite = (): Sprite => ({ x: 0, y: 0, width: 10, height: 10, ry: 5 });

function stubKit(s: GameState): Kit {
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
    },
    background: {},
    turretBase: {},
    paints: {
      sprite: paint(),
      fill: paint(),
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

const ATLAS = { width: 64, height: 64 } as unknown as SkImage;

function draw(s: GameState): string[] {
  const { canvas, calls } = recorder();
  drawScene(canvas, s, stubKit(s), ATLAS, makeScratch());
  return calls;
}

/** The same frame, drawn as if the round were the Shooter's. */
function drawnAsShooter(s: GameState): string[] {
  const mode = s.mode;
  s.mode = 'shooter';
  const calls = draw(s);
  s.mode = mode;
  return calls;
}

const MODES: readonly { mode: ModeId; tiers: WeaponId[] }[] = [
  { mode: 'catch', tiers: ['pea', 'twin', 'rocket', 'laser', 'nuke'] },
  { mode: 'orbit', tiers: ['pea', 'laser', 'nuke'] },
  { mode: 'slice', tiers: ['pea', 'twin', 'laser'] },
  { mode: 'breaker', tiers: ['pea', 'scatter', 'rocket', 'chain', 'laser', 'nuke'] },
];

/** A finger on the board, sliding: every mode has something to show for it. */
function play(s: GameState): void {
  pointerDown(s, s.width / 3, s.height / 2);
  for (let f = 0; f < 30; f++) {
    pointerMove(s, s.width / 3 + f * 6, s.height / 2 - f * 2);
    step(s, 1 / 60);
  }
}

describe.each(MODES)('$mode', ({ mode, tiers }) => {
  it.each(tiers)('draws its own pieces in play with the %s tier, not the turret', (tier) => {
    const s = modeGame(mode, 60, { weapon: tier });
    popIn(s);
    play(s);
    const calls = draw(s);
    expect(calls.length).toBeGreaterThan(0);
    expect(calls).not.toEqual(drawnAsShooter(s));
  });

  it('draws its pieces through the celebration, and nothing of them over the fill', () => {
    const s = modeGame(mode, 7);
    popIn(s);
    play(s);
    s.zeros.forEach((z) => (z.alive = false));
    s.phase = 'celebrate';
    expect(draw(s)).not.toEqual(drawnAsShooter(s));
    for (const phase of ['fill', 'done'] as const) {
      s.phase = phase;
      expect(draw(s)).toEqual(drawnAsShooter(s));
    }
  });
});
