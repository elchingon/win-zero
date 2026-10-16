// The reminder plan as notification requests: words, ids, buttons, triggers, the dev clock,
// and the iOS pending limit.
import { describe, expect, it } from '@jest/globals';
import { SchedulableTriggerInputTypes } from 'expo-notifications';

import {
  addDays,
  clockTimeAt,
  dayKeyAt,
  MS_PER_DAY,
  planReminders,
  REENGAGE_NUDGE_COUNT,
  REMINDER_MAX_WINDOWS,
  resolve,
  type GoalState,
} from '@/engine';
import { at, DAY0, DENVER, newGoal, TOKYO, yesDays } from '@/engine/__tests__/fixtures';

import {
  BOTH_OPEN_BODY,
  MAX_SCHEDULED,
  NUDGES,
  reminderRequests,
  TEST_DELAY_SECONDS,
  testCheckInRequest,
  type ReminderInput,
} from '../schedule';
import { readReminderData } from '../shared';

const CHATHAM = 'Pacific/Chatham';

function input(goal: GoalState, now: Date, patch: Partial<ReminderInput> = {}): ReminderInput {
  return { goal, now, tz: DENVER, offsetMs: 0, reengage: false, showGoal: false, ...patch };
}

/** A goal whose run of misses reset the streak, so only weekly nudges are left. */
function pausedGoal() {
  const now = at('2026-11-17', '00:00');
  const goal = resolve({ ...yesDays(newGoal(), DAY0, 20), shields: 0 }, now, DENVER).state;
  expect(goal.paused).toBe(true);
  return { goal, now };
}

describe('reminderRequests', () => {
  it('asks the evening question and the next-morning one, without naming the goal', () => {
    const reqs = reminderRequests(input(newGoal(), at(DAY0, '12:00')));
    expect(reqs).toHaveLength(2 * REMINDER_MAX_WINDOWS + 1); // and the next day's check-in before the reset
    expect(reqs[0]).toEqual({
      identifier: 'checkin-2026-10-13',
      content: {
        title: 'Daily check-in',
        body: 'Did you stick to your goal today?',
        data: { goalId: 'g1', day: DAY0, kind: 'checkin' },
        categoryIdentifier: 'checkin',
        sound: 'default',
      },
      trigger: { type: SchedulableTriggerInputTypes.DATE, date: at(DAY0, '20:00'), channelId: 'checkin' },
    });
    expect(reqs[1]).toEqual({
      identifier: 'morning-2026-10-13',
      content: {
        title: 'Still time to check in',
        body: 'Did you stick to your goal yesterday?',
        data: { goalId: 'g1', day: DAY0, kind: 'morning' },
        categoryIdentifier: 'checkin',
        sound: 'default',
      },
      trigger: { type: SchedulableTriggerInputTypes.DATE, date: at('2026-10-14', '09:00'), channelId: 'checkin' },
    });
    expect(reqs.some((r) => JSON.stringify(r).includes('Stop drinking'))).toBe(false);
  });

  it('asks about today when the reminder comes later the same day', () => {
    const shift = newGoal({ checkInTime: '06:00', morningTime: '14:00' });
    const reqs = reminderRequests(input(shift, at(DAY0, '05:00')));
    expect(reqs[1]).toMatchObject({
      identifier: 'morning-2026-10-13',
      content: { title: 'Still time to check in', body: 'Did you stick to your goal today?', categoryIdentifier: 'checkin' },
      trigger: { date: at(DAY0, '14:00') },
    });
  });

  it("asks without buttons when yesterday is still open, so a tap opens Home on yesterday's card", () => {
    const reqs = reminderRequests(input(newGoal(), at(DAY0, '12:00'), { showGoal: true }));
    const both = reqs.find((r) => r.identifier === 'checkin-2026-10-14');
    expect(both).toEqual({
      identifier: 'checkin-2026-10-14',
      content: {
        title: 'Daily check-in',
        body: BOTH_OPEN_BODY,
        data: { goalId: 'g1', day: '2026-10-14', kind: 'checkin' },
        sound: 'default',
      },
      trigger: { type: SchedulableTriggerInputTypes.DATE, date: at('2026-10-14', '20:00'), channelId: 'checkin' },
    });
    expect(BOTH_OPEN_BODY).not.toContain('Stop drinking');

    // Once yesterday is answered, today's check-in has its buttons again.
    const answered = yesDays(newGoal(), DAY0, 1);
    const plain = reminderRequests(input(answered, at('2026-10-14', '09:00')));
    expect(plain[0]).toMatchObject({
      identifier: 'checkin-2026-10-14',
      content: { body: 'Did you stick to your goal today?', categoryIdentifier: 'checkin' },
    });
  });

  it('names the goal only when the user turned that on', () => {
    const reqs = reminderRequests(input(newGoal(), at(DAY0, '12:00'), { showGoal: true }));
    expect(reqs[0]?.content.body).toBe('Did you stick to “Stop drinking” today?');
    expect(reqs[1]?.content.body).toBe('Did you stick to “Stop drinking” yesterday?');
  });

  it('follows the engine plan exactly: same days, kinds and times, unique ids', () => {
    const goal = yesDays(newGoal(), DAY0, 3);
    const now = at('2026-10-15', '21:00');
    const reqs = reminderRequests(input(goal, now, { reengage: true }));
    const plan = planReminders(goal, now, { reengage: true });
    expect(reqs.map((r) => [r.content.data.kind, r.content.data.day, r.trigger.date])).toEqual(
      plan.map((p) => [p.kind, p.day, p.at]),
    );
    expect(new Set(reqs.map((r) => r.identifier)).size).toBe(reqs.length);
    expect(reqs.every((r) => readReminderData(r.content.data) !== null)).toBe(true);
  });

  it('catches the goal up first, so nothing is planned for days already closed', () => {
    const goal = yesDays(newGoal(), DAY0, 3); // through 10-15, last resolved then
    const now = at('2026-10-21', '00:30'); // 10-16 .. 10-19 have closed; 10-20 is open
    const reqs = reminderRequests(input(goal, now));
    expect(reqs[0]?.identifier).toBe('morning-2026-10-20');
    expect(reqs[1]?.identifier).toBe('checkin-2026-10-21');
    expect(reqs.every((r) => r.trigger.date.getTime() > now.getTime())).toBe(true);
  });

  it('sends weekly nudges with no buttons, no sound and no goal, rotating the wording', () => {
    const { goal, now } = pausedGoal();
    const reqs = reminderRequests(input(goal, now, { reengage: true, showGoal: true }));
    expect(reqs).toHaveLength(REENGAGE_NUDGE_COUNT);
    for (const r of reqs) {
      expect(r.content.data.kind).toBe('reengage');
      expect(r.identifier).toBe(`reengage-${r.content.data.day}`);
      expect(r.content.categoryIdentifier).toBeUndefined();
      expect(r.content.sound).toBeUndefined();
      expect(JSON.stringify(r.content)).not.toContain('Stop drinking');
      expect(NUDGES.map((n) => n.title)).toContain(r.content.title);
    }
    const titles = reqs.map((r) => r.content.title);
    for (let i = 1; i < titles.length; i++) expect(titles[i]).not.toBe(titles[i - 1]);
    expect(reminderRequests(input(goal, now, { reengage: false }))).toEqual([]);
  });

  it('moves every trigger back by the dev clock offset, so the OS fires on real time', () => {
    const offsetMs = 3 * MS_PER_DAY;
    const appNow = at(DAY0, '12:00');
    const realNow = new Date(appNow.getTime() - offsetMs);
    const plain = reminderRequests(input(newGoal(), appNow, { reengage: true }));
    const shifted = reminderRequests(input(newGoal(), appNow, { reengage: true, offsetMs }));
    expect(shifted.map((r) => r.identifier)).toEqual(plain.map((r) => r.identifier));
    shifted.forEach((r, i) => {
      expect(r.trigger.date.getTime()).toBe(plain[i]!.trigger.date.getTime() - offsetMs);
      expect(r.trigger.date.getTime()).toBeGreaterThan(realNow.getTime());
    });
  });

  it('stays well under the iOS limit of 64 pending notifications', () => {
    expect(2 * REMINDER_MAX_WINDOWS + 1 + REENGAGE_NUDGE_COUNT).toBeLessThanOrEqual(MAX_SCHEDULED);
    const cases = [
      input(newGoal(), at(DAY0, '12:00'), { reengage: true }),
      input(yesDays(newGoal(), DAY0, 21), at('2026-11-02', '21:00'), { reengage: true }), // 3 shields
      input(pausedGoal().goal, pausedGoal().now, { reengage: true }),
    ];
    for (const c of cases) expect(reminderRequests(c).length).toBeLessThanOrEqual(37);
  });

  it('lands on local wall times across a DST change (Chatham, +12:45 → +13:45)', () => {
    const start = '2026-09-24'; // Chatham springs forward on 2026-09-27
    const goal = newGoal({ day: start, tz: CHATHAM });
    const reqs = reminderRequests(input(goal, at(start, '12:00', CHATHAM), { tz: CHATHAM }));
    for (const r of reqs) {
      const local = clockTimeAt(r.trigger.date, CHATHAM);
      expect(local).toBe(r.content.data.kind === 'checkin' ? '20:00' : '09:00');
      const expectedDay = r.content.data.kind === 'checkin' ? r.content.data.day : addDays(r.content.data.day, 1);
      expect(dayKeyAt(r.trigger.date, CHATHAM)).toBe(expectedDay);
    }
    expect(reqs.find((r) => r.identifier === 'checkin-2026-09-27')?.trigger.date.toISOString()).toBe(
      '2026-09-27T06:15:00.000Z', // 20:00 at +13:45
    );
  });

  it('follows the device into a new time zone', () => {
    const now = at(DAY0, '12:00'); // 10-14 03:00 in Tokyo; 10-13's window opens on arrival
    const reqs = reminderRequests(input(newGoal(), now, { tz: TOKYO }));
    expect(reqs[0]?.identifier).toBe('morning-2026-10-13');
    expect(reqs[0]?.trigger.date).toEqual(at('2026-10-14', '09:00', TOKYO));
    expect(reqs[1]).toMatchObject({ identifier: 'checkin-2026-10-14', trigger: { date: at('2026-10-14', '20:00', TOKYO) } });
  });
});

describe('testCheckInRequest', () => {
  it('asks about the open window in 10 seconds, with real buttons, marked as a test', () => {
    const goal = yesDays(newGoal(), DAY0, 2); // through 10-14
    const r = testCheckInRequest({ goal, now: at('2026-10-16', '08:00'), tz: DENVER, showGoal: false }, 'test-1');
    expect(r).toEqual({
      identifier: 'test-1',
      content: {
        title: 'Daily check-in',
        body: 'Did you stick to your goal yesterday?',
        data: { goalId: 'g1', day: '2026-10-15', kind: 'checkin', test: true },
        categoryIdentifier: 'checkin',
        sound: 'default',
      },
      trigger: { type: SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: TEST_DELAY_SECONDS, channelId: 'checkin' },
    });
    expect(readReminderData(r.content?.data)).toEqual({ goalId: 'g1', day: '2026-10-15', kind: 'checkin', test: true });
  });

  it("uses the next window's day when none is open", () => {
    const goal = yesDays(newGoal(), DAY0, 2); // through 10-14
    const r = testCheckInRequest({ goal, now: at('2026-10-15', '12:00'), tz: DENVER, showGoal: true }, 'test-2');
    expect(r.content.data).toMatchObject({ day: '2026-10-15' });
    expect(r.content.body).toBe('Did you stick to “Stop drinking” today?');
  });
});

describe('readReminderData', () => {
  it('reads our payload and nothing else', () => {
    expect(readReminderData({ goalId: 'g1', day: DAY0, kind: 'morning' })).toEqual({ goalId: 'g1', day: DAY0, kind: 'morning' });
    expect(readReminderData({ goalId: 'g1', day: DAY0, kind: 'checkin', test: true })?.test).toBe(true);
    expect(readReminderData(null)).toBeNull();
    expect(readReminderData('checkin')).toBeNull();
    expect(readReminderData({ goalId: 'g1', day: '2026-13-40', kind: 'checkin' })).toBeNull();
    expect(readReminderData({ goalId: 'g1', day: DAY0, kind: 'promo' })).toBeNull();
    expect(readReminderData({ day: DAY0, kind: 'checkin' })).toBeNull();
  });
});
