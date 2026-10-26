import { describe, expect, it } from '@jest/globals';

import { BONUS_MAX_N, CREDIT_REWARDS } from '@/engine';
import { formatCount } from '@/lib/format';

import {
  BONUS_SHEET,
  CREDIT_USES,
  creditCount,
  creditEarned,
  creditHelp,
  creditReveal,
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
    expect(creditEarned({ kind: 'game', amount: 1, key: 'first-yes' })).toBe('Game credit earned for your first Yes.');
    expect(creditEarned({ kind: 'weapon', amount: 1, key: 'comeback' })).toBe(
      'Weapon credit earned for checking in again after a missed day.',
    );
    expect(creditEarned({ kind: 'weapon', amount: 2, key: 'pack-1' })).toBe('2 Weapon credits earned.');
    expect(creditEarned({ kind: 'game', amount: 1, key: 'yes-every-7@g1:2026-10-19' })).toBe(
      'Game credit earned for every 7 Yeses in a row.',
    );
    // A round saved before the rewards changed still says why.
    expect(creditEarned({ kind: 'game', amount: 1, key: 'zeros-2' })).toBe('Game credit earned for reaching 2 zeros.');
    expect(creditEarned({ kind: 'game', amount: 1, key: 'goal-set' })).toBe('Game credit earned for setting your goal.');
  });

  it('reveals a Game credit after the round: what came in, why, and how many there are now', () => {
    expect(creditReveal([{ kind: 'game', amount: 1, key: 'yes-every-7@g1:2026-10-19' }], 2)).toEqual({
      badge: '+1',
      title: 'Game credit earned!',
      lines: ['Earned for every 7 Yeses in a row.', 'You now have 2 Game credits. Spend one on a bonus round from Home, any size you like.'],
      button: 'Nice!',
    });
    const two = creditReveal(
      [
        { kind: 'game', amount: 1, key: 'zeros-3' },
        { kind: 'game', amount: 1, key: 'yes-every-7@g1:2026-10-13' },
      ],
      1,
    );
    expect(two.badge).toBe('+2');
    expect(two.title).toBe('Game credits earned!');
    expect(two.lines).toEqual([
      'Earned for reaching 3 zeros.',
      'Earned for every 7 Yeses in a row.',
      'You now have 1 Game credit. Spend one on a bonus round from Home, any size you like.',
    ]);
    // A grant with no reward behind it just says how many there are.
    expect(creditReveal([{ kind: 'game', amount: 3, key: 'pack-1' }], 3).lines).toHaveLength(1);
  });

  it('lists every way to earn each credit', () => {
    expect(creditsEarnedBy('game')).toBe(
      'You earn a Game credit for your first Yes, for reaching 3 zeros and for every 7 Yeses in a row.',
    );
    expect(creditsEarnedBy('weapon')).toBe(
      'You earn a Weapon credit for checking in again after a missed day, for 3 Yeses in a row, for 14 Yeses in a row and for every 30 Yeses in a row.',
    );
    for (const r of CREDIT_REWARDS) expect(creditsEarnedBy(r.kind)).toContain(r.reason);
  });

  it('leaves out the one-time ways already used, and keeps the ones that repeat', () => {
    expect(creditsEarnedBy('game', ['goal-set'])).toBe('You earn a Game credit for reaching 3 zeros and for every 7 Yeses in a row.');
    expect(creditsEarnedBy('game', ['goal-set', 'zeros-2', 'yes-every-7@g1:2026-10-19'])).toBe(
      'You earn a Game credit for every 7 Yeses in a row.',
    );
    expect(creditsEarnedBy('weapon', ['comeback', 'yes-run-3', 'yes-run-14'])).toBe(
      'You earn a Weapon credit for every 30 Yeses in a row.',
    );
  });

  it('explains a Game credit behind its hint: what it plays, how to spend one, how to earn one', () => {
    const help = creditHelp('game', wallet(1, 0, ['goal-set']), 3, false);
    expect(help.title).toBe('Game credits');
    expect(help.lines).toEqual([CREDIT_USES.game, CREDITS_HELP.gameSpend]);
    expect(help.lines.join(' ')).toContain('as many zeros as you like');
    expect(help.status).toBeNull();
    // Every way to earn one, from the engine; the ones already earned are marked, not hidden. The
    // credit for setting the goal, which the first Yes's took over from, counts.
    expect(help.ways).toEqual([
      { label: 'Your first Yes', earned: true },
      { label: 'Reaching 3 zeros', earned: false },
      { label: 'Every 7 Yeses in a row', earned: false },
    ]);
    // The 2-zero credit it replaced counts; a repeating way is never done.
    expect(creditHelp('game', wallet(0, 0, ['zeros-2', 'yes-every-7@g1:2026-10-19']), 3, false).ways).toEqual([
      { label: 'Your first Yes', earned: false },
      { label: 'Reaching 3 zeros', earned: true },
      { label: 'Every 7 Yeses in a row', earned: false },
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
      { label: 'Every 30 Yeses in a row', earned: false },
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
      ...Object.values(creditReveal([{ kind: 'game', amount: 1, key: 'zeros-3' }], 1)).flat(),
    ].join(' ');
    expect(all).not.toMatch(/fail|lose|lost|broke|shame|relapse/i);
  });
});
