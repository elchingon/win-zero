// Breaker (SPEC 9): the zeros are bricks, steel on top, with room under the ceiling, gutters by
// the walls and gaps between; balls off the paddle break them, and a dropped ball respawns and
// serves itself at a brick. Each power-up is a weapon tier.
import { describe, expect, it } from '@jest/globals';

import { weaponById } from '@/engine';

import { dropBomb } from '../../bomb';
import { MAX_DT } from '../../constants';
import { finishAll } from '../../finish';
import { hittable } from '../../hit';
import { pointerDown, pointerMove, pointerUp, setWeapon } from '../../input';
import { step } from '../../step';
import type { Ball, BreakerState, GameState } from '../../types';
import { modeGame, popIn, run } from '../../__tests__/fixtures';
import {
  BALL_R,
  BALL_SERVE_DELAY,
  BREAKER_CEILING_GAP,
  BREAKER_EMPTY_RETURNS,
  BREAKER_FIELD,
  BREAKER_GAP,
  BREAKER_GUTTER,
  BREAKER_MIN_ANGLE,
  BREAKER_POWER,
  BREAKER_SPEEDUP,
  BREAKER_SPEEDUP_MAX,
  PADDLE_SPEED,
} from '../breaker';

const DT = 1 / 60;
const ACROSS = 2 * BALL_R;

function bs(s: GameState): BreakerState {
  if (s.modeState.mode !== 'breaker') throw new Error('not a Breaker round');
  return s.modeState;
}

const ball = (s: GameState, k = 0): Ball => bs(s).ball[k]!;

/** Ball k flying from (x, y) at (vx, vy), at its own speed. */
function flying(s: GameState, x: number, y: number, vx: number, vy: number, k = 0): Ball {
  const b = ball(s, k);
  Object.assign(b, { live: true, held: false, x, y, vx, vy, speed: Math.hypot(vx, vy), returns: 0 });
  return b;
}

describe('the bricks', () => {
  it.each([1, 7, 60, 61, 250, 1000])('Day %i: stand still in the top of the board, clear of the ceiling and the walls', (n) => {
    const s = modeGame('breaker', n);
    const zeros = s.zeros.filter((z) => z.alive);
    for (const z of zeros) {
      expect(z.vx).toBe(0);
      expect(z.vy).toBe(0);
      expect(z.y - z.ry).toBeGreaterThanOrEqual(s.top + BREAKER_CEILING_GAP * ACROSS - 1e-9);
      expect(z.x - z.rx).toBeGreaterThanOrEqual(BREAKER_GUTTER * ACROSS - 1e-9);
      expect(z.x + z.rx).toBeLessThanOrEqual(s.width - BREAKER_GUTTER * ACROSS + 1e-9);
      expect(z.y + z.ry).toBeLessThanOrEqual(s.top + BREAKER_CEILING_GAP * ACROSS + (s.bottom - s.top) * BREAKER_FIELD + 1e-9);
    }
    // Room between neighbors to ricochet through.
    for (const a of zeros) {
      for (const b of zeros) {
        if (a === b || Math.abs(a.y - b.y) > 1e-6) continue;
        expect(Math.abs(a.x - b.x) - a.rx - b.rx).toBeGreaterThanOrEqual(BREAKER_GAP * ACROSS - 1e-6);
      }
    }
    run(s, 2);
    for (const z of s.zeros.filter((x) => x.alive)) expect([z.vx, z.vy]).toEqual([0, 0]);
  });

  it('puts the steel on top', () => {
    const s = modeGame('breaker', 250);
    const steel = s.zeros.filter((z) => z.kind === 'armored');
    const plain = s.zeros.filter((z) => z.kind === 'standard');
    expect(Math.max(...steel.map((z) => z.y))).toBeLessThanOrEqual(Math.min(...plain.map((z) => z.y)));
  });
});

describe('the paddle', () => {
  it('starts in the middle, glides to the finger, and stays when it lifts', () => {
    const s = modeGame('breaker', 60);
    expect(bs(s).paddleX).toBe(s.width / 2);
    pointerDown(s, 40, 300);
    step(s, DT);
    expect(bs(s).paddleX).toBeCloseTo(s.width / 2 - PADDLE_SPEED * s.width * DT);
    pointerMove(s, s.width, 300);
    pointerUp(s);
    run(s, 1);
    expect(bs(s).paddleX).toBeCloseTo(s.width - bs(s).half);
  });

  it('sends a ball back up, more slanted off its ends, and a little faster each time', () => {
    const s = modeGame('breaker', 60);
    popIn(s);
    const speed = bs(s).speed;
    const middle = flying(s, bs(s).paddleX, s.bottom - BALL_R - 2, 0, speed);
    step(s, DT);
    expect(middle.vy).toBeLessThan(0);
    expect(Math.abs(middle.vx)).toBeLessThan(1e-6);
    expect(middle.speed).toBeCloseTo(speed * BREAKER_SPEEDUP);
    const end = flying(s, bs(s).paddleX + bs(s).half * 0.9, s.bottom - BALL_R - 2, 0, speed);
    step(s, DT);
    expect(end.vx).toBeGreaterThan(0);
    for (let k = 0; k < 40; k++) {
      flying(s, bs(s).paddleX, s.bottom - BALL_R - 2, 0, ball(s).speed);
      ball(s).speed = Math.hypot(ball(s).vx, ball(s).vy);
      step(s, DT);
    }
    expect(ball(s).speed).toBeLessThanOrEqual(speed * BREAKER_SPEEDUP_MAX + 1e-6);
  });
});

describe('balls', () => {
  it('wait on the paddle, then serve themselves straight at a brick', () => {
    const s = modeGame('breaker', 60);
    expect(ball(s)).toMatchObject({ live: true, held: true });
    run(s, BALL_SERVE_DELAY + 1);
    const b = ball(s);
    expect(b.held).toBe(false);
    expect(s.valueLeft).toBeLessThan(60); // it found one
  });

  it('serve at once on a tap', () => {
    const s = modeGame('breaker', 60);
    run(s, 1); // the bricks are in
    ball(s).held = true;
    ball(s).serve = 10;
    pointerDown(s, s.width / 2, 400);
    expect(ball(s).held).toBe(false);
    expect(ball(s).vy).toBeLessThan(0);
  });

  it('respawn on the paddle when dropped', () => {
    const s = modeGame('breaker', 60);
    popIn(s);
    bs(s).targetX = 0;
    run(s, 1);
    const b = flying(s, s.width - 20, s.bottom - 50, 0, 900);
    run(s, 0.3);
    expect(b.held).toBe(true);
    expect(b.speed).toBe(bs(s).speed);
  });

  it('break a brick they hit, bounce off one still standing, and never go flat', () => {
    const s = modeGame('breaker', 7); // 3 HP bricks
    popIn(s);
    const z = s.zeros[0]!;
    const b = flying(s, z.x, z.y + z.ry + BALL_R + 4, 0, -bs(s).speed);
    step(s, DT);
    expect(z.hp).toBe(2);
    expect(b.vy).toBeGreaterThan(0);
    flying(s, 40, 300, -bs(s).speed, -1); // nearly level, at the wall
    for (let f = 0; f < 3; f++) step(s, DT);
    expect(Math.abs(ball(s).vy)).toBeGreaterThanOrEqual(ball(s).speed * Math.sin(BREAKER_MIN_ANGLE) - 1e-6);
  });

  it('never skip through a brick, even in a long frame at full speed', () => {
    const s = modeGame('breaker', 60);
    popIn(s);
    // The bottom row's last brick, from below: a 70-point step at full speed would jump it.
    const z = s.zeros[s.zeros.length - 1]!;
    const before = s.valueLeft;
    const b = flying(s, z.x, z.y + z.ry + BALL_R + 30, 0, -1400);
    step(s, MAX_DT);
    expect(s.valueLeft).toBe(before - 1);
    expect(z.alive).toBe(false);
    expect(b.vy).toBeGreaterThan(0);
  });

  it('head straight for a brick off the paddle after coming back empty', () => {
    const s = modeGame('breaker', 60);
    popIn(s);
    run(s, 1);
    const b = flying(s, bs(s).paddleX, s.bottom - BALL_R - 2, 0, bs(s).speed);
    b.returns = BREAKER_EMPTY_RETURNS;
    step(s, DT);
    const target = s.zeros.filter(hittable).reduce((best, z) =>
      Math.hypot(z.x - b.x, z.y - b.y) < Math.hypot(best.x - b.x, best.y - b.y) ? z : best,
    );
    const heading = Math.atan2(b.vy, b.vx);
    expect(heading).toBeCloseTo(Math.atan2(target.y - b.y, target.x - b.x), 1);
  });
});

describe('power-ups', () => {
  it('match the engine’s tiers, one per weapon', () => {
    expect(Object.keys(BREAKER_POWER).sort()).toEqual(['chain', 'laser', 'nuke', 'pea', 'rocket', 'scatter', 'twin']);
  });

  it('put 1, 2 or 5 balls in play, and a switch adds or takes them away', () => {
    for (const [weapon, count] of [
      ['pea', 1],
      ['twin', 2],
      ['scatter', 5],
    ] as const) {
      const s = modeGame('breaker', 60, { weapon });
      expect(bs(s).ball.filter((b) => b.live)).toHaveLength(count);
    }
    const s = modeGame('breaker', 60);
    setWeapon(s, weaponById('scatter'));
    step(s, DT);
    expect(bs(s).ball.filter((b) => b.live)).toHaveLength(5);
    setWeapon(s, weaponById('pea'));
    step(s, DT);
    expect(bs(s).ball.filter((b) => b.live)).toHaveLength(1);
  });

  it('Fireball and Mega Ball burn through a brick they break', () => {
    for (const weapon of ['rocket', 'nuke'] as const) {
      const s = modeGame('breaker', 60, { weapon });
      popIn(s);
      const z = s.zeros[s.zeros.length - 1]!;
      const b = flying(s, z.x, z.y + z.ry + bs(s).radius + 4, 0, -bs(s).speed);
      step(s, DT);
      expect(z.alive).toBe(false);
      expect(b.vy).toBeLessThan(0);
    }
    expect(BREAKER_POWER.nuke.size).toBeGreaterThan(BREAKER_POWER.pea.size);
  });

  it('Lightning Ball throws lightning when it hits', () => {
    const s = modeGame('breaker', 60, { weapon: 'chain' });
    popIn(s);
    const z = s.zeros[s.zeros.length - 1]!;
    flying(s, z.x, z.y + z.ry + BALL_R + 4, 0, -bs(s).speed);
    step(s, DT);
    expect(s.bolts.count).toBeGreaterThan(0);
  });

  it('Laser Paddle: fires the Rail Laser straight up while the finger is down', () => {
    const s = modeGame('breaker', 60, { weapon: 'laser' });
    popIn(s);
    pointerDown(s, s.width / 2, 400);
    step(s, DT);
    expect(s.beams.count).toBe(1);
    expect(s.beams.items[0]!.x1).toBeCloseTo(bs(s).paddleX);
    expect(s.beams.items[0]!.y2).toBeLessThan(s.top);
    pointerUp(s);
    run(s, 1);
    expect(s.firing).toBe(false);
  });

  it('Laser Paddle with auto-fire: keeps firing after the finger lifts', () => {
    const s = modeGame('breaker', 60, { weapon: 'laser', autoFire: true });
    popIn(s);
    pointerDown(s, s.width / 2, 400);
    step(s, DT);
    pointerUp(s);
    run(s, 1);
    expect(s.firing).toBe(true);
    expect(s.beams.count).toBeGreaterThan(0);
  });
});

describe('the late-round assist', () => {
  it('sends every ball off the paddle straight at a brick once only a few are left', () => {
    const s = modeGame('breaker', 60);
    popIn(s);
    for (let j = 3; j < s.zeros.length; j++) s.zeros[j]!.alive = false;
    s.valueLeft = 3;
    const b = flying(s, bs(s).paddleX + bs(s).half * 0.8, s.bottom - BALL_R - 2, 0, bs(s).speed);
    step(s, DT);
    expect(bs(s).assist).toBe(true);
    let hit = false;
    for (let f = 0; f < 120 && !hit; f++) {
      step(s, DT);
      hit = s.valueLeft < 3;
    }
    expect(hit).toBe(true);
    expect(b.live).toBe(true);
  });
});

describe('bombs and Finish round', () => {
  it('a bomb blasts the bricks near the middle', () => {
    const s = modeGame('breaker', 60);
    popIn(s);
    expect(dropBomb(s)).toBe(true);
    expect(s.valueLeft).toBeLessThan(60);
  });

  it('Finish round clears the board into the celebration', () => {
    const s = modeGame('breaker', 1000);
    run(s, 1);
    expect(finishAll(s)).toBe(true);
    expect(s.valueLeft).toBe(0);
    expect(s.phase).toBe('celebrate');
  });
});
