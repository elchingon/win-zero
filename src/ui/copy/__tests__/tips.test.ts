import { describe, expect, it } from '@jest/globals';

import { firstRoundTip } from '../tips';

describe('tip copy', () => {
  it('cheers the first round, says how the app works, and when to come back', () => {
    expect(firstRoundTip({ next: 2, nextWhen: 'tomorrow at 8:00 PM', earnedCredit: true })).toEqual({
      title: 'Day one, done.',
      lines: [
        '“A journey of a thousand miles begins with a single step.” You just took it.',
        'How it works: stick to your goal each day, then check in. Every Yes adds a zero, so your next round has 2 to shoot.',
        'A Not today costs one zero, and your next Yes gets you climbing again.',
        'You earned a Game credit for starting. Spend it on a bonus round any time.',
        'Your next check-in is tomorrow at 8:00 PM.',
      ],
      button: "Let's go",
    });
  });

  it('follows a goal on chosen days (Win Zero Plus), and leaves out a credit that was not earned', () => {
    const tip = firstRoundTip({ next: 2, nextWhen: 'Monday at 7:00 AM', everyDay: false, earnedCredit: false });
    expect(tip.lines[1]).toBe(
      'How it works: stick to your goal on each check-in day, then check in. Every Yes adds a zero, so your next round has 2 to shoot.',
    );
    expect(tip.lines.join(' ')).not.toMatch(/Game credit/);
    expect(tip.lines.at(-1)).toBe('Your next check-in is Monday at 7:00 AM.');
  });
});
