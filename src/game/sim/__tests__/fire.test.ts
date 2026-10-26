// Touch-down, aim and hold-to-fire, and auto-fire (Settings › Accessibility).
import { describe, expect, it } from '@jest/globals';

import { FIRE_RATE_HZ } from '@/engine';

import { BULLET_SPEED, MIN_TAP_INTERVAL, MUZZLE_OFFSET } from '../constants';
import { moveAim, pressFire, releaseFire } from '../input';
import { step } from '../step';
import { game, run } from './fixtures';

describe('auto-fire', () => {
  it('waits for the first touch', () => {
    const s = game(60, { autoFire: true });
    run(s, 1);
    expect(s.report.shots).toBe(0);
  });

  it('keeps firing at the fire rate after the finger lifts, where it last aimed', () => {
    const s = game(60, { autoFire: true });
    pressFire(s, s.muzzleX + 100, s.muzzleY - 100);
    releaseFire(s);
    run(s, 2);
    expect(Math.abs(s.report.shots - (1 + 2 * FIRE_RATE_HZ))).toBeLessThanOrEqual(1);
    expect(s.aim).toBeCloseTo(-Math.PI / 4);
  });

  it('aims again at each touch and drag', () => {
    const s = game(60, { autoFire: true });
    pressFire(s, s.muzzleX + 100, s.muzzleY - 100);
    releaseFire(s);
    pressFire(s, s.muzzleX - 100, s.muzzleY - 100);
    expect(s.aim).toBeCloseTo((-3 * Math.PI) / 4);
    moveAim(s, s.muzzleX, s.muzzleY - 100);
    expect(s.aim).toBeCloseTo(-Math.PI / 2);
  });

  it('stops once the last zero is gone', () => {
    const s = game(60, { autoFire: true });
    pressFire(s, s.muzzleX, 0);
    releaseFire(s);
    s.phase = 'celebrate';
    const shots = s.report.shots;
    run(s, 1);
    expect(s.report.shots).toBe(shots);
  });
});

describe('firing', () => {
  it('fires the first shot on touch-down, from the muzzle toward the finger', () => {
    const s = game(8);
    pressFire(s, s.muzzleX, s.muzzleY - 300);
    expect(s.report.shots).toBe(1);
    expect(s.bullets.count).toBe(1);
    expect(s.firing).toBe(true);
    expect(s.muzzle).toBe(1);
    const b = s.bullets.items[0]!;
    expect(b.x).toBeCloseTo(s.muzzleX);
    expect(b.y).toBeCloseTo(s.muzzleY - MUZZLE_OFFSET);
    expect(b.vx).toBeCloseTo(0);
    expect(b.vy).toBeCloseTo(-BULLET_SPEED);
  });

  it('aims at the finger', () => {
    const s = game(8);
    pressFire(s, s.muzzleX + 100, s.muzzleY - 100);
    expect(s.aim).toBeCloseTo(-Math.PI / 4);
    moveAim(s, s.muzzleX - 100, s.muzzleY - 100);
    expect(s.aim).toBeCloseTo((-3 * Math.PI) / 4);
  });

  it('only follows a drag while the finger is down', () => {
    const s = game(8);
    pressFire(s, s.muzzleX, s.muzzleY - 100);
    releaseFire(s);
    moveAim(s, s.muzzleX + 100, s.muzzleY - 100);
    expect(s.aim).toBeCloseTo(-Math.PI / 2);
  });

  it.each([60, 45, 120])('holds at %i fps: 6 shots a second', (fps) => {
    const s = game(60);
    pressFire(s, s.muzzleX, 0);
    run(s, 2, fps);
    expect(Math.abs(s.report.shots - (1 + 2 * FIRE_RATE_HZ))).toBeLessThanOrEqual(1);
  });

  it('stops when the finger lifts', () => {
    const s = game(60);
    pressFire(s, s.muzzleX, 0);
    releaseFire(s);
    run(s, 1);
    expect(s.report.shots).toBe(1);
  });

  it('lets a quick second tap wait out MIN_TAP_INTERVAL', () => {
    const s = game(60);
    pressFire(s, s.muzzleX, 0);
    releaseFire(s);
    step(s, MIN_TAP_INTERVAL / 2);
    pressFire(s, s.muzzleX, 0);
    expect(s.report.shots).toBe(1);
    releaseFire(s);
    step(s, MIN_TAP_INTERVAL);
    pressFire(s, s.muzzleX, 0);
    expect(s.report.shots).toBe(2);
  });

  it('ignores the trigger once the last zero is gone', () => {
    const s = game(8);
    s.phase = 'celebrate';
    pressFire(s, s.muzzleX, 0);
    run(s, 1);
    expect(s.report.shots).toBe(0);
    expect(s.firing).toBe(false);
  });

  it('lets bullets fly off the screen and frees them', () => {
    const s = game(8);
    pressFire(s, 0, s.muzzleY); // straight left, under the play area
    releaseFire(s);
    run(s, 1);
    expect(s.bullets.count).toBe(0);
  });
});
