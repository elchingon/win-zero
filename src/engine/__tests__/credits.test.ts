import { describe, expect, it } from '@jest/globals';

import {
  claimCredits,
  CREDIT_REWARDS,
  creditReason,
  creditRewardById,
  creditRewardClaimed,
  creditsEarned,
  GAME_CREDIT_YES_EVERY,
  GAME_CREDIT_ZEROS,
  WEAPON_CREDIT_YES_EVERY,
  WEAPON_CREDIT_YES_RUNS,
} from '../creditRewards';
import {
  BONUS_MAX_N,
  EMPTY_WALLET,
  giftCredits,
  grantCredits,
  isBonusSize,
  spendCredit,
  WEAPON_CREDITS_PER_ROUND,
  weaponCreditOffer,
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

/** A claim key without a repeating reward's entry: 'yes-every-7@g1:2026-10-19' is 'yes-every-7'. */
const short = (key: string) => key.split('@')[0];

/**
 * Yes on `n` days from `from`, claiming after each; `log` lists "day reward" for every credit paid
 * (a repeating reward by its id), and `keys` the claim keys in full.
 */
function yesRun(state: GoalState, wallet: CreditWallet, from: string, n: number, tz: TimeZone = DENVER) {
  let s = state;
  let w = wallet;
  const log: string[] = [];
  const keys: string[] = [];
  for (let i = 0; i < n; i++) {
    const day = addDays(from, i);
    const r = claimYes(s, w, day, { tz });
    s = r.state;
    w = r.wallet;
    log.push(...r.keys.map((k) => `${day} ${short(k)}`));
    keys.push(...r.keys);
  }
  return { state: s, wallet: w, log, keys };
}

/** A wallet that has been paid every one-time reward but `key`. */
const claimedAllBut = (key: string): CreditWallet => ({
  ...EMPTY_WALLET,
  claimed: CREDIT_REWARDS.filter((r) => !r.repeats)
    .map((r) => r.id)
    .filter((id) => id !== key),
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
    expect(() => giftCredits(EMPTY_WALLET, 'game', 0)).toThrow(RangeError);
    expect(() => giftCredits(EMPTY_WALLET, 'game', 1.5)).toThrow(RangeError);
  });

  it('adds a gift every time, with no claim key', () => {
    const once = giftCredits({ balance: { game: 2, weapon: 1 }, claimed: ['goal-set'] }, 'game', 1);
    expect(once).toEqual({ balance: { game: 3, weapon: 1 }, claimed: ['goal-set'] });
    expect(giftCredits(once, 'game', 1).balance).toEqual({ game: 4, weapon: 1 });
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

describe('weaponCreditOffer (SPEC 5)', () => {
  const holding = (weapon: number): CreditWallet => ({ ...EMPTY_WALLET, balance: { game: 0, weapon } });
  const ids = (ws: { id: string }[]) => ws.map((w) => w.id);

  it('offers every weapon not yet unlocked while a credit is held', () => {
    expect(ids(weaponCreditOffer(holding(1), 3, []))).toEqual(['scatter', 'rocket', 'chain', 'laser', 'nuke']);
    expect(ids(weaponCreditOffer(holding(2), 60, []))).toEqual(['nuke']);
  });

  it('offers nothing without a credit, with every weapon unlocked, or once the round has borrowed its share', () => {
    expect(WEAPON_CREDITS_PER_ROUND).toBe(1);
    expect(weaponCreditOffer(holding(0), 3, [])).toEqual([]);
    expect(weaponCreditOffer(holding(3), 100, [])).toEqual([]);
    expect(weaponCreditOffer(holding(3), 3, ['rocket'])).toEqual([]);
  });

  it('is offered after the Yes, so a weapon that Yes unlocked is not on it', () => {
    const s = yesDays(newGoal(), DAY0, 3); // the 3rd Yes unlocks the Twin Barrel and earns a credit
    const { wallet } = claimCredits(EMPTY_WALLET, { type: 'yes', goal: s });
    expect(wallet.balance.weapon).toBe(1);
    expect(ids(weaponCreditOffer(wallet, s.bestStreak, []))).toEqual(['scatter', 'rocket', 'chain', 'laser', 'nuke']);
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
      expect(r.id).not.toContain('@');
    }
    expect(creditRewardById('nope')).toBeUndefined();
  });

  it('finds a repeating reward by its full claim key, and still explains retired ones', () => {
    expect(creditRewardById('yes-every-7@g1:2026-10-19')?.id).toBe('yes-every-7');
    expect(creditReason('yes-every-30@g1:2026-11-11')).toBe('for every 30 Yeses in a row');
    expect(creditReason('zeros-2')).toBe('for reaching 2 zeros');
    expect(creditReason('yes-run-30')).toBe('for 30 Yeses in a row');
    expect(creditReason('nope')).toBeUndefined();
  });

  it('counts a one-time reward as paid when it, or the reward it took over from, was claimed', () => {
    const zeros = creditRewardById('zeros-3');
    const every = creditRewardById('yes-every-7');
    if (!zeros || !every) throw new Error('missing reward');
    expect(creditRewardClaimed(zeros, [])).toBe(false);
    expect(creditRewardClaimed(zeros, ['zeros-3'])).toBe(true);
    expect(creditRewardClaimed(zeros, ['zeros-2'])).toBe(true);
    expect(creditRewardClaimed(every, ['yes-every-7', 'yes-every-7@g1:2026-10-19'])).toBe(false);
  });

  it('pays a Game credit for the first Yes, once ever', () => {
    const first = claimYes(newGoal(), EMPTY_WALLET, DAY0);
    expect(first.keys).toEqual(['first-yes']);
    expect(first.wallet.balance).toEqual({ game: 1, weapon: 0 });
    // Another goal's first Yes (Win Zero Plus) pays nothing more.
    expect(claimYes({ ...newGoal(), goalId: 'g2' }, first.wallet, DAY0).keys).toEqual([]);
  });

  it('pays nothing for setting a goal, however far along it is', () => {
    expect(creditsEarned({ type: 'goal', goal: newGoal() }, [])).toEqual([]);
    expect(creditsEarned({ type: 'goal', goal: yesDays(newGoal(), DAY0, 30) }, [])).toEqual([]);
  });

  it("doesn't pay the first Yes's credit to a player paid for setting the goal, which it took over from", () => {
    const paid = { balance: { game: 1, weapon: 0 }, claimed: ['goal-set'] };
    expect(claimYes(newGoal(), paid, DAY0).keys).toEqual([]);
    expect(creditReason('goal-set')).toBe('for setting your goal');
  });

  it('pays Game credits for 3 zeros and every 7 in a row, and Weapon credits at 3, 14 and every 30 in a row, across the fall-back', () => {
    expect(GAME_CREDIT_ZEROS).toBe(3);
    expect(GAME_CREDIT_YES_EVERY).toBe(7);
    expect(WEAPON_CREDIT_YES_RUNS).toEqual([3, 14]);
    expect(WEAPON_CREDIT_YES_EVERY).toBe(30);
    // DAY0 is two weeks before the US fall-back on Nov 1.
    const { wallet, log, keys } = yesRun(newGoal(), EMPTY_WALLET, DAY0, 35);
    expect(log).toEqual([
      '2026-10-13 first-yes',
      '2026-10-15 zeros-3',
      '2026-10-15 yes-run-3',
      '2026-10-19 yes-every-7',
      '2026-10-26 yes-every-7',
      '2026-10-26 yes-run-14',
      '2026-11-02 yes-every-7',
      '2026-11-09 yes-every-7',
      '2026-11-11 yes-every-30',
      '2026-11-16 yes-every-7',
    ]);
    // A repeating reward's key names the goal and the day that reached it.
    expect(keys.filter((k) => k.includes('@'))).toEqual([
      'yes-every-7@g1:2026-10-19',
      'yes-every-7@g1:2026-10-26',
      'yes-every-7@g1:2026-11-02',
      'yes-every-7@g1:2026-11-09',
      'yes-every-30@g1:2026-11-11',
      'yes-every-7@g1:2026-11-16',
    ]);
    expect(wallet.balance).toEqual({ game: 7, weapon: 3 });
  });

  it('keeps paying a Weapon credit every 30 in a row, and nothing in between', () => {
    const { log } = yesRun(newGoal(), EMPTY_WALLET, DAY0, 61);
    expect(log.filter((l) => l.endsWith('yes-every-30'))).toEqual(['2026-11-11 yes-every-30', '2026-12-11 yes-every-30']);
    expect(log.filter((l) => l.endsWith('yes-every-7'))).toHaveLength(8);
  });

  it('counts a run across a midnight DST change', () => {
    const start = '2026-09-01'; // Chile springs forward at midnight starting Sep 6
    const { log } = yesRun(newGoal({ tz: SANTIAGO, day: start }), EMPTY_WALLET, start, 14, SANTIAGO);
    expect(log).toEqual([
      '2026-09-01 first-yes',
      '2026-09-03 zeros-3',
      '2026-09-03 yes-run-3',
      '2026-09-07 yes-every-7',
      '2026-09-14 yes-every-7',
      '2026-09-14 yes-run-14',
    ]);
  });

  it('pays a repeating reward once for its Yes, however often that Yes is checked', () => {
    const s = yesDays(newGoal(), DAY0, 7);
    const first = claimCredits(claimedAllBut('none'), { type: 'yes', goal: s });
    expect(first.granted).toEqual([{ kind: 'game', amount: 1, key: 'yes-every-7@g1:2026-10-19' }]);
    expect(claimCredits(first.wallet, { type: 'yes', goal: s }).granted).toEqual([]);
  });

  it("pays each goal's run on its own, even on the same day (Win Zero Plus)", () => {
    const two = { ...newGoal(), goalId: 'g2' };
    const a = yesRun(newGoal(), EMPTY_WALLET, DAY0, 7);
    const b = yesRun(two, a.wallet, DAY0, 7);
    expect(a.keys).toContain('yes-every-7@g1:2026-10-19');
    // The second goal's one-time rewards were paid by the first; its run of 7 pays again.
    expect(b.keys).toEqual(['yes-every-7@g2:2026-10-19']);
    expect(b.wallet.balance.game).toBe(4);
  });

  it('pays every 7 in a row again in a new run', () => {
    let { state, wallet, log } = yesRun(newGoal(), EMPTY_WALLET, DAY0, 9); // through 10-21
    expect(log.filter((l) => l.endsWith('yes-every-7'))).toEqual(['2026-10-19 yes-every-7']);
    state = answerDay(state, '2026-10-22', 'not-today').state;
    ({ log } = yesRun(state, wallet, '2026-10-23', 7));
    expect(log).toEqual(['2026-10-29 yes-every-7']);
  });

  it("doesn't pay for 3 zeros after the 2-zero credit it replaced", () => {
    const { log } = yesRun(newGoal(), { ...EMPTY_WALLET, claimed: ['goal-set', 'zeros-2'] }, DAY0, 3);
    expect(log).toEqual(['2026-10-15 yes-run-3']);
  });

  it('pays the 3-in-a-row credit on the Yes that also unlocks the Twin Barrel', () => {
    const s = yesDays(newGoal(), DAY0, 2);
    const r = answerDay(s, '2026-10-15', 'yes');
    expect(r.outcome).toMatchObject({ kind: 'yes', rewards: { weapons: [expect.objectContaining({ id: 'twin' })] } });
    expect(claimCredits(claimedAllBut('yes-run-3'), { type: 'yes', goal: r.state }).granted).toEqual([
      { kind: 'weapon', amount: 1, key: 'yes-run-3' },
    ]);
  });

  it('never pays a one-time reward twice, even after a reset and a climb back', () => {
    let { state, wallet } = yesRun(newGoal(), EMPTY_WALLET, DAY0, 3); // through 10-15
    state = notTodays(state, '2026-10-16', 7); // the slide runs out: reset
    expect(state.streak).toBe(0);
    const again = yesRun(state, wallet, '2026-10-23', 3);
    expect(again.log).toEqual([]);
    expect(again.wallet).toBe(wallet);
  });

  it('starts "in a row" over after a Not today, which is not a missed day', () => {
    let { state, wallet, log } = yesRun(newGoal(), EMPTY_WALLET, DAY0, 6); // through 10-18
    expect(log).toEqual(['2026-10-13 first-yes', '2026-10-15 zeros-3', '2026-10-15 yes-run-3']);
    state = answerDay(state, '2026-10-19', 'not-today').state;
    ({ state, wallet, log } = yesRun(state, wallet, '2026-10-20', 7));
    // No comeback for the Yes after a Not today; seven more Yeses make 7 in a row.
    expect(log).toEqual(['2026-10-26 yes-every-7']);
  });

  it('starts "in a row" over after a shielded day', () => {
    const s = yesDays(newGoal(), DAY0, 7); // through 10-19: one shield, and 7 in a row
    const missed = notTodays(s, '2026-10-20', 6); // six slips; the next Not today is the final
    const shielded = answerDay(missed, '2026-10-26', 'not-today').state;
    expect(shielded.history.at(-1)).toMatchObject({ result: 'shielded' });
    const { log } = yesRun(shielded, claimedAllBut('none'), '2026-10-27', 7);
    expect(log).toEqual(['2026-11-02 yes-every-7']);
  });

  it('pays the comeback for the first Yes after a missed day, even when the streak is already 3', () => {
    const { state, wallet } = yesRun(newGoal(), EMPTY_WALLET, DAY0, 2); // through 10-14
    const r = claimYes(state, wallet, '2026-10-16', { late: true }); // 10-15 missed: a free day
    expect(r.state.streak).toBe(3);
    expect(yesInRow(r.state)).toBe(1);
    expect(r.keys).toEqual(['zeros-3', 'comeback']);
    // Once ever.
    const later = claimYes(r.state, r.wallet, '2026-10-18', { late: true }); // 10-17 missed
    expect(later.keys).toEqual([]);
  });

  it('lets a player from before credits collect what they already qualify for on their next Yes', () => {
    const s = yesDays(newGoal(), DAY0, 19); // through 10-31
    const r = claimYes(s, EMPTY_WALLET, '2026-11-01');
    expect(r.keys).toEqual(['first-yes', 'zeros-3', 'yes-run-3', 'yes-run-14']);
    expect(r.wallet.balance).toEqual({ game: 2, weapon: 2 });
  });

  it('pays a repeating reward only for the Yes that reaches it, not for marks already passed', () => {
    const s = yesDays(newGoal(), DAY0, 20); // through 11-01: 7 and 14 in a row came and went
    const r = claimYes(s, claimedAllBut('none'), '2026-11-02'); // the 21st
    expect(r.keys).toEqual(['yes-every-7@g1:2026-11-02']);
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
    // The new run reaches 7 in a row.
    expect(yesRun(next.state, next.wallet, '2026-11-11', 4).log).toEqual(['2026-11-14 yes-every-7']);
  });

  it('after 7 free missed days the streak holds, but the run of Yeses starts over', () => {
    const { state, wallet } = yesRun(newGoal(), EMPTY_WALLET, DAY0, 13); // through 10-25
    const back = claimYes(state, wallet, '2026-11-02', { late: true }); // 10-26 .. 11-01 missed, all free
    expect(back.state.streak).toBe(14);
    expect(back.keys).toEqual(['comeback']); // 14 zeros, but not 14 in a row
    const run = yesRun(back.state, back.wallet, '2026-11-03', 13);
    expect(run.log).toEqual(['2026-11-08 yes-every-7', '2026-11-15 yes-every-7', '2026-11-15 yes-run-14']);
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
    expect(creditsEarned({ type: 'yes', goal: state }, []).map((g) => g.key)).toEqual(['first-yes', 'zeros-3', 'yes-run-3']);
  });

  it('makes the first Yes after a day left unanswered on a trip a comeback', () => {
    const s = yesDays(newGoal(), DAY0, 2); // Denver, through 10-14
    const r = answer(s, { answer: 'yes' }, at('2026-10-17', '21:00', TOKYO), TOKYO);
    if (!r.ok) throw new Error(r.reason);
    expect(r.state.history.at(-2)).toMatchObject({ day: '2026-10-15', result: 'missed' });
    expect(creditsEarned({ type: 'yes', goal: r.state }, ['first-yes', 'zeros-2']).map((g) => g.key)).toEqual(['comeback']);
  });
});
