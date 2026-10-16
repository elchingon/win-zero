import { describe, expect, it } from '@jest/globals';

import { BONUS_MAX_N, MISSED_GRACE_DAYS, SLIDE_FINAL, WEAPON_CREDIT_YES_RUNS } from '@/engine';
import { formatCount } from '@/lib/format';

import { howItWorks, reminderWhen } from '../rules';

const words = (notifications: boolean) =>
  howItWorks({ notifications })
    .flatMap((s) => [s.title, ...s.body])
    .join(' ');

describe('howItWorks', () => {
  it('explains reminders where there are notifications', () => {
    const app = words(true);
    expect(app).toContain('from the notification or from Home');
    expect(app).toContain('one more reminder comes');
    expect(app).toContain('Weekly nudge');
  });

  it('never mentions notifications or reminders on the website', () => {
    const web = words(false);
    expect(web).not.toMatch(/notification|reminder|nudge/i);
    expect(web).toContain('Answer Yes or Not today on Home.');
  });

  it('takes its numbers from the engine on both', () => {
    for (const notifications of [true, false]) {
      expect(words(notifications)).toContain(`the first ${MISSED_GRACE_DAYS} days in a row`);
      expect(words(notifications)).toContain(`If slips reach ${SLIDE_FINAL} before your next Yes`);
    }
  });

  it('explains credits, with their numbers from the engine', () => {
    const credits = howItWorks({ notifications: false }).find((s) => s.title === 'Credits')?.body.join(' ') ?? '';
    expect(credits).toContain(`up to ${formatCount(BONUS_MAX_N)}`);
    expect(credits).toContain('for reaching 2 zeros');
    for (const n of WEAPON_CREDIT_YES_RUNS) expect(credits).toContain(`for ${n} Yeses in a row`);
    expect(credits).toContain('Each one is earned once');
  });
});

describe('reminderWhen', () => {
  it('says when the reminder comes', () => {
    expect(reminderWhen('20:00', '9:00 AM', '09:00')).toBe("Once more at 9:00 AM the next day if you haven't answered yet.");
    expect(reminderWhen('20:00', '11:00 PM', '23:00')).toBe("Once more at 11:00 PM that day if you haven't answered yet.");
    expect(reminderWhen('20:00', '8:00 PM', '20:00')).toContain('one notification a day');
  });
});
