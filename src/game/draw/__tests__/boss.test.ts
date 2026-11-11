// Boss rounds (SPEC 4) on screen: the boss comes from its own sprite, with pips for its stages over
// its bar, dimmed while it's shielded, all through the website's stand-in canvas.
import { describe, expect, it } from '@jest/globals';

import { bossGroups, bossPlan, MODE_IDS, type ModeId } from '@/engine';

import { BOSS_SHED_GRACE } from '../../sim/constants';
import { damageZero } from '../../sim/damage';
import { buildGame } from '../../sim/spawn';
import type { GameState } from '../../sim/types';
import { config, popIn, run } from '../../sim/__tests__/fixtures';
import { makeScratch } from '../scene';
import type { Rgba } from '../types';
import { drawEnergyBars } from '../zeros';
import { draw, recorder, stubKit } from './stub';

function bossGame(mode: ModeId): GameState {
  const boss = bossPlan(30, mode);
  const s = buildGame({ ...config(30, { mode }), groups: bossGroups(boss), boss }, mode);
  popIn(s);
  run(s, 0.5);
  return s;
}

/** The bars' and pips' alphas, as drawn for `s`. */
function barAlphas(s: GameState): number[] {
  const alphas: number[] = [];
  drawEnergyBars(recorder().canvas, s, stubKit(s, { boss: true, onFill: (c: Rgba) => alphas.push(c[3] ?? 0) }), makeScratch());
  return alphas;
}

describe('a boss round', () => {
  it.each(MODE_IDS)('in %s: draws the boss from its own sprite, through the stand-in canvas', (mode) => {
    const s = bossGame(mode);
    const kit = stubKit(s, { boss: true });
    const sc = makeScratch();
    const calls = draw(s, kit, sc);
    expect(calls.length).toBeGreaterThan(0);
    expect(sc.zeros.srcs[0]).toBe(kit.sheet.boss?.ring);
    // Its bar, and a pip for each of its 3 stages.
    expect(calls.filter((c) => c.startsWith('drawRect(')).length).toBeGreaterThanOrEqual(2 + 3);
  });

  it('flashes from its own fg ring when hit', () => {
    const s = bossGame('shooter');
    damageZero(s, s.zeros[0]!, 1);
    const kit = stubKit(s, { boss: true });
    const sc = makeScratch();
    draw(s, kit, sc);
    expect(sc.flashes.srcs[0]).toBe(kit.sheet.boss?.flash);
  });

  it('dims its bar and pips while shielded', () => {
    const s = bossGame('shooter');
    const open = barAlphas(s);
    const boss = s.zeros[0]!;
    damageZero(s, boss, boss.hp);
    expect(boss.guarded).toBe(true);
    run(s, BOSS_SHED_GRACE + 0.1);
    // The ring's zeros have no bars: what's left is the boss's, dimmed.
    const shielded = barAlphas(s);
    expect(Math.max(...shielded)).toBeLessThan(Math.max(...open) / 2);
  });

  it("draws nothing it lacks a sprite for, on a sheet that hasn't one", () => {
    const s = bossGame('shooter');
    const sc = makeScratch();
    draw(s, stubKit(s), sc);
    expect(sc.zeros.count).toBe(0);
  });
});
