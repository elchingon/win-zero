import { describe, expect, it } from '@jest/globals';

import {
  BONUS_MAX_N,
  GAME_CREDIT_YES_EVERY,
  GAME_CREDIT_ZEROS,
  MISSED_GRACE_DAYS,
  SLIDE_FINAL,
  WEAPON_CREDIT_YES_EVERY,
  WEAPON_CREDIT_YES_RUNS,
} from '@/engine';
import { formatCount } from '@/lib/format';

import { howItWorks, reminderWhen, rules, RULES } from '../rules';

const words = (notifications: boolean) =>
  howItWorks({ notifications })
    .flatMap((s) => [s.title, ...s.body])
    .join(' ');

describe('howItWorks', () => {
  it('counts missed check-ins, and explains rest days, once a goal skips days (SPEC 9)', () => {
    const daily = words(true);
    const someDays = howItWorks({ notifications: true, appName: 'Win Zero Plus', everyDay: false });
    const text = someDays.flatMap((s) => [s.title, ...s.body]).join(' ');
    expect(text).toContain(`The first ${MISSED_GRACE_DAYS} missed check-ins in a row cost nothing.`);
    expect(text).toContain('Rest days have no check-in, so nothing is gained or lost on them.');
    expect(text).toContain('On each check-in day, at your check-in time, Win Zero Plus asks one question');
    expect(someDays[0]?.title).toBe('The check-in question');
    // The weekly nudge still comes once a week; only the free misses are counted in check-ins.
    expect(text).not.toContain('days in a row');
    // Every day, as in Win Zero: the same words as before.
    expect(howItWorks({ notifications: true, everyDay: true })).toEqual(howItWorks({ notifications: true }));
    expect(daily).not.toContain('Rest days');
  });


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

  it('says which app asks', () => {
    expect(words(true)).toContain('Win Zero asks one question');
    const plus = howItWorks({ notifications: true, appName: 'Win Zero Plus' })
      .flatMap((s) => s.body)
      .join(' ');
    expect(plus).toContain('Win Zero Plus asks one question');
    expect(RULES[0]?.text).toContain('Win Zero asks');
    expect(rules('Win Zero Plus')[0]?.text).toContain('Win Zero Plus asks');
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
    expect(credits).toContain(`for reaching ${GAME_CREDIT_ZEROS} zeros`);
    expect(credits).toContain(`for every ${GAME_CREDIT_YES_EVERY} Yeses in a row`);
    for (const n of WEAPON_CREDIT_YES_RUNS) expect(credits).toContain(`for ${n} Yeses in a row`);
    expect(credits).toContain(`for every ${WEAPON_CREDIT_YES_EVERY} Yeses in a row`);
    expect(credits).toContain('the rest are earned once');
  });
});

describe('reminderWhen', () => {
  it('says when the reminder comes', () => {
    expect(reminderWhen('20:00', '9:00 AM', '09:00')).toBe("Once more at 9:00 AM the next day if you haven't answered yet.");
    expect(reminderWhen('20:00', '11:00 PM', '23:00')).toBe("Once more at 11:00 PM that day if you haven't answered yet.");
    expect(reminderWhen('20:00', '8:00 PM', '20:00')).toContain('one notification a day');
  });
});
