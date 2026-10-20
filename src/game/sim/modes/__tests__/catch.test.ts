// Catch (SPEC 9): zeros drift down, cups at the bottom catch them, multi-hit zeros are juggled
// until they pop, and a missed zero floats back up. Each power-up is a weapon tier, and the
// assists make sure a cup that never moves still catches everything.
import { describe, expect, it } from '@jest/globals';

import { weaponById } from '@/engine';

import { dropBomb } from '../../bomb';
import { finishAll } from '../../finish';
import { pointerDown, pointerMove, pointerUp, setWeapon } from '../../input';
import { step } from '../../step';
import type { CatchState, GameState, Zero } from '../../types';
import { modeGame, only, popIn, run } from '../../__tests__/fixtures';
import {
  CATCH_ASSIST_MISSES,
  CATCH_DRIFT,
  CATCH_FLOAT,
  CATCH_JUGGLE,
  CATCH_POWER,
  CATCH_START_SHARE,
  CUP_SPEED,
  CUP_TWIN_GAP,
  cupMid,
} from '../catch';

const DT = 1 / 60;

function cs(s: GameState): CatchState {
  if (s.modeState.mode !== 'catch') throw new Error('not a Catch round');
  return s.modeState;
}

/** Put zero `z` just above the rim at x, falling. */
function aboutToLand(s: GameState, z: Zero, x: number): void {
  z.x = x;
  z.y = s.bottom - z.ry - 1;
  z.vx = 0;
  z.vy = 200;
}

/** Step until zero `i` changes how it moves, or `seconds` pass. */
function until(s: GameState, test: () => boolean, seconds = 20): void {
  for (let f = 0; f < seconds * 60 && !test(); f++) step(s, DT);
}

describe('a Catch round', () => {
  it('starts with every zero in the top of the board, drifting down, and the cups in the middle', () => {
    for (const n of [1, 7, 60, 250, 1000]) {
      const s = modeGame('catch', n);
      expect(s.mode).toBe('catch');
      expect(cs(s).cupX).toBe(s.width / 2);
      for (const z of s.zeros) {
        expect(z.x).toBeGreaterThanOrEqual(z.rx);
        expect(z.x).toBeLessThanOrEqual(s.width - z.rx);
        expect(z.y).toBeGreaterThanOrEqual(s.top + z.ry);
        expect(z.y).toBeLessThanOrEqual(s.top + z.ry + (s.bottom - s.top - 2 * z.ry) * CATCH_START_SHARE);
        expect(z.vy).toBeGreaterThan(0);
      }
    }
  });

  it('drifts armored zeros down slower', () => {
    const s = modeGame('catch', 250);
    const speed = (kind: string) => {
      const falls = s.zeros.map((z, i) => ({ z, fall: cs(s).fall[i]! })).filter(({ z }) => z.kind === kind);
      return falls.reduce((sum, f) => sum + f.fall, 0) / falls.length;
    };
    expect(speed('armored')).toBeLessThan(speed('standard'));
  });
});

describe('the cups', () => {
  it('glide toward the finger at their top speed, and stay where it lifts', () => {
    const s = modeGame('catch', 60);
    pointerDown(s, 20, 400);
    step(s, DT);
    expect(cs(s).cupX).toBeCloseTo(s.width / 2 - CUP_SPEED * s.width * DT);
    run(s, 1);
    expect(cs(s).cupX).toBeCloseTo(cs(s).half); // the wall stops it
    pointerMove(s, s.width - 100, 400);
    pointerUp(s);
    run(s, 1);
    expect(cs(s).cupX).toBeCloseTo(s.width - 100);
  });

  it('stay in the middle while nobody touches the board', () => {
    const s = modeGame('catch', 60);
    run(s, 3);
    expect(cs(s).cupX).toBe(s.width / 2);
  });
});

describe('catching', () => {
  it('hits a zero that lands in a cup: a standard zero goes', () => {
    const s = modeGame('catch', 60);
    popIn(s);
    const z = only(s, 0);
    aboutToLand(s, z, s.width / 2);
    step(s, DT);
    expect(z.alive).toBe(false);
    expect(s.report.bounces).toBe(1);
    expect(s.valueLeft).toBe(0);
    expect(s.phase).toBe('celebrate');
  });

  it('juggles a tough zero in its cup until it pops, wherever the cup goes', () => {
    const s = modeGame('catch', 7); // 3 HP each
    popIn(s);
    const z = only(s, 0);
    aboutToLand(s, z, s.width / 2);
    step(s, DT);
    expect(z.hp).toBe(2);
    expect(cs(s).motion[0]).toBe(CATCH_JUGGLE);
    expect(z.vy).toBeLessThan(0);
    pointerDown(s, 60, 400); // the cup slides away; the zero goes with it
    until(s, () => !z.alive);
    expect(z.alive).toBe(false);
    expect(cs(s).misses[0]).toBe(0);
  });

  it('floats a missed zero back up, then lets it drift down again', () => {
    const s = modeGame('catch', 60);
    popIn(s);
    const z = s.zeros[0]!;
    aboutToLand(s, z, 30);
    step(s, DT);
    expect(z.alive).toBe(true);
    expect(cs(s).motion[0]).toBe(CATCH_FLOAT);
    expect(cs(s).misses[0]).toBe(1);
    until(s, () => cs(s).motion[0] === CATCH_DRIFT, 3);
    expect(cs(s).motion[0]).toBe(CATCH_DRIFT);
    expect(z.y).toBeLessThan((s.top + s.bottom) / 2);
  });

  it(`steers a zero missed ${CATCH_ASSIST_MISSES} times into a cup that never moves`, () => {
    const landing = (misses: number) => {
      const s = modeGame('catch', 60);
      popIn(s);
      const z = s.zeros[0]!;
      cs(s).misses[0] = misses;
      z.x = 30;
      z.y = s.bottom - z.ry - 100;
      z.vx = 0;
      until(s, () => !z.alive || cs(s).motion[0] === CATCH_FLOAT, 5);
      return z.alive ? 'missed' : 'caught';
    };
    expect(landing(0)).toBe('missed');
    expect(landing(CATCH_ASSIST_MISSES)).toBe('caught');
  });

  it('steers every zero in once only a few are left', () => {
    const s = modeGame('catch', 60);
    popIn(s);
    for (let j = 3; j < s.zeros.length; j++) s.zeros[j]!.alive = false;
    s.valueLeft = 3;
    s.zeros.slice(0, 3).forEach((z, k) => {
      z.x = k === 1 ? s.width - 30 : 30;
    });
    until(s, () => s.phase !== 'play', 30);
    expect(s.valueLeft).toBe(0);
  });
});

describe('power-ups', () => {
  it('match the engine’s tiers, one per weapon', () => {
    expect(Object.keys(CATCH_POWER).sort()).toEqual(['chain', 'laser', 'nuke', 'pea', 'rocket', 'scatter', 'twin']);
  });

  it('Twin Cups: two cups, either of which catches', () => {
    const s = modeGame('catch', 60, { weapon: 'twin' });
    step(s, DT);
    expect(cs(s).cups).toBe(2);
    expect(cs(s).gap).toBeCloseTo(CUP_TWIN_GAP * cs(s).half);
    popIn(s);
    const z = only(s, 0);
    aboutToLand(s, z, cupMid(cs(s), 1));
    step(s, DT);
    expect(z.alive).toBe(false);
  });

  it('Net: one wider cup', () => {
    const pea = modeGame('catch', 60);
    const net = modeGame('catch', 60, { weapon: 'scatter' });
    step(pea, DT);
    step(net, DT);
    expect(net.modeState.mode === 'catch' && net.modeState.half).toBeGreaterThan(cs(pea).half * 2);
  });

  it('switches mid-round: the cups change on the next frame', () => {
    const s = modeGame('catch', 60);
    step(s, DT);
    expect(cs(s).cups).toBe(1);
    setWeapon(s, weaponById('twin'));
    step(s, DT);
    expect(cs(s).cups).toBe(2);
  });

  it('Magnet: pulls a nearby zero into the cup, and splashes its neighbors', () => {
    const s = modeGame('catch', 60, { weapon: 'rocket' });
    popIn(s);
    const z = only(s, 0);
    const neighbor = s.zeros[1]!;
    neighbor.alive = true;
    s.valueLeft = 2;
    z.x = s.width / 2 + cs(s).half + 40; // beside the cup, inside the magnet's reach
    z.y = s.bottom - z.ry - 120;
    neighbor.x = s.width / 2 + 20;
    neighbor.y = s.bottom - neighbor.ry - 30;
    neighbor.vy = 0;
    until(s, () => !z.alive, 5);
    expect(z.alive).toBe(false);
    expect(neighbor.alive).toBe(false); // the Rocket's splash
  });

  it('Chain Catch: a catch throws lightning', () => {
    const s = modeGame('catch', 60, { weapon: 'chain' });
    popIn(s);
    aboutToLand(s, s.zeros[0]!, s.width / 2);
    step(s, DT);
    expect(s.bolts.count).toBeGreaterThan(0);
  });

  it('Vacuum Beam: while the finger is down, zeros over the cup fall fast', () => {
    const drift = modeGame('catch', 60, { weapon: 'laser' });
    const vacuum = modeGame('catch', 60, { weapon: 'laser' });
    for (const s of [drift, vacuum]) {
      popIn(s);
      const z = only(s, 0);
      z.x = s.width / 2;
      z.y = s.top + 100;
    }
    pointerDown(vacuum, vacuum.width / 2, 300);
    run(drift, 0.5);
    run(vacuum, 0.5);
    expect(cs(vacuum).pulling).toBe(true);
    expect(vacuum.zeros[0]!.y).toBeGreaterThan(drift.zeros[0]!.y + 100);
  });

  it('Black Hole: draws zeros in from across the board', () => {
    const s = modeGame('catch', 60, { weapon: 'nuke' });
    popIn(s);
    const z = only(s, 0);
    z.x = z.rx;
    z.y = s.top + z.ry;
    until(s, () => !z.alive, 10);
    expect(z.alive).toBe(false);
    expect(cs(s).misses[0]).toBe(0);
  });
});

describe('bombs and Finish round', () => {
  it('a bomb blasts the middle of the board', () => {
    const s = modeGame('catch', 60);
    popIn(s);
    expect(dropBomb(s)).toBe(true);
    expect(s.valueLeft).toBeLessThan(60);
  });

  it('Finish round clears the board into the celebration', () => {
    const s = modeGame('catch', 1000);
    run(s, 1);
    expect(finishAll(s)).toBe(true);
    expect(s.valueLeft).toBe(0);
    expect(s.phase).toBe('celebrate');
  });
});
