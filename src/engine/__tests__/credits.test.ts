import { describe, expect, it } from '@jest/globals';

import { claimCredits, CREDIT_REWARDS, creditRewardById, creditsEarned, GAME_CREDIT_ZEROS, WEAPON_CREDIT_YES_RUNS } from '../creditRewards';
import {
  BONUS_MAX_N,
  EMPTY_WALLET,
  grantCredits,
  isBonusSize,
  spendCredit,
  yesInRow,
  type CreditWallet,
} from '../credits';
import { addDays } from '../dates';
import { answer } from '../resolve';
import type { GoalState, TimeZone } from '../types';
import { answerDay, at, DAY0, DENVER, iso, LA, newGoal, notTodays, SANTIAGO, TOKYO, yesDays } from './fixtures';

/**
 * Answer Yes on `day` and claim what it earned, as the store does. A day's check-in stays open
 * until midnight ending the next day, so after a missed day, answer late (`late: true`): at 21:00
 * the next day, once the missed day's check-in has closed.
 */
function claimYes(state: GoalState, wallet: CreditWallet, day: string, opts: { tz?: TimeZone; late?: boolean } = {}) {
  const s = answerDay(state, day, 'yes', { tz: opts.tz, timeDay: opts.late ? addDays(day, 1) : day }).state;
  const r = claimCredits(wallet, { type: 'yes', goal: s });
  return { state: s, wallet: r.wallet, keys: r.granted.map((g) => g.key) };
}

/** Yes on `n` days from `from`, claiming after each; `log` lists "day key" for every credit paid. */
function yesRun(state: GoalState, wallet: CreditWallet, from: string, n: number, tz: TimeZone = DENVER) {
  let s = state;
  let w = wallet;
  const log: string[] = [];
  for (let i = 0; i < n; i++) {
    const day = addDays(from, i);
    const r = claimYes(s, w, day, { tz });
    s = r.state;
    w = r.wallet;
    log.push(...r.keys.map((k) => `${day} ${k}`));
  }
  return { state: s, wallet: w, log };
}

const claimedAllBut = (key: string): CreditWallet => ({
  ...EMPTY_WALLET,
  claimed: CREDIT_REWARDS.map((r) => r.id).filter((id) => id !== key),
});

describe('credit wallet (SPEC 5)', () => {
  it('pays each key once', () => {
    const grants = [
      { kind: 'game' as const, amount: 1, key: 'a' },
      { kind: 'weapon' as const, amount: 2, key: 'b' },
    ];
    const first = grantCredits(EMPTY_WALLET, grants);
    expect(first.wallet).toEqual({ balance: { game: 1, weapon: 2 }, claimed: ['a', 'b'] });
    expect(first.granted).toEqual(grants);

    const again = grantCredits(first.wallet, grants);
    expect(again.granted).toEqual([]);
    expect(again.wallet).toBe(first.wallet);
  });

  it('pays a key repeated in one batch once', () => {
    const { wallet } = grantCredits(EMPTY_WALLET, [
      { kind: 'game', amount: 1, key: 'a' },
      { kind: 'game', amount: 1, key: 'a' },
    ]);
    expect(wallet).toEqual({ balance: { game: 1, weapon: 0 }, claimed: ['a'] });
  });

  it('refuses an amount that is not a positive whole number', () => {
    expect(() => grantCredits(EMPTY_WALLET, [{ kind: 'game', amount: 0, key: 'a' }])).toThrow(RangeError);
    expect(() => grantCredits(EMPTY_WALLET, [{ kind: 'game', amount: 1.5, key: 'a' }])).toThrow(RangeError);
  });

  it('spends one at a time, and cannot spend at 0', () => {
    const { wallet } = grantCredits(EMPTY_WALLET, [{ kind: 'weapon', amount: 2, key: 'a' }]);
    const spent = spendCredit(wallet, 'weapon');
    expect(spent.balance).toEqual({ game: 0, weapon: 1 });
    expect(spent.claimed).toEqual(['a']);
    expect(() => spendCredit(spent, 'game')).toThrow(RangeError);
    expect(EMPTY_WALLET.balance).toEqual({ game: 0, weapon: 0 });
  });

  it('sizes a bonus round from 1 to BONUS_MAX_N zeros', () => {
    expect(isBonusSize(1)).toBe(true);
    expect(isBonusSize(BONUS_MAX_N)).toBe(true);
    expect(isBonusSize(0)).toBe(false);
    expect(isBonusSize(BONUS_MAX_N + 1)).toBe(false);
    expect(isBonusSize(2.5)).toBe(false);
    expect(isBonusSize(NaN)).toBe(false);
  });
});

describe('yesInRow', () => {
  it('counts Yeses back to the last day that was not one', () => {
    expect(yesInRow(newGoal())).toBe(0);
    let s = yesDays(newGoal(), DAY0, 3);
    expect(yesInRow(s)).toBe(3);
    s = answerDay(s, '2026-10-16', 'not-today').state;
    expect(yesInRow(s)).toBe(0);
    s = yesDays(s, '2026-10-17', 2);
    expect(yesInRow(s)).toBe(2);
    s = answerDay(s, '2026-10-20', 'yes', { timeDay: '2026-10-21' }).state; // 10-19 missed
    expect(yesInRow(s)).toBe(1);
  });
});

describe('credit rewards (SPEC 5)', () => {
  it('has unique ids, and the reasons read after "credit earned"', () => {
    const ids = CREDIT_REWARDS.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const r of CREDIT_REWARDS) {
      expect(creditRewardById(r.id)).toBe(r);
      expect(r.reason).toMatch(/^for /);
    }
    expect(creditRewardById('nope')).toBeUndefined();
  });

  it('pays a Game credit for setting the goal, once ever', () => {
    const first = claimCredits(EMPTY_WALLET, { type: 'goal', goal: newGoal() });
    expect(first.granted).toEqual([{ kind: 'game', amount: 1, key: 'goal-set' }]);
    expect(first.wallet.balance).toEqual({ game: 1, weapon: 0 });
    const second = claimCredits(first.wallet, { type: 'goal', goal: newGoal({ day: '2026-11-20' }) });
    expect(second.granted).toEqual([]);
  });

  it('pays only for the moment it is checked at', () => {
    expect(creditsEarned({ type: 'goal', goal: yesDays(newGoal(), DAY0, 30) }, []).map((g) => g.key)).toEqual(['goal-set']);
    expect(creditsEarned({ type: 'yes', goal: yesDays(newGoal(), DAY0, 1) }, [])).toEqual([]);
  });

  it('pays a Game credit for 2 zeros and Weapon credits at 3, 14 and 30 in a row, across the fall-back', () => {
    expect(GAME_CREDIT_ZEROS).toBe(2);
    expect(WEAPON_CREDIT_YES_RUNS).toEqual([3, 14, 30]);
    // DAY0 is two weeks before the US fall-back on Nov 1.
    const { wallet, log } = yesRun(newGoal(), EMPTY_WALLET, DAY0, 35);
    expect(log).toEqual(['2026-10-14 zeros-2', '2026-10-15 yes-run-3', '2026-10-26 yes-run-14', '2026-11-11 yes-run-30']);
    expect(wallet.balance).toEqual({ game: 1, weapon: 3 });
  });

  it('counts a run across a midnight DST change', () => {
    const start = '2026-09-01'; // Chile springs forward at midnight starting Sep 6
    const { log } = yesRun(newGoal({ tz: SANTIAGO, day: start }), EMPTY_WALLET, start, 14, SANTIAGO);
    expect(log).toEqual(['2026-09-02 zeros-2', '2026-09-03 yes-run-3', '2026-09-14 yes-run-14']);
  });

  it('pays the 3-in-a-row credit on the Yes that also unlocks the Twin Barrel', () => {
    const s = yesDays(newGoal(), DAY0, 2);
    const r = answerDay(s, '2026-10-15', 'yes');
    expect(r.outcome).toMatchObject({ kind: 'yes', rewards: { weapons: [expect.objectContaining({ id: 'twin' })] } });
    expect(claimCredits(claimedAllBut('yes-run-3'), { type: 'yes', goal: r.state }).granted).toEqual([
      { kind: 'weapon', amount: 1, key: 'yes-run-3' },
    ]);
  });

  it('never pays twice, even after a reset and a climb back', () => {
    let { state, wallet } = yesRun(newGoal(), EMPTY_WALLET, DAY0, 3); // through 10-15
    state = notTodays(state, '2026-10-16', 7); // the slide runs out: reset
    expect(state.streak).toBe(0);
    const again = yesRun(state, wallet, '2026-10-23', 3);
    expect(again.log).toEqual([]);
    expect(again.wallet).toBe(wallet);
  });

  it('starts "in a row" over after a Not today, which is not a missed day', () => {
    let { state, wallet, log } = yesRun(newGoal(), EMPTY_WALLET, DAY0, 2); // through 10-14
    expect(log).toEqual(['2026-10-14 zeros-2']);
    state = answerDay(state, '2026-10-15', 'not-today').state;
    ({ state, wallet, log } = yesRun(state, wallet, '2026-10-16', 3));
    // No comeback for the Yes after a Not today; three more Yeses make 3 in a row.
    expect(log).toEqual(['2026-10-18 yes-run-3']);
  });

  it('pays the comeback for the first Yes after a missed day, even when the streak is already 3', () => {
    const { state, wallet } = yesRun(newGoal(), EMPTY_WALLET, DAY0, 2); // through 10-14
    const r = claimYes(state, wallet, '2026-10-16', { late: true }); // 10-15 missed: a free day
    expect(r.state.streak).toBe(3);
    expect(yesInRow(r.state)).toBe(1);
    expect(r.keys).toEqual(['comeback']);
    // Once ever.
    const later = claimYes(r.state, r.wallet, '2026-10-18', { late: true }); // 10-17 missed
    expect(later.keys).toEqual([]);
  });

  it('lets a player from before credits collect what they already qualify for on their next Yes', () => {
    const s = yesDays(newGoal(), DAY0, 20); // through 11-01
    const r = claimYes(s, EMPTY_WALLET, '2026-11-02');
    expect(r.keys).toEqual(['zeros-2', 'yes-run-3', 'yes-run-14']);
    expect(r.wallet.balance).toEqual({ game: 1, weapon: 2 });
  });
});

describe('credit rewards across absences (SPEC 3)', () => {
  it('after a weeks-long absence that ended in a reset, the next Yes is a comeback and starts a new run', () => {
    let { state, wallet } = yesRun(newGoal(), EMPTY_WALLET, DAY0, 5); // through 10-17, no shield yet
    // Three weeks away, through the fall-back: 7 free days, then the slide resets and pauses.
    const r = claimYes(state, wallet, '2026-11-08', { late: true });
    expect(r.state.history.some((e) => e.reset)).toBe(true);
    expect(r.state.history.at(-2)).toMatchObject({ result: 'missed', paused: true });
    expect(r.state.streak).toBe(1);
    expect(yesInRow(r.state)).toBe(1);
    expect(r.keys).toEqual(['comeback']);
    ({ state, wallet } = r);
    const next = yesRun(state, wallet, '2026-11-09', 2);
    expect(next.log).toEqual([]); // 3 in a row was claimed in the first run
  });

  it('after 7 free missed days the streak holds, but the run of Yeses starts over', () => {
    const { state, wallet } = yesRun(newGoal(), EMPTY_WALLET, DAY0, 13); // through 10-25
    const back = claimYes(state, wallet, '2026-11-02', { late: true }); // 10-26 .. 11-01 missed, all free
    expect(back.state.streak).toBe(14);
    expect(back.keys).toEqual(['comeback']); // 14 zeros, but not 14 in a row
    const run = yesRun(back.state, back.wallet, '2026-11-03', 13);
    expect(run.log).toEqual(['2026-11-15 yes-run-14']);
  });

  it('counts a missed final that a shield absorbed as a missed day', () => {
    const s = yesDays(newGoal(), DAY0, 7); // through 10-19: one shield
    expect(s.shields).toBe(1);
    // 10-20 .. 11-02 missed: 7 free days, 6 slips, then the final, which the shield takes.
    const r = claimYes(s, claimedAllBut('comeback'), '2026-11-03', { late: true });
    expect(r.state.history.at(-2)).toMatchObject({ day: '2026-11-02', result: 'shielded', missedInRow: 14 });
    expect(r.keys).toEqual(['comeback']);
  });
});

describe('credit rewards while traveling', () => {
  it('keeps a run of Yeses going through a move from LA to Tokyo', () => {
    const s = newGoal({ tz: LA });
    const landed = iso('2026-10-14T18:00:00Z'); // 03:00 Oct 15 in Tokyo, the Oct 13 window still open
    const first = answer(s, { answer: 'yes' }, landed, TOKYO);
    if (!first.ok) throw new Error(first.reason);
    let state = answerDay(first.state, '2026-10-14', 'yes', { tz: TOKYO, timeDay: '2026-10-15', time: '04:00' }).state;
    state = answerDay(state, '2026-10-15', 'yes', { tz: TOKYO }).state;
    expect(state.history.map((e) => e.result)).toEqual(['yes', 'yes', 'yes']);
    expect(yesInRow(state)).toBe(3);
    expect(creditsEarned({ type: 'yes', goal: state }, []).map((g) => g.key)).toEqual(['zeros-2', 'yes-run-3']);
  });

  it('makes the first Yes after a day left unanswered on a trip a comeback', () => {
    const s = yesDays(newGoal(), DAY0, 2); // Denver, through 10-14
    const r = answer(s, { answer: 'yes' }, at('2026-10-17', '21:00', TOKYO), TOKYO);
    if (!r.ok) throw new Error(r.reason);
    expect(r.state.history.at(-2)).toMatchObject({ day: '2026-10-15', result: 'missed' });
    expect(creditsEarned({ type: 'yes', goal: r.state }, ['zeros-2']).map((g) => g.key)).toEqual(['comeback']);
  });
});
