// Bullets meeting zeros: the hit test, damage, kills, the counter and the end of the round.
import { describe, expect, it } from '@jest/globals';

import { BULLET_SPEED, HIT_MIN_RX, HIT_MIN_RY, HIT_PAD } from '../constants';
import { damageZero, killZero } from '../damage';
import { hitTest, hittable, segmentHitsZero } from '../hit';
import { pressFire, releaseFire } from '../input';
import { resetReport } from '../report';
import { step } from '../step';
import { alive, bulletAt, game, isolate, run } from './fixtures';

describe('hit test', () => {
  const zero = (rx: number, ry: number) => ({ ...game(8).zeros[0]!, x: 200, y: 400, rx, ry });

  it('is the zero ellipse plus a little padding', () => {
    const z = zero(30, 40);
    expect(hitTest(200 + 30 + HIT_PAD - 0.5, 400, z)).toBe(true);
    expect(hitTest(200 + 30 + HIT_PAD + 0.5, 400, z)).toBe(false);
    expect(hitTest(200, 400 - 40 - HIT_PAD + 0.5, z)).toBe(true);
    expect(hitTest(200, 400 - 40 - HIT_PAD - 0.5, z)).toBe(false);
    // Inside the bounding box but outside the ellipse.
    expect(hitTest(200 + 33, 400 + 43, z)).toBe(false);
  });

  it('meets a blade’s stroke that crosses the padded ellipse, and only one that does (Slice)', () => {
    const z = zero(30, 40);
    const edge = 30 + HIT_PAD;
    expect(segmentHitsZero(100, 400, 300, 400, z, 0)).toBe(true); // straight through
    expect(segmentHitsZero(200, 300, 200, 500, z, 0)).toBe(true);
    expect(segmentHitsZero(100, 300, 300, 300, z, 0)).toBe(false); // above it
    expect(segmentHitsZero(100, 400, 200 - edge - 1, 400, z, 0)).toBe(false); // stops short
    expect(segmentHitsZero(200 + edge - 0.5, 300, 200 + edge - 0.5, 500, z, 0)).toBe(true); // grazes the edge
    expect(segmentHitsZero(200 + edge + 0.5, 300, 200 + edge + 0.5, 500, z, 0)).toBe(false);
    expect(segmentHitsZero(200 + edge + 0.5, 300, 200 + edge + 0.5, 500, z, 2)).toBe(true); // a longer reach
    expect(segmentHitsZero(200, 400, 200, 400, z, 0)).toBe(true); // a point on it
    expect(segmentHitsZero(100, 300, 100, 300, z, 0)).toBe(false);
  });

  it('pads small zeros out to a fair target', () => {
    const z = zero(4, 5);
    expect(hitTest(200 + HIT_MIN_RX + HIT_PAD - 0.5, 400, z)).toBe(true);
    expect(hitTest(200, 400 + HIT_MIN_RY + HIT_PAD - 0.5, z)).toBe(true);
    expect(hitTest(200 + HIT_MIN_RX + HIT_PAD + 0.5, 400, z)).toBe(false);
  });
});

describe('bullets and zeros', () => {
  it('kills a standard zero with one hit and counts it', () => {
    const s = game(8);
    const z = isolate(s, 0, s.muzzleX, 300);
    pressFire(s, s.muzzleX, 0);
    releaseFire(s);
    run(s, 0.5);
    expect(z.alive).toBe(false);
    expect(s.valueLeft).toBe(7);
    expect(s.report).toMatchObject({ kills: 1, valueLeft: 7, dirty: true, final: false });
    expect(s.bullets.count).toBe(0); // spent on the hit
  });

  it('does not tunnel through a small zero on a slow frame', () => {
    const s = game(60);
    const z = isolate(s, 0, s.muzzleX, 400);
    // Each 0.05 s frame carries a bullet 75 pt, far more than this zero's 2 × 21 pt target.
    expect(BULLET_SPEED * 0.05).toBeGreaterThan(2 * (Math.max(z.ry, HIT_MIN_RY) + HIT_PAD));
    pressFire(s, s.muzzleX, 0);
    releaseFire(s);
    for (let i = 0; i < 20; i++) step(s, 0.05);
    expect(z.alive).toBe(false);
  });

  it('passes through a zero that has not popped in yet', () => {
    const s = game(8);
    const z = isolate(s, 0, s.muzzleX, 300);
    z.delay = 5;
    expect(hittable(z)).toBe(false);
    pressFire(s, s.muzzleX, 0);
    releaseFire(s);
    run(s, 1);
    expect(z.alive).toBe(true);
    expect(s.report.hits + s.report.kills).toBe(0);
  });

  it('wears an energy zero down one hit at a time', () => {
    const s = game(3); // 4 HP each
    const z = isolate(s, 0, s.muzzleX, 300);
    for (let shot = 1; shot <= 3; shot++) {
      bulletAt(s, z.x, z.y + 30, 0, -BULLET_SPEED);
      step(s, 1 / 60);
      expect(z.hp).toBe(4 - shot);
      expect(z.hitFlash).toBeGreaterThan(0.5);
    }
    expect(s.report.hits).toBe(3);
    expect(z.alive).toBe(true);
    bulletAt(s, z.x, z.y + 30, 0, -BULLET_SPEED);
    step(s, 1 / 60);
    expect(z.alive).toBe(false);
    expect(s.valueLeft).toBe(2);
  });

  it('drops the counter by the zero value, never below 0', () => {
    const s = game(61); // 51 standard + 1 armored ×10
    const armored = s.zeros.find((z) => z.kind === 'armored')!;
    killZero(s, armored);
    expect(s.valueLeft).toBe(51);
    s.valueLeft = 4;
    const other = s.zeros.find((z) => z.alive)!;
    other.value = 10;
    killZero(s, other);
    expect(s.valueLeft).toBe(0);
  });

  it('ends the round exactly once, even when the last zeros go in the same frame', () => {
    const s = game(8);
    for (let i = 2; i < 8; i++) killZero(s, s.zeros[i]!);
    const [a, b] = [isolate(s, 0, 100, 300), s.zeros[1]!];
    Object.assign(b, { x: 290, y: 300 });
    resetReport(s.report);
    bulletAt(s, a.x, a.y + 20, 0, -BULLET_SPEED);
    bulletAt(s, b.x, b.y + 20, 0, -BULLET_SPEED);
    step(s, 1 / 60);
    expect(alive(s)).toHaveLength(0);
    expect(s.report).toMatchObject({ kills: 2, valueLeft: 0, final: true });
    expect(s.phase).toBe('celebrate');
    resetReport(s.report);
    run(s, 0.5);
    expect(s.report.final).toBe(false);
    expect(s.report.dirty).toBe(false);
  });

  it('deals no damage once the round is over', () => {
    const s = game(8);
    s.phase = 'celebrate';
    const z = s.zeros[0]!;
    z.delay = 0;
    expect(damageZero(s, z, 5)).toBe(false);
    expect(z.alive).toBe(true);
  });

  it('collects everything in a frame into one report, and starts the next one clean', () => {
    const s = game(8);
    const z = isolate(s, 0, s.muzzleX, 300);
    pressFire(s, s.muzzleX, 0);
    releaseFire(s);
    run(s, 0.5);
    expect(z.alive).toBe(false);
    expect(s.report).toMatchObject({ dirty: true, shots: 1, kills: 1, seed: 1 });
    resetReport(s.report);
    step(s, 1 / 60);
    expect(s.report).toMatchObject({ dirty: false, shots: 0, kills: 0, valueLeft: 7, seed: 1 });
  });
});
