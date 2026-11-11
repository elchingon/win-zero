// Boss rounds (SPEC 4): the milestone days' one huge zero, fought in stages that shed rings of
// small zeros, worth the whole day all the way down.
import { describe, expect, it } from '@jest/globals';

import {
  BOSS_DAYS,
  BOSS_MODE_HP_SCALE,
  BOSS_RING_MAX,
  BOSS_STAGE_HP,
  bossGroups,
  bossPlan,
  bossRoundFor,
  isBossDay,
} from '../boss';
import { createGoalWithHeadStart } from '../headStart';
import { MODE_IDS } from '../modes';
import { answer, resolve } from '../resolve';
import { BOMB_EVERY, SHIELD_EVERY } from '../rewards';
import { composeRound } from '../round';
import type { GoalState } from '../types';
import { answerDay, at, DAY0, DENVER, newGoal, notTodays, yesDays } from './fixtures';

/** The round the latest Yes made: its zeros and what it earned. */
function lastRound(s: GoalState, day: string) {
  const r = answer(s, { answer: 'yes', day }, at(day, '21:00'), DENVER);
  if (!r.ok || r.outcome.kind !== 'yes') throw new Error('Yes turned down');
  return { state: r.state, round: { n: r.outcome.streak, rewards: r.outcome.rewards } };
}

describe('the boss plan', () => {
  it.each(BOSS_DAYS.flatMap((day) => MODE_IDS.map((mode) => [day, mode] as const)))(
    'Day %i in %s: worth the whole day, stage by stage',
    (day, mode) => {
      const plan = bossPlan(day, mode);
      expect(plan.n).toBe(day);
      expect(plan.stages).toHaveLength(BOSS_STAGE_HP[day].length);
      expect(plan.stages[0]?.value).toBe(day);
      // Each stage's value is what's left of the one before after its ring; the last sheds none.
      let value = day;
      plan.stages.forEach((stage, k) => {
        expect(stage.value).toBe(value);
        expect(stage.hp).toBeGreaterThanOrEqual(1);
        expect(stage.hp).toBe(Math.max(1, Math.round((BOSS_STAGE_HP[day][k] ?? 0) * BOSS_MODE_HP_SCALE[mode])));
        const last = k === plan.stages.length - 1;
        expect(stage.shed.length > 0).toBe(!last);
        expect(stage.shed.length).toBeLessThanOrEqual(BOSS_RING_MAX);
        if (stage.shed.length) expect(Math.max(...stage.shed) - Math.min(...stage.shed)).toBeLessThanOrEqual(1);
        value -= stage.shed.reduce((a, b) => a + b, 0);
      });
      expect(value).toBeGreaterThanOrEqual(1);
      expect(plan.stages.at(-1)?.value).toBe(value);
      expect(plan.spares).toBe(Math.max(...plan.stages.map((s) => s.shed.length)));
      // Every value above 1 has a badge; none twice.
      const values = plan.stages.flatMap((s) => [s.value, ...s.shed]).filter((v) => v > 1);
      expect(new Set(plan.badges)).toEqual(new Set(values));
      expect(new Set(plan.badges).size).toBe(plan.badges.length);
    },
  );

  it('sheds a share of the boss each stage', () => {
    expect(bossPlan(30, 'shooter').stages.map((s) => [s.value, s.shed])).toEqual([
      [30, [2, 1, 1, 1, 1, 1, 1, 1]],
      [21, [1, 1, 1, 1, 1, 1]],
      [15, []],
    ]);
    expect(bossPlan(7, 'shooter').stages.map((s) => s.value)).toEqual([7, 5, 3]);
    expect(bossPlan(365, 'shooter').stages.map((s) => s.value)).toEqual([365, 255, 178, 125]);
  });

  it('is one zero, worth the day, with the first stage’s HP and a bar', () => {
    expect(bossGroups(bossPlan(100, 'catch'))).toEqual([
      { kind: 'boss', count: 1, hp: bossPlan(100, 'catch').stages[0]?.hp, value: 100, energyBar: true },
    ]);
  });

  it('comes only on its days, never from composeRound', () => {
    expect(BOSS_DAYS.filter(isBossDay)).toEqual([...BOSS_DAYS]);
    for (const n of [1, 6, 8, 14, 29, 31, 60, 99, 101, 364, 366, 1000]) expect(isBossDay(n)).toBe(false);
    for (const day of BOSS_DAYS) expect(day % BOMB_EVERY === 0 || day % SHIELD_EVERY === 0).toBe(true);
    for (const n of [...BOSS_DAYS, 1, 250]) expect(composeRound(n).groups.some((g) => g.kind === 'boss')).toBe(false);
  });
});

describe('which rounds have a boss', () => {
  it('a fresh Day 7 and Day 30', () => {
    const seven = lastRound(yesDays(newGoal(), DAY0, 6), '2026-10-19');
    expect(seven.round.n).toBe(7);
    expect(bossRoundFor(seven.round, 'shooter')?.n).toBe(7);
    const thirty = lastRound(yesDays(newGoal(), DAY0, 29), '2026-11-11');
    expect(thirty.round.n).toBe(30);
    expect(bossRoundFor(thirty.round, 'orbit')?.n).toBe(30);
    expect(bossRoundFor({ n: 31, rewards: thirty.round.rewards }, 'shooter')).toBeNull();
  });

  it('a Day 7 with shields already full', () => {
    expect(bossRoundFor({ n: 7, rewards: { bomb: false, shield: false, shieldCapped: true } }, 'shooter')?.n).toBe(7);
  });

  it('not climbing back to the same day within a run, but again after a reset', () => {
    // Day 30, then 3 Not todays slide it to 27, and three Yeses climb back to 30.
    let s = yesDays(newGoal(), DAY0, 30);
    s = notTodays(s, '2026-11-12', 3);
    s = yesDays(s, '2026-11-15', 2);
    const back = lastRound(s, '2026-11-17');
    expect(back.round.n).toBe(30);
    expect(bossRoundFor(back.round, 'shooter')).toBeNull();

    // A reset (7 Not todays from 3, no shield) starts a new run: its Day 7 has a boss again.
    let r = yesDays(newGoal(), DAY0, 3);
    r = notTodays(r, '2026-10-16', 7);
    expect(r.streak).toBe(0);
    r = yesDays(r, '2026-10-23', 6);
    expect(bossRoundFor(lastRound(r, '2026-10-29').round, 'shooter')?.n).toBe(7);
  });

  it('after a head start that ends the day before', () => {
    const goal = (n: number) =>
      createGoalWithHeadStart({ goalId: 'g1', goal: 'Run', now: at(DAY0, '12:00'), tz: DENVER, headStart: n });
    expect(bossRoundFor(lastRound(goal(6), DAY0).round, 'slice')?.n).toBe(7);
    expect(bossRoundFor(lastRound(goal(29), DAY0).round, 'breaker')?.n).toBe(30);
    expect(bossRoundFor(lastRound(goal(7), DAY0).round, 'shooter')).toBeNull();
  });

  it('through the change of clocks, whatever the day was', () => {
    // A run reaching Day 7 on 2026-11-01, the day the clocks go back.
    const s = resolve(yesDays(newGoal({ day: '2026-10-26' }), '2026-10-26', 6), at('2026-11-01', '12:00'), DENVER).state;
    const r = lastRound(answerDay(s, '2026-11-01', 'yes').state, '2026-11-02');
    expect(r.round.n).toBe(8);
    const seven = answer(s, { answer: 'yes', day: '2026-11-01' }, at('2026-11-01', '21:00'), DENVER);
    if (!seven.ok || seven.outcome.kind !== 'yes') throw new Error('Yes turned down');
    expect(bossRoundFor({ n: seven.outcome.streak, rewards: seven.outcome.rewards }, 'shooter')?.n).toBe(7);
  });
});
