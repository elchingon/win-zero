import { describe, expect, it } from '@jest/globals';

import { BONUS_MAX_N, CREDIT_REWARDS } from '@/engine';
import { formatCount } from '@/lib/format';

import {
  BONUS_SHEET,
  CREDIT_USES,
  creditCount,
  creditEarned,
  creditHelp,
  creditsEarnedBy,
  CREDITS_HELP,
  CREDITS_HOME,
} from '../credits';

const wallet = (game: number, weapon: number, claimed: string[] = []) => ({ balance: { game, weapon }, claimed });

describe('credit copy', () => {
  it('counts credits', () => {
    expect(creditCount('game', 1)).toBe('1 Game credit');
    expect(creditCount('weapon', 0)).toBe('0 Weapon credits');
    expect(creditCount('weapon', 3)).toBe('3 Weapon credits');
  });

  it("says what a credit was earned for, from the engine's reward", () => {
    expect(creditEarned({ kind: 'game', amount: 1, key: 'goal-set' })).toBe('Game credit earned for setting your goal.');
    expect(creditEarned({ kind: 'weapon', amount: 1, key: 'comeback' })).toBe(
      'Weapon credit earned for checking in again after a missed day.',
    );
    expect(creditEarned({ kind: 'weapon', amount: 2, key: 'pack-1' })).toBe('2 Weapon credits earned.');
  });

  it('lists every way to earn each credit', () => {
    expect(creditsEarnedBy('game')).toBe('You earn a Game credit for setting your goal and for reaching 2 zeros.');
    for (const r of CREDIT_REWARDS) expect(creditsEarnedBy(r.kind)).toContain(r.reason);
  });

  it('leaves out the ways already used, as each pays once', () => {
    expect(creditsEarnedBy('game', ['goal-set'])).toBe('You earn a Game credit for reaching 2 zeros.');
    expect(creditsEarnedBy('game', ['goal-set', 'zeros-2'])).toBeNull();
    expect(creditsEarnedBy('weapon', ['comeback', 'yes-run-3', 'yes-run-14'])).toBe('You earn a Weapon credit for 30 Yeses in a row.');
  });

  it('explains a Game credit behind its hint: what it plays, how to spend one, how to earn one', () => {
    const help = creditHelp('game', wallet(1, 0, ['goal-set']), 3, false);
    expect(help.title).toBe('Game credits');
    expect(help.lines).toEqual([CREDIT_USES.game, CREDITS_HELP.gameSpend]);
    expect(help.lines.join(' ')).toContain('as many zeros as you like');
    expect(help.status).toBeNull();
    // Every way to earn one, from the engine; the ones already earned are marked, not hidden.
    expect(help.ways).toEqual([
      { label: 'Setting your goal', earned: true },
      { label: 'Reaching 2 zeros', earned: false },
    ]);
    expect(creditHelp('game', wallet(0, 0), 3, true).status).toBe(CREDITS_HELP.bonusWaiting);
  });

  it('explains a Weapon credit behind its hint, and says when there is nothing left to lend', () => {
    const help = creditHelp('weapon', wallet(0, 0, ['comeback', 'yes-run-3']), 3, false);
    expect(help.title).toBe('Weapon credits');
    expect(help.lines).toEqual([CREDIT_USES.weapon]);
    expect(help.ways).toEqual([
      { label: 'Checking in again after a missed day', earned: true },
      { label: '3 Yeses in a row', earned: true },
      { label: '14 Yeses in a row', earned: false },
      { label: '30 Yeses in a row', earned: false },
    ]);
    expect(help.status).toBeNull();
    expect(creditHelp('weapon', wallet(0, 2), 3, false).status).toBeNull();
    expect(creditHelp('weapon', wallet(0, 2), 100, false).status).toBe(CREDITS_HELP.weaponAllUnlocked);
  });

  it('lists exactly the engine’s rewards in the hints', () => {
    const ways = [...creditHelp('game', wallet(0, 0), 0, false).ways, ...creditHelp('weapon', wallet(0, 0), 0, false).ways];
    expect(ways).toHaveLength(CREDIT_REWARDS.length);
    expect(CREDITS_HELP.button('weapon')).toBe('About Weapon credits');
  });

  it('takes the bonus round ceiling from the engine', () => {
    expect(CREDIT_USES.game).toContain(`up to ${formatCount(BONUS_MAX_N)}`);
  });

  it('stays plain and kind', () => {
    const all = [
      ...Object.values(CREDIT_USES),
      creditsEarnedBy('game'),
      creditsEarnedBy('weapon'),
      ...Object.values(CREDITS_HOME).map((v) => (typeof v === 'function' ? v(250) : v)),
      ...Object.values(CREDITS_HELP).flatMap((v) =>
        typeof v === 'function' ? [v('game'), v('weapon')] : typeof v === 'string' ? [v] : Object.values(v),
      ),
      ...Object.values(BONUS_SHEET),
    ].join(' ');
    expect(all).not.toMatch(/fail|lose|lost|broke|shame|relapse/i);
  });
});
