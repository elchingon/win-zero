// Bombs: reach, damage, armor that survives, and the end of the round.
import { describe, expect, it } from '@jest/globals';

import { BOMB_DAMAGE } from '@/engine';

import { AMBER, BOMB_MARGIN, FLARE, FLASH_BOMB, FLASH_FINAL, TEAL } from '../constants';
import { bombRadius, dropBomb } from '../bomb';
import { resetReport } from '../report';
import { alive, finalRings, game, isolate, popIn } from './fixtures';

const center = (s: ReturnType<typeof game>) => ({ x: s.width / 2, y: (s.top + s.bottom) / 2 });

describe('bombs', () => {
  it('reach 42% of the longest side from the middle of the play area, plus the zero radius', () => {
    const s = game(30);
    const c = center(s);
    const reach = bombRadius(s);
    expect(reach).toBeCloseTo(844 * 0.42);
    const inside = isolate(s, 0, c.x, c.y);
    const [edgeIn, edgeOut] = [s.zeros[1]!, s.zeros[2]!];
    // Straight down from the middle, just inside and just outside the reach.
    Object.assign(edgeIn, { x: c.x, y: c.y + reach + edgeIn.ry * BOMB_MARGIN - 1 });
    Object.assign(edgeOut, { x: c.x + 5, y: c.y + reach + edgeOut.ry * BOMB_MARGIN + 1 });
    expect(dropBomb(s)).toBe(true);
    expect([inside.alive, edgeIn.alive, edgeOut.alive]).toEqual([false, false, true]);
    expect(s.report.bombs).toBe(1);
    expect(s.flash).toBe(FLASH_BOMB);
    expect(s.rings.count).toBeGreaterThanOrEqual(2);
  });

  it(`deal ${BOMB_DAMAGE} damage, so heavy armor survives`, () => {
    const s = game(1000); // armored zeros have 12 HP
    popIn(s);
    const armored = s.zeros.filter((z) => z.kind === 'armored');
    expect(armored[0]!.maxHp).toBe(12);
    const c = center(s);
    for (const z of armored) Object.assign(z, { x: c.x, y: c.y });
    dropBomb(s);
    expect(armored.every((z) => z.alive && z.hp === 12 - BOMB_DAMAGE)).toBe(true);
  });

  it('clear lighter armor', () => {
    const s = game(250); // 7 HP
    popIn(s);
    const z = s.zeros.find((x) => x.kind === 'armored')!;
    Object.assign(z, center(s));
    dropBomb(s);
    expect(z.alive).toBe(false);
  });

  it('can win the round, ending it exactly once', () => {
    const s = game(8);
    popIn(s);
    for (const z of s.zeros) Object.assign(z, center(s));
    dropBomb(s);
    expect(alive(s)).toHaveLength(0);
    expect(s.report).toMatchObject({ final: true, kills: 8, valueLeft: 0 });
    resetReport(s.report);
    expect(dropBomb(s)).toBe(false);
    expect(s.report.bombs).toBe(0);
  });

  it('keep the final shockwaves when they win a full board at once', () => {
    const s = game(60);
    const c = center(s);
    for (const z of s.zeros) Object.assign(z, { x: c.x, y: c.y });
    expect(dropBomb(s)).toBe(true);
    expect(s.phase).toBe('celebrate');
    expect(finalRings(s, c.x, c.y)).toEqual([AMBER, FLARE, TEAL]);
  });

  it('catch zeros still popping in, which appear at once', () => {
    const s = game(30);
    const z = s.zeros[0]!;
    Object.assign(z, { ...center(s), delay: 0.5, age: 0.1 });
    dropBomb(s);
    expect(z.alive).toBe(false);
  });

  it('flash as brightly as the final when they clear the last zero', () => {
    const s = game(8);
    popIn(s);
    for (const z of s.zeros) Object.assign(z, center(s));
    dropBomb(s);
    expect(s.phase).toBe('celebrate');
    expect(s.flash).toBe(FLASH_FINAL);
  });

  it('do nothing once the round is won', () => {
    const s = game(30);
    s.phase = 'celebrate';
    expect(dropBomb(s)).toBe(false);
    expect([s.report.bombs, s.rings.count, s.flash]).toEqual([0, 0, 0]);
  });
});
