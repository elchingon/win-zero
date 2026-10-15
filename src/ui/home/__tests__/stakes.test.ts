// The check-in card's stakes: what Yes and Not today would each do right now.
import { describe, expect, it } from '@jest/globals';

import { stateWith } from '@/engine/__tests__/fixtures';

import { checkInStakes, stakesHint, stakesLine } from '../stakes';

describe('check-in stakes', () => {
  it('says what each answer would do', () => {
    const slip = checkInStakes(stateWith({ streak: 5 }));
    expect(slip).toEqual({ yes: '6 zeros to shoot', notToday: 'one zero comes off' });
    expect(stakesLine(slip)).toBe('Yes: 6 zeros to shoot. Not today: one zero comes off.');
    expect(stakesHint(slip.notToday!)).toBe('One zero comes off.');

    expect(checkInStakes(stateWith({ streak: 5, slide: 6 })).notToday).toBe('a fresh start, from one zero');
    expect(checkInStakes(stateWith({ streak: 5, slide: 6, shields: 1 })).notToday).toBe('a shield keeps your streak');
  });

  it("leaves out Not today when it would cost nothing", () => {
    const fresh = checkInStakes(stateWith({ streak: 0 }));
    expect(fresh).toEqual({ yes: '1 zero to shoot', notToday: null });
    expect(stakesLine(fresh)).toBe('Yes: 1 zero to shoot.');
    expect(stakesHint(fresh.yes)).toBe('1 zero to shoot.');
  });
});
