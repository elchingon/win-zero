// Breaks (SPEC 9): days off for travel or illness. They work like rest days: no window, no history
// entry and no effect, so nothing is lost, and a run of missed days already counting carries over.
import { describe, expect, it } from '@jest/globals';

import {
  activeBreak,
  BREAK_MAX_DAYS,
  breakDays,
  breakResumes,
  breakStartDay,
  breakStatus,
  endBreak,
  latestBreakEnd,
  setBreakEnd,
  startBreak,
  type BreakResult,
} from '../breaks';
import { comebackAt } from '../comeback';
import { yesInRow } from '../credits';
import { addDays, weekdayOf } from '../dates';
import { isGoalDay, nextGoalDay, onBreak } from '../goalDays';
import { planReminders } from '../reminders';
import { answer, resolve, setCheckInDays } from '../resolve';
import { isRestDay } from '../summary';
import type { DayKey, GoalState, TimeZone } from '../types';
import { closesAt, endOfDay, firstUnsettledDay, opensAt, pendingWindow, windowFor } from '../windows';
import { answerDay, at, DAY0, DENVER, KIRITIMATI, newGoal, PAGO_PAGO, TOKYO, yesDays } from './fixtures';

const MON_WED_FRI = [1, 3, 5];

/** The accepted result of a break change, or a failed test naming why it was turned down. */
function ok(r: BreakResult): GoalState {
  if (!r.ok) throw new Error(`Break turned down: ${r.reason}`);
  return r.state;
}

/** Start a break at `time` on `day` (local), through `until`. */
function breakAt(s: GoalState, day: DayKey, time: string, until: DayKey, tz: TimeZone = DENVER): GoalState {
  return ok(startBreak(s, until, at(day, time, tz), tz));
}

/** History's days after `from` (exclusive), oldest first. */
function daysAfter(s: GoalState, from: DayKey): DayKey[] {
  return s.history.filter((e) => e.day > from).map((e) => e.day);
}

/** Each entry after the first is the goal day after the one before it. */
function expectChained(s: GoalState) {
  for (let i = 1; i < s.history.length; i++) {
    expect(s.history[i]?.day).toBe(nextGoalDay(s, s.history[i - 1]?.day ?? ''));
  }
}

describe('starting a break', () => {
  it("starts today while today's check-in hasn't opened", () => {
    const s = breakAt(newGoal(), DAY0, '13:00', addDays(DAY0, 4));
    expect(s.breaks).toEqual([{ from: DAY0, to: addDays(DAY0, 4) }]);
    expect(isGoalDay(s, DAY0)).toBe(false);
    expect(firstUnsettledDay(s)).toBe(addDays(DAY0, 5));
    expect(resolve(s, at(addDays(DAY0, 5), '12:00'), DENVER).events).toEqual([]);
  });

  it("starts tomorrow once today's check-in is open, leaving today's window as it was", () => {
    const now = at(DAY0, '20:30');
    const before = pendingWindow(resolve(newGoal(), now, DENVER).state, now);
    const s = breakAt(newGoal(), DAY0, '20:30', addDays(DAY0, 3));
    expect(s.breaks).toEqual([{ from: addDays(DAY0, 1), to: addDays(DAY0, 3) }]);
    expect(pendingWindow(s, now)).toEqual(before);
    expect(closesAt(s, DAY0)).toEqual(endOfDay(addDays(DAY0, 1), DENVER));
    // Today's is still answered on the break's first day.
    const r = answer(s, { answer: 'yes', day: DAY0 }, at(addDays(DAY0, 1), '18:00'), DENVER);
    expect(r.ok && r.state.streak).toBe(1);
  });

  it("starts after yesterday's open check-in, which keeps its close", () => {
    // Yesterday's is open until midnight; today's opens tonight.
    const s0 = newGoal({ day: addDays(DAY0, -1), time: '21:00' });
    const now = at(DAY0, '12:00');
    const yesterday = pendingWindow(resolve(s0, now, DENVER).state, now);
    expect(yesterday?.day).toBe(addDays(DAY0, -1));
    const s = ok(startBreak(s0, addDays(DAY0, 2), now, DENVER));
    expect(s.breaks?.[0]?.from).toBe(DAY0);
    expect(pendingWindow(s, now)).toEqual(yesterday);
  });

  it(`lasts at most ${BREAK_MAX_DAYS} days`, () => {
    const now = at(DAY0, '13:00');
    expect(latestBreakEnd(DAY0)).toBe(addDays(DAY0, BREAK_MAX_DAYS - 1));
    expect(startBreak(newGoal(), latestBreakEnd(DAY0), now, DENVER).ok).toBe(true);
    const r = startBreak(newGoal(), addDays(DAY0, BREAK_MAX_DAYS), now, DENVER);
    expect(!r.ok && r.reason).toBe('too-long');
  });

  it('turns down an end before its start, a start on an open check-in, and dates that are not dates', () => {
    const now = at(DAY0, '20:30');
    const reason = (r: BreakResult) => (r.ok ? null : r.reason);
    expect(reason(startBreak(newGoal(), DAY0, now, DENVER))).toBe('ends-before-start');
    expect(reason(startBreak(newGoal(), addDays(DAY0, 3), now, DENVER, DAY0))).toBe('check-in-open');
    expect(reason(startBreak(newGoal(), '2026-13-01', now, DENVER))).toBe('invalid-day');
    expect(reason(startBreak(newGoal(), addDays(DAY0, 3), now, DENVER, 'soon'))).toBe('invalid-day');
  });

  it('can start later than the next check-in, for a trip ahead', () => {
    const s = ok(startBreak(newGoal(), addDays(DAY0, 9), at(DAY0, '13:00'), DENVER, addDays(DAY0, 5)));
    expect(s.breaks).toEqual([{ from: addDays(DAY0, 5), to: addDays(DAY0, 9) }]);
    expect(isGoalDay(s, addDays(DAY0, 4))).toBe(true);
    expect(nextGoalDay(s, addDays(DAY0, 4))).toBe(addDays(DAY0, 10));
  });

  it('never chains: a new break waits until a check-in has opened since the last', () => {
    let s = breakAt(newGoal(), DAY0, '13:00', addDays(DAY0, 2));
    const back = addDays(DAY0, 3);
    // The break's days are over, but the check-in after it hasn't opened yet.
    const early = startBreak(s, addDays(back, 5), at(back, '12:00'), DENVER);
    expect(!early.ok && early.reason).toBe('already-on-break');
    // Once it opens, the next break can start the day after.
    s = ok(startBreak(s, addDays(back, 5), at(back, '20:30'), DENVER));
    expect(s.breaks).toEqual([
      { from: DAY0, to: addDays(DAY0, 2) },
      { from: addDays(back, 1), to: addDays(back, 5) },
    ]);
    expect(isGoalDay(s, back)).toBe(true);
  });
});

describe("moving a break's end", () => {
  const until = addDays(DAY0, 4);
  const onIt = () => breakAt(newGoal(), DAY0, '13:00', until);

  it('extends up to its longest, until the check-in after it opens', () => {
    const later = ok(setBreakEnd(onIt(), addDays(DAY0, 13), at(addDays(DAY0, 2), '12:00'), DENVER));
    expect(later.breaks).toEqual([{ from: DAY0, to: addDays(DAY0, 13) }]);
    const tooLong = setBreakEnd(onIt(), addDays(DAY0, 14), at(addDays(DAY0, 2), '12:00'), DENVER);
    expect(!tooLong.ok && tooLong.reason).toBe('too-long');
    // The day after it ends, before its check-in opens, there's still time.
    expect(setBreakEnd(onIt(), addDays(DAY0, 7), at(addDays(until, 1), '19:00'), DENVER).ok).toBe(true);
    // Once that check-in opens, the break is over for good.
    const over = setBreakEnd(onIt(), addDays(DAY0, 7), at(addDays(until, 1), '20:30'), DENVER);
    expect(!over.ok && over.reason).toBe('no-break');
  });

  it('shortens to yesterday at the earliest', () => {
    const now = at(addDays(DAY0, 3), '12:00');
    const s = ok(setBreakEnd(onIt(), addDays(DAY0, 2), now, DENVER));
    expect(s.breaks).toEqual([{ from: DAY0, to: addDays(DAY0, 2) }]);
    const past = setBreakEnd(onIt(), addDays(DAY0, 1), now, DENVER);
    expect(!past.ok && past.reason).toBe('in-the-past');
  });

  it("cancels one that hasn't started when the end comes before its start", () => {
    const ahead = ok(startBreak(newGoal(), addDays(DAY0, 6), at(DAY0, '13:00'), DENVER, addDays(DAY0, 3)));
    const s = ok(setBreakEnd(ahead, addDays(DAY0, 2), at(DAY0, '14:00'), DENVER));
    expect(s.breaks).toBeUndefined();
    expect(isGoalDay(s, addDays(DAY0, 3))).toBe(true);
  });
});

describe('Resume now', () => {
  const onIt = () => breakAt(newGoal(), DAY0, '13:00', addDays(DAY0, 9));
  const today = addDays(DAY0, 4);

  it("before check-in time: today's check-in opens at its time", () => {
    const s = ok(endBreak(onIt(), at(today, '12:00'), DENVER));
    expect(s.breaks).toEqual([{ from: DAY0, to: addDays(today, -1) }]);
    expect(firstUnsettledDay(s)).toBe(today);
    expect(opensAt(s, today)).toEqual(at(today, '20:00'));
  });

  it("after check-in time: today's check-in opens straight away", () => {
    const now = at(today, '21:00');
    const s = ok(endBreak(onIt(), now, DENVER));
    expect(pendingWindow(s, now)?.day).toBe(today);
    const r = answer(s, { answer: 'yes' }, now, DENVER);
    expect(r.ok && r.state.streak).toBe(1);
  });

  it("cancels a break that hasn't started", () => {
    const ahead = ok(startBreak(newGoal(), addDays(DAY0, 6), at(DAY0, '13:00'), DENVER, addDays(DAY0, 3)));
    expect(ok(endBreak(ahead, at(DAY0, '14:00'), DENVER)).breaks).toBeUndefined();
  });

  it('leaves a break whose days are over, and says when there is none', () => {
    const s = onIt();
    const after = at(addDays(DAY0, 10), '12:00');
    expect(ok(endBreak(s, after, DENVER)).breaks).toEqual(s.breaks);
    const none = endBreak(newGoal(), at(DAY0, '13:00'), DENVER);
    expect(!none.ok && none.reason).toBe('no-break');
  });

  it("says where today stands, and when check-ins come back", () => {
    const s = ok(startBreak(newGoal(), addDays(DAY0, 6), at(DAY0, '13:00'), DENVER, addDays(DAY0, 2)));
    expect(breakStatus(s, at(DAY0, '14:00'))?.when).toBe('ahead');
    expect(breakStatus(s, at(addDays(DAY0, 4), '12:00'))?.when).toBe('on');
    const over = breakStatus(s, at(addDays(DAY0, 7), '12:00'));
    expect(over?.when).toBe('over');
    expect(over?.resumes.day).toBe(addDays(DAY0, 7));
    expect(breakStatus(s, at(addDays(DAY0, 7), '20:30'))).toBeNull();
    expect(breakStartDay(resolve(newGoal(), at(DAY0, '20:30'), DENVER).state, at(DAY0, '20:30'))).toBe(addDays(DAY0, 1));
  });
});

describe('missed days across a break', () => {
  // Ten Yeses, the last on 2026-10-22, then nothing.
  const lastYes = addDays(DAY0, 9);
  const run = () => yesDays(newGoal(), DAY0, 10);

  it('keeps counting: 5 misses, a break, then misses 6 and 7 are still free and the 8th slips', () => {
    // On the 29th, five misses have settled and the 28th is open.
    let s = breakAt(run(), '2026-10-29', '12:00', '2026-11-04');
    expect(s.breaks).toEqual([{ from: '2026-10-29', to: '2026-11-04' }]);
    s = resolve(s, at('2026-11-08', '12:00'), DENVER).state;
    const missed = s.history.filter((e) => e.day > lastYes);
    expect(missed.map((e) => e.day)).toEqual([
      '2026-10-23',
      '2026-10-24',
      '2026-10-25',
      '2026-10-26',
      '2026-10-27',
      '2026-10-28',
      '2026-11-05',
      '2026-11-06',
    ]);
    expect(missed.map((e) => e.missedInRow)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(missed.at(-2)?.streakAfter).toBe(10);
    expect(missed.at(-1)).toMatchObject({ slip: 1, streakAfter: 9 });
    expectChained(s);
  });

  it('7 misses, a break, then the next miss is the 8th and slips', () => {
    let s = breakAt(run(), '2026-10-30', '12:00', '2026-11-05');
    s = resolve(s, at('2026-11-08', '12:00'), DENVER).state;
    const missed = s.history.filter((e) => e.day > lastYes);
    expect(missed.map((e) => e.day).slice(-2)).toEqual(['2026-10-29', '2026-11-06']);
    expect(missed.at(-2)).toMatchObject({ missedInRow: 7, streakAfter: 10 });
    expect(missed.at(-1)).toMatchObject({ missedInRow: 8, slip: 1, streakAfter: 9 });
  });

  it('a multi-week absence after a break resets the streak and pauses reminders', () => {
    let s = breakAt(yesDays(newGoal(), DAY0, 3), addDays(DAY0, 3), '12:00', addDays(DAY0, 16));
    s = resolve(s, at('2026-12-31', '12:00'), DENVER).state;
    expect(daysAfter(s, addDays(DAY0, 2))[0]).toBe(addDays(DAY0, 17));
    expect(s.history.filter((e) => onBreak(s, e.day))).toEqual([]);
    const reset = s.history.find((e) => e.reset);
    // 7 free misses (Oct 30 to Nov 5), then 3 zeros slip away and the 7th slip resets.
    expect(reset?.day).toBe('2026-11-12');
    expect(s.paused).toBe(true);
    expect(s.streak).toBe(0);
    expectChained(s);
  });
});

describe('time zones', () => {
  it('crosses the fall-back change (2026-11-01) without skipping or repeating a day', () => {
    let s = yesDays(newGoal({ day: '2026-10-28' }), '2026-10-28', 2);
    s = breakAt(s, '2026-10-30', '12:00', '2026-11-03');
    expect(closesAt(s, '2026-10-29')).toEqual(endOfDay('2026-10-30', DENVER));
    expect(opensAt(s, '2026-11-04')).toEqual(at('2026-11-04', '20:00'));
    s = resolve(s, at('2026-11-10', '12:00'), DENVER).state;
    expect(daysAfter(s, '2026-10-29')).toEqual(['2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08']);
    expectChained(s);
  });

  it('crosses the spring-forward change (2027-03-14)', () => {
    let s = yesDays(newGoal({ day: '2027-03-08' }), '2027-03-08', 2);
    s = breakAt(s, '2027-03-10', '12:00', '2027-03-17');
    expect(opensAt(s, '2027-03-18')).toEqual(at('2027-03-18', '20:00'));
    expect(closesAt(s, '2027-03-18')).toEqual(endOfDay('2027-03-19', DENVER));
    s = answerDay(s, '2027-03-18', 'yes').state;
    expect(s.streak).toBe(3);
    expect(yesInRow(s)).toBe(3);
  });

  it('keeps the break through a flight, Denver to Tokyo', () => {
    let s = breakAt(newGoal(), DAY0, '13:00', addDays(DAY0, 6));
    s = resolve(s, at(addDays(DAY0, 2), '12:00', TOKYO), TOKYO).state;
    expect(s.breaks).toEqual([{ from: DAY0, to: addDays(DAY0, 6) }]);
    const back = addDays(DAY0, 7);
    expect(firstUnsettledDay(s)).toBe(back);
    expect(opensAt(s, back)).toEqual(at(back, '20:00', TOKYO));
    s = answerDay(s, back, 'yes', { tz: TOKYO }).state;
    expect(s.history.map((e) => e.day)).toEqual([back]);
  });

  it('jumps a day across the date line as it ends, Pago Pago to Kiritimati and back', () => {
    let s = answerDay(newGoal({ tz: PAGO_PAGO }), DAY0, 'yes', { tz: PAGO_PAGO }).state;
    s = breakAt(s, addDays(DAY0, 1), '12:00', addDays(DAY0, 4), PAGO_PAGO);
    // Late on the break's last day, the phone lands a day ahead.
    s = resolve(s, at(addDays(DAY0, 4), '23:00', PAGO_PAGO), KIRITIMATI).state;
    s = resolve(s, at(addDays(DAY0, 9), '12:00', KIRITIMATI), PAGO_PAGO).state;
    s = resolve(s, at(addDays(DAY0, 14), '12:00', PAGO_PAGO), PAGO_PAGO).state;
    expect(s.breaks).toEqual([{ from: addDays(DAY0, 1), to: addDays(DAY0, 4) }]);
    expect(daysAfter(s, DAY0)[0]).toBe(addDays(DAY0, 5));
    expect(s.history.filter((e) => onBreak(s, e.day))).toEqual([]);
    expectChained(s);
  });
});

describe('weekday schedules', () => {
  it('Mon/Wed/Fri: a two-week break comes back on the next check-in day', () => {
    // DAY0 is a Tuesday: the first check-in is Wednesday.
    const s = breakAt(newGoal({ days: MON_WED_FRI }), DAY0, '13:00', '2026-10-27');
    expect(s.breaks).toEqual([{ from: '2026-10-14', to: '2026-10-27' }]);
    expect(breakResumes(s, s.breaks?.[0] as never).day).toBe('2026-10-28');
    expect(firstUnsettledDay(s)).toBe('2026-10-28');
  });

  it('keeps a break when the days change during it', () => {
    let s = breakAt(newGoal({ days: MON_WED_FRI }), DAY0, '13:00', '2026-10-27');
    s = setCheckInDays(s, [2, 4], at('2026-10-17', '12:00'), DENVER).state;
    expect(s.breaks).toEqual([{ from: '2026-10-14', to: '2026-10-27' }]);
    expect(firstUnsettledDay(s)).toBe('2026-10-29');
    expect(weekdayOf(firstUnsettledDay(s))).toBe(4);
  });

  it("a Sunday-only goal's longest break still finds the next Sunday", () => {
    const s = breakAt(newGoal({ days: [0] }), DAY0, '13:00', latestBreakEnd('2026-10-18'));
    expect(s.breaks).toEqual([{ from: '2026-10-18', to: '2026-10-31' }]);
    expect(nextGoalDay(s, DAY0)).toBe('2026-11-01');
    expect(windowFor(s, '2026-11-01').opensAt).toEqual(at('2026-11-01', '20:00'));
  });
});

describe('what reads goal days', () => {
  it('marks break days apart from rest days', () => {
    const s = breakAt(newGoal({ days: MON_WED_FRI }), DAY0, '13:00', '2026-10-20');
    expect(isRestDay(s, '2026-10-14')).toBe(false); // a Wednesday on the break
    expect(isRestDay(s, '2026-10-15')).toBe(false); // a Thursday on the break
    expect(isRestDay(s, '2026-10-22')).toBe(true); // a Thursday after it
    const settled = resolve(s, at('2026-10-31', '12:00'), DENVER).state;
    expect(isRestDay(settled, '2026-10-16')).toBe(false);
    expect(isRestDay(settled, '2026-10-27')).toBe(true);
  });

  it('counts break days up to a day', () => {
    let s = breakAt(newGoal(), DAY0, '13:00', addDays(DAY0, 2));
    s = ok(startBreak(s, addDays(DAY0, 9), at(addDays(DAY0, 3), '20:30'), DENVER));
    expect(breakDays(s, addDays(DAY0, -1))).toBe(0);
    expect(breakDays(s, addDays(DAY0, 1))).toBe(2);
    expect(breakDays(s, addDays(DAY0, 30))).toBe(3 + 6);
  });

  it('resolves the same however often it runs', () => {
    const s = breakAt(yesDays(newGoal(), DAY0, 2), addDays(DAY0, 2), '12:00', addDays(DAY0, 8));
    const t1 = at(addDays(DAY0, 5), '03:00');
    const t2 = at(addDays(DAY0, 20), '12:00');
    const once = resolve(s, t2, DENVER).state;
    expect(resolve(resolve(s, t1, DENVER).state, t2, DENVER).state).toEqual(once);
    expect(resolve(once, t2, DENVER).state).toEqual(once);
  });

  it("doesn't end Yeses in a row, and isn't a comeback", () => {
    let s = breakAt(yesDays(newGoal(), DAY0, 3), addDays(DAY0, 3), '12:00', addDays(DAY0, 9));
    s = answerDay(s, addDays(DAY0, 10), 'yes').state;
    expect(s.streak).toBe(4);
    expect(yesInRow(s)).toBe(4);
    expect(comebackAt(s)).toBeNull();
    expect(activeBreak(s, at(addDays(DAY0, 10), '21:00'))).toBeNull();
  });

  it('plans no reminder on a break day, and one weekly nudge each', () => {
    // A reset by Oct 27, with reminders paused; then a two-week break from Nov 1.
    let s = resolve(answerDay(newGoal(), DAY0, 'yes').state, at('2026-11-01', '12:00'), DENVER).state;
    expect(s.paused).toBe(true);
    s = breakAt(s, '2026-11-01', '12:00', '2026-11-14');
    const plan = planReminders(s, at('2026-11-01', '12:00'), { reengage: true });
    const days = plan.map((r) => r.day);
    expect(days.length).toBeGreaterThan(3);
    expect(days.filter((d) => onBreak(s, d))).toEqual([]);
    expect(new Set(days).size).toBe(days.length);
    expect([...days].sort()).toEqual(days);
  });
});
