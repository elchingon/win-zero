// Boss rounds (SPEC 4) in the sim: a stage breaks instead of the boss dying, sheds a ring that
// carries exactly the value it gave up, and leaves the boss shielded until the ring is gone. The
// last stage goes as any zero does. A round without a boss is built exactly as before.
import { describe, expect, it } from '@jest/globals';

import { BOMB_DAMAGE, bossGroups, bossPlan, MODE_IDS, type BossDay, type ModeId } from '@/engine';

import { fewLeft } from '../board';
import { dropBomb } from '../bomb';
import { BOSS_SHED_GRACE, BOSS_SHRINK, KILL_SPARKS, MAX_ZEROS } from '../constants';
import { damageZero } from '../damage';
import { finishAll } from '../finish';
import { hittable } from '../hit';
import { buildGame } from '../spawn';
import type { GameState, Zero } from '../types';
import { alive, config, popIn, run } from './fixtures';

function bossGame(day: BossDay, mode: ModeId = 'shooter', opts: { reduceMotion?: boolean } = {}): GameState {
  const boss = bossPlan(day, mode);
  const s = buildGame({ ...config(day, { mode, ...opts }), groups: bossGroups(boss), boss }, mode);
  popIn(s);
  return s;
}

const bossOf = (s: GameState): Zero => s.zeros[s.boss!.slot]!;
const ring = (s: GameState) => s.zeros.slice(s.boss!.ringFrom).filter((z) => z.alive);
const worth = (s: GameState) => alive(s).reduce((sum, z) => sum + z.value, 0);

/** Knock the boss's stage out in one hit. */
function breakStage(s: GameState): void {
  const z = bossOf(s);
  damageZero(s, z, z.hp);
}

describe('a boss round', () => {
  it.each(MODE_IDS)('in %s: one boss, worth the day, with room for its biggest ring', (mode) => {
    const s = bossGame(100, mode);
    const plan = bossPlan(100, mode);
    expect(alive(s)).toHaveLength(1);
    expect(bossOf(s)).toMatchObject({ kind: 'boss', value: 100, hp: plan.stages[0]?.hp, guarded: false });
    expect(s.zeros.length).toBe(1 + plan.spares);
    expect(s.zeros.length).toBeLessThanOrEqual(MAX_ZEROS);
    expect(s.boss?.badges[bossOf(s).badge]).toBe(100);
  });

  it.each(MODE_IDS)('in %s: a stage break sheds a ring worth what the boss gave up, and the counter holds', (mode) => {
    const s = bossGame(30, mode);
    const ry = bossOf(s).ry;
    breakStage(s);
    const z = bossOf(s);
    expect(z.alive).toBe(true);
    expect(s.boss?.stage).toBe(1);
    expect(z.value).toBe(21);
    expect(z.ry).toBeCloseTo(ry * BOSS_SHRINK);
    expect(ring(s).map((r) => r.value)).toEqual([2, 1, 1, 1, 1, 1, 1, 1]);
    expect(s.valueLeft).toBe(30);
    expect(worth(s)).toBe(30);
    expect(s.report).toMatchObject({ bossStage: 1, bossBreaks: 1, kills: 0 });
    // The ring appears after a moment, set off the mode's way, on the board.
    run(s, BOSS_SHED_GRACE + 0.1);
    for (const r of ring(s)) {
      expect(hittable(r)).toBe(true);
      expect(r.x).toBeGreaterThanOrEqual(r.rx - 1e-6);
      expect(r.x).toBeLessThanOrEqual(s.width - r.rx + 1e-6);
    }
    expect(s.zeros.length).toBe(1 + bossPlan(30, mode).spares);
  });

  it('is shielded while its ring is out, and can be hit again once the ring is gone', () => {
    const s = bossGame(30);
    breakStage(s);
    const z = bossOf(s);
    expect(z.guarded).toBe(true);
    expect(hittable(z)).toBe(false);
    expect(damageZero(s, z, 999)).toBe(false);
    expect(z.hp).toBe(bossPlan(30, 'shooter').stages[1]?.hp);
    run(s, BOSS_SHED_GRACE + 0.1);
    for (const r of ring(s)) damageZero(s, r, 1);
    expect(s.valueLeft).toBe(21);
    run(s, 1 / 60);
    expect(z.guarded).toBe(false);
    expect(hittable(z)).toBe(true);
  });

  it("can't skip a stage, however hard the hit", () => {
    const s = bossGame(365);
    damageZero(s, bossOf(s), 10_000);
    expect(s.boss?.stage).toBe(1);
    expect(bossOf(s).hp).toBe(bossPlan(365, 'shooter').stages[1]?.hp);
  });

  it("doesn't take a bomb while shielded", () => {
    const s = bossGame(30);
    breakStage(s);
    const hp = bossOf(s).hp;
    run(s, BOSS_SHED_GRACE + 0.1);
    dropBomb(s);
    expect(bossOf(s).hp).toBe(hp);
    // Its ring (1 HP each) takes the bomb, where it reaches.
    expect(BOMB_DAMAGE).toBeGreaterThan(1);
    expect(s.valueLeft).toBeLessThanOrEqual(30);
  });

  it('goes on its last stage as any zero does, ending the round', () => {
    const s = bossGame(7);
    for (let stage = 0; stage < 2; stage++) {
      breakStage(s);
      run(s, BOSS_SHED_GRACE + 0.1);
      for (const r of ring(s)) damageZero(s, r, 1);
      run(s, 1 / 60);
    }
    expect(s.boss?.stage).toBe(2);
    expect(s.valueLeft).toBe(3);
    expect(damageZero(s, bossOf(s), bossOf(s).hp)).toBe(true);
    expect(s.valueLeft).toBe(0);
    expect(s.phase).toBe('celebrate');
  });

  it.each([0, 1, 2])('Finish round ends on the boss, on stage %i', (stages) => {
    const s = bossGame(30);
    for (let k = 0; k < stages; k++) {
      breakStage(s);
      run(s, BOSS_SHED_GRACE + 0.1);
      if (k < stages - 1) for (const r of ring(s)) damageZero(s, r, 1);
      run(s, 1 / 60);
    }
    expect(finishAll(s)).toBe(true);
    expect(alive(s)).toHaveLength(0);
    expect(s.valueLeft).toBe(0);
    expect(s.phase).toBe('celebrate');
    expect(s.report.final).toBe(true);
  });

  it('helps with the last few only on the last stage, or the last few of a ring', () => {
    const s = bossGame(7);
    expect(fewLeft(s)).toBe(false);
    breakStage(s);
    // The boss and its ring of 2: few.
    expect(fewLeft(s)).toBe(true);
    const big = bossGame(30);
    breakStage(big);
    expect(fewLeft(big)).toBe(false);
    run(big, BOSS_SHED_GRACE + 0.1);
    for (const r of ring(big).slice(0, -2)) damageZero(big, r, 1);
    expect(fewLeft(big)).toBe(true);
  });

  it('throws fewer sparks under reduce motion', () => {
    const sparksOf = (reduceMotion: boolean) => {
      const s = bossGame(30, 'shooter', { reduceMotion });
      const before = s.particles.count;
      breakStage(s);
      return s.particles.count - before;
    };
    expect(sparksOf(false)).toBeGreaterThan(KILL_SPARKS * 2);
    expect(sparksOf(true)).toBeLessThanOrEqual(Math.ceil(sparksOf(false) / 2) + 2);
  });

  it('leaves a round without one exactly as it was', () => {
    for (const mode of MODE_IDS) {
      const plain = buildGame(config(30, { mode }), mode);
      expect(plain.boss).toBeNull();
      expect(plain.zeros.every((z) => !z.guarded)).toBe(true);
      expect(plain.zeros.some((z) => z.kind === 'boss')).toBe(false);
    }
  });
});
