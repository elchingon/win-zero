import { describe, expect, it } from '@jest/globals';

import { BONUS_MAX_N, CREDIT_REWARDS } from '@/engine';
import { formatCount } from '@/lib/format';

import { CREDIT_USES, creditCount, creditEarned, creditsEarnedBy } from '../credits';

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

  it('takes the bonus round ceiling from the engine', () => {
    expect(CREDIT_USES.game).toContain(`up to ${formatCount(BONUS_MAX_N)}`);
  });

  it('stays plain and kind', () => {
    const all = [...Object.values(CREDIT_USES), creditsEarnedBy('game'), creditsEarnedBy('weapon')].join(' ');
    expect(all).not.toMatch(/fail|lose|lost|broke|shame|relapse/i);
  });
});
