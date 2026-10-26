// Slice (SPEC 9): zeros are tossed up from the bottom edge a few at a time, a swipe cuts them,
// a cut juggles a tough zero higher until it pops, and a zero that falls back unsliced is tossed
// again. Each power-up is a weapon tier; late in the round, the blade reaches further.
import { describe, expect, it } from '@jest/globals';

import { dropBomb } from '../../bomb';
import { finishAll } from '../../finish';
import { hittable } from '../../hit';
import { pointerDown, pointerMove, pointerUp } from '../../input';
import { step } from '../../step';
import type { GameState, SliceState, Zero } from '../../types';
import { modeGame, run } from '../../__tests__/fixtures';
import {
  SLICE_AIRBORNE,
  SLICE_ASSIST_REACH,
  SLICE_COOLDOWN,
  SLICE_FIRST_TOSS,
  SLICE_POWER,
  SLICE_STAGGER,
  SLICE_SWISH_MIN,
  SLICE_TWIN_GAP,
} from '../slice';

const DT = 1 / 60;

function ss(s: GameState): SliceState {
  if (s.modeState.mode !== 'slice') throw new Error('not a Slice round');
  return s.modeState;
}

/** The zeros in the air. */
const airborne = (s: GameState) => s.zeros.filter((z, i) => z.alive && ss(s).launched[i]);

/** Run until a zero is up in the air, and hold it there, still, at (x, y). */
function hanging(s: GameState, x: number, y: number): Zero {
  for (let f = 0; f < 120 && airborne(s).length === 0; f++) step(s, DT);
  run(s, 0.4); // popped in
  const z = airborne(s)[0]!;
  z.x = x;
  z.y = y;
  z.vx = 0;
  z.vy = 0;
  return z;
}

/** A stroke from (x1, y) to (x2, y). */
function stroke(s: GameState, x1: number, x2: number, y: number): void {
  pointerDown(s, x1, y);
  pointerMove(s, x2, y);
}

describe('a Slice round', () => {
  it('starts with every zero waiting on the bottom edge, out of sight and out of reach', () => {
    for (const n of [1, 7, 60, 1000]) {
      const s = modeGame('slice', n);
      for (const z of s.zeros) {
        expect(z.y).toBeCloseTo(s.bottom - z.ry);
        expect(z.x).toBeGreaterThanOrEqual(z.rx);
        expect(z.x).toBeLessThanOrEqual(s.width - z.rx);
        expect(hittable(z)).toBe(false);
      }
    }
  });

  it(`tosses zeros up a few at a time, keeping ${SLICE_AIRBORNE} in the air, each peaking inside the board`, () => {
    const s = modeGame('slice', 60);
    run(s, SLICE_FIRST_TOSS - DT);
    expect(airborne(s)).toHaveLength(0);
    run(s, SLICE_AIRBORNE * SLICE_STAGGER + 0.1);
    expect(airborne(s).length).toBe(SLICE_AIRBORNE);
    for (let f = 0; f < 300; f++) {
      step(s, DT);
      for (const z of s.zeros) if (hittable(z)) expect(z.y).toBeGreaterThanOrEqual(s.top + z.ry - 1e-9);
    }
  });

  it('tosses again a zero that falls back unsliced', () => {
    const s = modeGame('slice', 8);
    run(s, 1);
    const i = s.zeros.findIndex((z, k) => z.alive && ss(s).launched[k]);
    let landed = false;
    for (let f = 0; f < 600 && !landed; f++) {
      step(s, DT);
      landed = !ss(s).launched[i];
    }
    expect(landed).toBe(true);
    expect(s.zeros[i]!.alive).toBe(true);
    let again = false;
    for (let f = 0; f < 600 && !again; f++) {
      step(s, DT);
      again = ss(s).launched[i]!;
    }
    expect(again).toBe(true);
  });
});

describe('cutting', () => {
  it('cuts a zero the stroke crosses', () => {
    const s = modeGame('slice', 60);
    const z = hanging(s, 200, 300);
    stroke(s, 100, 300, 300);
    expect(z.alive).toBe(false);
  });

  it('misses one it passes by, and never cuts on touch-down alone', () => {
    const s = modeGame('slice', 60);
    const z = hanging(s, 200, 300);
    pointerDown(s, 200, 300);
    stroke(s, 100, 300, 200);
    expect(z.alive).toBe(true);
  });

  it('juggles a tough zero higher with each cut, once per stroke, until it pops', () => {
    const s = modeGame('slice', 7); // 3 HP each
    const z = hanging(s, 200, 400);
    stroke(s, 100, 300, 400);
    expect(z.hp).toBe(2);
    const first = z.vy;
    expect(first).toBeLessThan(0);
    pointerMove(s, 100, 400); // straight back through it, too soon
    expect(z.hp).toBe(2);
    run(s, SLICE_COOLDOWN + DT);
    z.y = 400;
    z.vy = 0;
    pointerMove(s, 300, 400);
    expect(z.hp).toBe(1);
    expect(z.vy).toBeLessThan(first);
    run(s, SLICE_COOLDOWN + DT);
    z.y = 400;
    pointerMove(s, 100, 400);
    expect(z.alive).toBe(false);
  });

  it('cuts on from where the finger rested, however long it stayed still', () => {
    const s = modeGame('slice', 60);
    pointerDown(s, 100, 300);
    run(s, 2); // the trail fades meanwhile
    const z = hanging(s, 200, 300);
    pointerMove(s, 300, 300);
    expect(z.alive).toBe(false);
  });

  it(`swishes once for every ${SLICE_SWISH_MIN} points the blade sweeps`, () => {
    const s = modeGame('slice', 60);
    pointerDown(s, 10, 200);
    let swishes = 0;
    for (let x = 30; x <= 10 + SLICE_SWISH_MIN * 2 + 5; x += 20) {
      pointerMove(s, x, 200);
      swishes += s.report.swishes;
      s.report.swishes = 0;
    }
    expect(swishes).toBe(2);
    pointerUp(s);
  });
});

describe('power-ups', () => {
  it('match the engine’s tiers, one per weapon', () => {
    expect(Object.keys(SLICE_POWER).sort()).toEqual(['chain', 'laser', 'nuke', 'pea', 'rocket', 'scatter', 'twin']);
  });

  it('Twin Blade: a second blade beside the stroke', () => {
    for (const [weapon, cut] of [
      ['pea', false],
      ['twin', true],
    ] as const) {
      const s = modeGame('slice', 60, { weapon });
      const z = hanging(s, 200, 300);
      const beside = z.ry + 6 + SLICE_TWIN_GAP / 2 - 2; // just past the padded edge, inside the twin's reach
      stroke(s, 100, 300, 300 - beside);
      expect(z.alive).toBe(!cut);
    }
  });

  it('Wide Arc and Nova reach further past the edge', () => {
    for (const [weapon, cut] of [
      ['pea', false],
      ['scatter', true],
      ['nuke', true],
    ] as const) {
      const s = modeGame('slice', 60, { weapon });
      const z = hanging(s, 200, 300);
      stroke(s, 100, 300, 300 - (Math.max(z.ry, 14) + 6 + 10));
      expect(z.alive).toBe(!cut);
    }
  });

  it('Explosive Cut splashes, and Arcing Cut throws lightning', () => {
    const rocket = modeGame('slice', 60, { weapon: 'rocket' });
    hanging(rocket, 200, 300);
    stroke(rocket, 100, 300, 300);
    expect(rocket.report.blasts).toBe(1);
    const chain = modeGame('slice', 60, { weapon: 'chain' });
    hanging(chain, 200, 300);
    stroke(chain, 100, 300, 300);
    expect(chain.bolts.count).toBeGreaterThan(0);
  });

  it('Lingering Blade: the trail keeps cutting after the finger has passed', () => {
    for (const [weapon, cut] of [
      ['pea', false],
      ['laser', true],
    ] as const) {
      const s = modeGame('slice', 60, { weapon });
      const z = hanging(s, 200, 150);
      stroke(s, 100, 300, 300); // under it
      z.y = 300; // it drops into the trail
      step(s, DT);
      expect(z.alive).toBe(!cut);
    }
  });
});

describe('the late-round assist', () => {
  it(`lets the blade reach ${SLICE_ASSIST_REACH} points further once only a few are left`, () => {
    const s = modeGame('slice', 60);
    const z = hanging(s, 200, 300);
    for (const other of s.zeros) if (other !== z) other.alive = false;
    s.valueLeft = 1;
    step(s, DT);
    expect(ss(s).assist).toBe(true);
    stroke(s, 100, 300, 300 - (Math.max(z.ry, 14) + 6 + SLICE_ASSIST_REACH - 4));
    expect(z.alive).toBe(false);
  });
});

describe('bombs and Finish round', () => {
  it('a bomb tosses the zeros it reaches that were waiting, and that it didn’t destroy', () => {
    const s = modeGame('slice', 1000); // 12 HP: more than a bomb's
    expect(dropBomb(s)).toBe(true);
    step(s, DT);
    expect(airborne(s).length).toBeGreaterThan(SLICE_AIRBORNE);
  });

  it('Finish round clears the board into the celebration', () => {
    const s = modeGame('slice', 1000);
    run(s, 1);
    expect(finishAll(s)).toBe(true);
    expect(s.valueLeft).toBe(0);
    expect(s.phase).toBe('celebrate');
  });
});
