// Catch (SPEC 9): zeros fall like floaty balls, cups at the bottom catch them, and every zero that
// lands, in a cup or beside them, bounces back up high along its own path until it pops. Each
// power-up is a weapon tier; nothing pulls a zero in but the Magnet, the Vacuum Beam and the
// Black Hole, and those only on its way down.
import { describe, expect, it } from '@jest/globals';

import { weaponById, type WeaponId } from '@/engine';

import { dropBomb } from '../../bomb';
import { finishAll } from '../../finish';
import { pointerDown, pointerMove, pointerUp, setWeapon } from '../../input';
import { step } from '../../step';
import type { CatchState, GameState, Zero } from '../../types';
import { modeGame, only, popIn, run } from '../../__tests__/fixtures';
import {
  CATCH_BOUNCE_TO_MAX,
  CATCH_BOUNCE_TO_MIN,
  CATCH_DEFLECT,
  CATCH_EDGE,
  CATCH_POWER,
  CATCH_START_SHARE,
  CUP_SPEED,
  CUP_TWIN_GAP,
  cupMid,
  landsIn,
} from '../catch';

const DT = 1 / 60;
/** How far a bounce's peak may land from its aim, in points: the frame steps round it off. */
const PEAK_SLACK = 10;

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

/** Step until `test` holds, or `seconds` pass. */
function until(s: GameState, test: () => boolean, seconds = 20): void {
  for (let f = 0; f < seconds * 60 && !test(); f++) step(s, DT);
}

/** Step until zero `z` turns at the top of its bounce, and say where it turned. */
function peak(s: GameState, z: Zero): number {
  until(s, () => z.vy >= 0, 5);
  return z.y;
}

/** Where a bounce can take zero `z`: between `high` and `low`, as y on the board. */
function bounceRange(s: GameState, z: Zero): { high: number; low: number } {
  const top = s.top + z.ry;
  const span = s.bottom - z.ry - top;
  return { high: top + span * CATCH_BOUNCE_TO_MIN - PEAK_SLACK, low: top + span * CATCH_BOUNCE_TO_MAX + PEAK_SLACK };
}

describe('a Catch round', () => {
  it('starts with every zero in the top of the board, at rest, and the cups in the middle', () => {
    for (const n of [1, 7, 60, 250, 1000]) {
      const s = modeGame('catch', n);
      expect(s.mode).toBe('catch');
      expect(cs(s).cupX).toBe(s.width / 2);
      for (const z of s.zeros) {
        expect(z.x).toBeGreaterThanOrEqual(z.rx);
        expect(z.x).toBeLessThanOrEqual(s.width - z.rx);
        expect(z.y).toBeGreaterThanOrEqual(s.top + z.ry);
        expect(z.y).toBeLessThanOrEqual(s.top + z.ry + (s.bottom - s.top - 2 * z.ry) * CATCH_START_SHARE);
        expect(z.vy).toBe(0);
      }
    }
  });

  it('flies armored zeros slower', () => {
    const s = modeGame('catch', 250);
    const pace = (kind: string) => {
      const paces = s.zeros.map((z, i) => ({ z, pace: cs(s).pace[i]! })).filter(({ z }) => z.kind === kind);
      return paces.reduce((sum, p) => sum + p.pace, 0) / paces.length;
    };
    expect(pace('armored')).toBeGreaterThan(pace('standard'));
  });

  it('drops a zero like a ball, faster as it falls, landing when landsIn says', () => {
    const s = modeGame('catch', 60);
    popIn(s);
    const z = only(s, 0);
    z.x = 30; // beside the cup, so it bounces
    z.y = s.top + z.ry;
    z.vx = 0;
    const lands = landsIn(s, cs(s), z, 0);
    run(s, 0.5);
    const early = z.vy;
    run(s, 0.5);
    expect(early).toBeGreaterThan(0);
    expect(z.vy).toBeGreaterThan(early);
    let t = 1;
    for (; t < 10 && z.vy > 0; t += DT) step(s, DT);
    expect(t).toBeCloseTo(lands, 1);
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

  it('bounces a tough zero up high off the cup, on its own path: the cup sliding away leaves it be', () => {
    const s = modeGame('catch', 7); // 3 HP each
    popIn(s);
    const z = only(s, 0);
    aboutToLand(s, z, s.width / 2);
    step(s, DT);
    expect(z.hp).toBe(2);
    expect(z.vy).toBeLessThan(0);
    pointerDown(s, 60, 400);
    const { high, low } = bounceRange(s, z);
    const top = peak(s, z);
    expect(top).toBeGreaterThanOrEqual(high);
    expect(top).toBeLessThanOrEqual(low);
    expect(z.x).toBeCloseTo(s.width / 2); // caught in the middle: straight up
  });

  it('pops a tough zero once it has been caught enough times', () => {
    const s = modeGame('catch', 7); // 3 HP each, a Cup's catch takes 1
    popIn(s);
    const z = only(s, 0);
    pointerDown(s, z.x, 400);
    for (let f = 0; f < 20 * 60 && z.alive; f++) {
      pointerMove(s, z.x, 400);
      step(s, DT);
    }
    expect(z.alive).toBe(false);
    expect(s.report.bounces).toBe(3);
  });

  it('deflects a catch off toward the side of the cup it struck', () => {
    const deflected = (off: number) => {
      const s = modeGame('catch', 7);
      popIn(s);
      const z = only(s, 0);
      aboutToLand(s, z, s.width / 2 + off * cs(s).half);
      step(s, DT);
      expect(z.alive).toBe(true);
      expect(Math.abs(z.vx)).toBeLessThanOrEqual(CATCH_DEFLECT * s.width);
      return z.vx;
    };
    expect(deflected(0.8)).toBeGreaterThan(0);
    expect(deflected(-0.8)).toBeLessThan(0);
    expect(deflected(0)).toBeCloseTo(0);
    expect(deflected(0.8)).toBeGreaterThan(deflected(0.3));
  });

  it('bounces a missed zero up high off the floor, keeping its sideways speed', () => {
    const s = modeGame('catch', 60);
    popIn(s);
    const z = only(s, 0);
    aboutToLand(s, z, 30);
    z.vx = 20;
    step(s, DT);
    expect(z.alive).toBe(true);
    expect(z.vy).toBeLessThan(0);
    expect(z.vx).toBe(20);
    const { high, low } = bounceRange(s, z);
    const top = peak(s, z);
    expect(top).toBeGreaterThanOrEqual(high);
    expect(top).toBeLessThanOrEqual(low);
  });

  it.each(['pea', 'twin', 'scatter', 'chain'] as WeaponId[])(
    'never draws a zero in with the %s’s cups, however long nobody catches it',
    (weapon) => {
      const s = modeGame('catch', 60, { weapon });
      popIn(s);
      const z = only(s, 0); // the last zero left, which an assist would once have steered in
      z.x = 30;
      z.vx = 0;
      run(s, 20);
      expect(z.alive).toBe(true);
      expect(z.x).toBeCloseTo(30);
      expect(s.sinceDamage).toBeGreaterThan(10);
    },
  );
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

  it('Magnet: pulls a falling zero beside the cup into it', () => {
    const s = modeGame('catch', 60, { weapon: 'rocket' });
    popIn(s);
    const z = only(s, 0);
    z.x = s.width / 2 + cs(s).half + 40; // beside the cup, inside the magnet's reach
    z.y = s.bottom - z.ry - 120;
    z.vx = 0;
    until(s, () => !z.alive || z.vy < 0, 5);
    expect(z.alive).toBe(false); // caught on its first landing
  });

  it('Magnet: a catch splashes the zeros beside the cup', () => {
    const s = modeGame('catch', 60, { weapon: 'rocket' });
    step(s, DT);
    popIn(s);
    const z = only(s, 0);
    const neighbor = s.zeros[1]!;
    neighbor.alive = true;
    s.valueLeft = 2;
    aboutToLand(s, z, s.width / 2);
    aboutToLand(s, neighbor, s.width / 2 + cs(s).half + CATCH_EDGE * neighbor.rx + 4); // just past the rim
    step(s, DT);
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

  it('Vacuum Beam: while the finger is down, falling zeros over the cup fall fast', () => {
    const drop = modeGame('catch', 60, { weapon: 'laser' });
    const vacuum = modeGame('catch', 60, { weapon: 'laser' });
    for (const s of [drop, vacuum]) {
      popIn(s);
      const z = only(s, 0);
      z.x = s.width / 2;
      z.y = s.top + 100;
    }
    pointerDown(vacuum, vacuum.width / 2, 300);
    run(drop, 0.25);
    run(vacuum, 0.25);
    expect(cs(vacuum).pulling).toBe(true);
    expect(vacuum.zeros[0]!.y).toBeGreaterThan(drop.zeros[0]!.y + 100);
  });

  it('Vacuum Beam: leaves a zero alone on its way back up', () => {
    const s = modeGame('catch', 7, { weapon: 'laser' }); // 3 HP each; the laser's catch takes 2
    popIn(s);
    const z = only(s, 0);
    pointerDown(s, s.width / 2, 300);
    aboutToLand(s, z, s.width / 2);
    step(s, DT);
    expect(z.hp).toBe(1);
    expect(cs(s).pulling).toBe(true);
    const { high, low } = bounceRange(s, z);
    const top = peak(s, z);
    expect(top).toBeGreaterThanOrEqual(high);
    expect(top).toBeLessThanOrEqual(low);
  });

  it('Black Hole: draws a zero in from across the board', () => {
    const s = modeGame('catch', 60, { weapon: 'nuke' });
    popIn(s);
    const z = only(s, 0);
    z.x = z.rx;
    z.y = s.top + z.ry;
    until(s, () => !z.alive || z.vy < 0, 10);
    expect(z.alive).toBe(false); // caught on its first landing
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
