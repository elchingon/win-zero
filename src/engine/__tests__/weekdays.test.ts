// Weekday schedules (SPEC 9): a goal checks in on chosen weekdays. Rest days have no window, no
// history entry and no effect; the grace days and the slide count check-in days.
import { describe, expect, it } from '@jest/globals';

import { addDays, weekdayOf } from '../dates';
import {
  checkInDays,
  EVERY_DAY,
  firstGoalDay,
  isEveryDay,
  isGoalDay,
  latestScheduleEntry,
  nextGoalDay,
  normalizeDays,
  prevGoalDay,
} from '../goalDays';
import { planReminders } from '../reminders';
import {
  answer,
  createGoal,
  firstCheckInOpenAt,
  openedAtSetup,
  resolve,
  setCheckInDays,
  setCheckInTime,
} from '../resolve';
import { isRestDay } from '../summary';
import type { DayKey, GoalState } from '../types';
import { closesAt, firstUnsettledDay, nextWindow, opensAt, pendingWindow, windowFor } from '../windows';
import {
  answerDay,
  at,
  DAY0,
  DENVER,
  KIRITIMATI,
  LA,
  LONDON,
  NEW_YORK,
  newGoal,
  PAGO_PAGO,
  SANTIAGO,
  seeded,
  TOKYO,
} from './fixtures';

const HOUR = 3_600_000;
const MON_FRI = [1, 2, 3, 4, 5];
const MON_WED_FRI = [1, 3, 5];
const WEEKEND = [0, 6];

/** Answer Yes on each listed day, at 21:00 that day in `tz`. */
function yesOn(state: GoalState, days: DayKey[], tz: string = DENVER): GoalState {
  return days.reduce((s, day) => answerDay(s, day, 'yes', { tz }).state, state);
}

/** The goal days from `from` through `to`, by weekday. */
function weekdaysBetween(from: DayKey, to: DayKey, days: number[]): DayKey[] {
  const out: DayKey[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) if (days.includes(weekdayOf(d))) out.push(d);
  return out;
}

describe('normalizeDays', () => {
  it('sorts, drops repeats, and stores every day as no days at all', () => {
    expect(normalizeDays([5, 1, 3, 1])).toEqual([1, 3, 5]);
    expect(normalizeDays([0, 1, 2, 3, 4, 5, 6])).toBeUndefined();
    expect(normalizeDays(undefined)).toBeUndefined();
  });

  it('refuses an empty set and anything that is not a weekday', () => {
    expect(() => normalizeDays([])).toThrow(RangeError);
    expect(() => normalizeDays([7])).toThrow(RangeError);
    expect(() => normalizeDays([1.5])).toThrow(RangeError);
  });
});

describe('a goal with check-in days', () => {
  it('stores an every-day goal exactly as before there was a choice', () => {
    for (const days of [undefined, [...EVERY_DAY]]) {
      const s = newGoal({ days });
      expect(Object.keys(s.checkInSchedule[0]!)).toEqual(['fromDay', 'time', 'tz']);
      expect(isEveryDay(s)).toBe(true);
      expect(checkInDays(s)).toEqual(EVERY_DAY);
    }
    expect(newGoal({ days: MON_FRI }).checkInSchedule[0]?.days).toEqual(MON_FRI);
  });

  it('steps over rest days, both ways', () => {
    const s = newGoal({ days: MON_FRI }); // set up on Tuesday Oct 13
    expect(firstGoalDay(s)).toBe(DAY0);
    expect(isGoalDay(s, '2026-10-17')).toBe(false); // Saturday
    expect(nextGoalDay(s, '2026-10-16')).toBe('2026-10-19'); // Friday → Monday
    expect(prevGoalDay(s, '2026-10-19')).toBe('2026-10-16');
    expect(isEveryDay(s)).toBe(false);
  });

  it('set up on a rest day, starts at the next check-in day', () => {
    const s = newGoal({ days: MON_FRI, day: '2026-10-17', time: '21:00' }); // Saturday night
    expect(firstGoalDay(s)).toBe('2026-10-19');
    expect(firstUnsettledDay(s)).toBe('2026-10-19');
    expect(nextWindow(s).opensAt).toEqual(at('2026-10-19', '20:00'));
    expect(openedAtSetup(s)).toBe(false);
    expect(pendingWindow(s, at('2026-10-17', '21:00'))).toBeNull();
    const base = { checkInTime: '20:00', tz: DENVER };
    expect(firstCheckInOpenAt({ ...base, days: MON_FRI, now: at('2026-10-17', '21:00') })).toBe(false);
    expect(firstCheckInOpenAt({ ...base, days: MON_FRI, now: at('2026-10-16', '21:00') })).toBe(true);
    expect(firstCheckInOpenAt({ ...base, now: at('2026-10-17', '21:00') })).toBe(true);
  });

  it('Sunday only: one window a week', () => {
    const s = newGoal({ days: [0] });
    expect(firstGoalDay(s)).toBe('2026-10-18');
    expect(nextGoalDay(s, '2026-10-18')).toBe('2026-10-25');
    expect(closesAt(s, '2026-10-18')).toEqual(at('2026-10-20', '00:00'));
  });
});

describe('the window before a rest day', () => {
  it('closes at midnight at the end of the next calendar day, with its reminder that morning', () => {
    const s = newGoal({ days: MON_FRI });
    const friday = windowFor(s, '2026-10-16');
    expect(friday.opensAt).toEqual(at('2026-10-16', '20:00'));
    expect(friday.remindAt).toEqual(at('2026-10-17', '09:00')); // Saturday, about "yesterday"
    expect(friday.closesAt).toEqual(at('2026-10-18', '00:00')); // Saturday midnight
    expect(windowFor(s, '2026-10-15').closesAt).toEqual(at('2026-10-17', '00:00')); // Thursday as ever
  });

  it('sends its reminder on the rest day even with the reminder at check-in time', () => {
    const s = createGoal({ goalId: 'g', goal: 'Run', days: MON_FRI, morningTime: '20:00', now: at(DAY0, '12:00'), tz: DENVER });
    expect(windowFor(s, '2026-10-16').remindAt).toEqual(at('2026-10-17', '20:00'));
    expect(windowFor(s, '2026-10-15').remindAt).toBeNull(); // Friday's check-in serves
  });

  it("can be answered until Saturday midnight, and after that it's a missed day", () => {
    const s = yesOn(newGoal({ days: MON_FRI }), ['2026-10-13', '2026-10-14', '2026-10-15']);
    const late = answer(s, { answer: 'yes', day: '2026-10-16' }, at('2026-10-17', '23:59'), DENVER);
    expect(late.ok).toBe(true);
    const tooLate = answer(s, { answer: 'yes', day: '2026-10-16' }, at('2026-10-18', '00:01'), DENVER);
    expect(tooLate.ok).toBe(false);
    if (tooLate.ok) return;
    expect(tooLate.reason).toBe('expired');
    expect(tooLate.state.history.at(-1)).toMatchObject({ day: '2026-10-16', result: 'missed', missedInRow: 1 });
  });

  it('leaves the weekend out of history entirely', () => {
    const s = yesOn(newGoal({ days: MON_FRI }), ['2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16']);
    const monday = resolve(s, at('2026-10-19', '12:00'), DENVER).state;
    expect(monday.history).toHaveLength(4);
    expect(monday.lastSettledDay).toBe('2026-10-16');
    expect(monday.streak).toBe(4);
    expect(pendingWindow(monday, at('2026-10-19', '21:00'))?.day).toBe('2026-10-19');
  });

  it("Monday's check-in doesn't wait on Friday: the weekend is between them", () => {
    const s = newGoal({ days: MON_FRI });
    const plan = planReminders(s, at('2026-10-16', '21:00'), { reengage: false });
    const monday = plan.find((r) => r.kind === 'checkin' && r.day === '2026-10-19');
    expect(monday?.earlier).toBeUndefined();
    expect(plan.find((r) => r.kind === 'checkin' && r.day === '2026-10-20')?.earlier).toBe('2026-10-19');
  });
});

describe('missed check-ins count check-in days', () => {
  it('six weeks away on Mon/Wed/Fri: 7 free, then 6 slips, then the final on the 14th', () => {
    let s = yesOn(newGoal({ days: MON_WED_FRI }), ['2026-10-14', '2026-10-16', '2026-10-19']);
    expect(s.streak).toBe(3);
    const r = resolve(s, at('2026-12-02', '12:00'), DENVER);
    s = r.state;
    const missed = s.history.slice(3);
    expect(missed.map((e) => e.day)).toEqual(weekdaysBetween('2026-10-21', '2026-11-30', MON_WED_FRI));
    expect(missed).toHaveLength(18);
    missed.forEach((e, i) => expect(e.missedInRow).toBe(i + 1));
    expect(missed.slice(0, 7).every((e) => e.slip === undefined)).toBe(true);
    expect(missed.slice(7, 13).map((e) => e.slip)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(missed[13]).toMatchObject({ day: '2026-11-20', slip: 7, reset: true });
    expect(missed.slice(14).every((e) => e.paused)).toBe(true);
    expect(s.paused).toBe(true);
    expect(s.streak).toBe(0);
    expect(r.events.filter((e) => e.final === 'reset').map((e) => e.day)).toEqual(['2026-11-20']);
  });

  it('a shield saves the 14th missed check-in', () => {
    const yeses = weekdaysBetween('2026-10-14', '2026-10-28', MON_WED_FRI); // 7 of them: a shield
    let s = yesOn(newGoal({ days: MON_WED_FRI }), yeses);
    expect(s.shields).toBe(1);
    s = resolve(s, at('2026-12-02', '12:00'), DENVER).state;
    const fourteenth = s.history.find((e) => e.missedInRow === 14);
    expect(fourteenth).toMatchObject({ day: '2026-11-30', result: 'shielded', slip: 7 });
    expect(s.shields).toBe(0);
    expect(s.streak).toBe(1);
    expect(s.paused).toBe(false);
  });

  it('settles the same whether it catches up once or in steps, and twice changes nothing', () => {
    const s = yesOn(newGoal({ days: MON_WED_FRI }), ['2026-10-14']);
    const once = resolve(s, at('2026-12-02', '12:00'), DENVER).state;
    let stepped = s;
    for (let t = at('2026-10-15', '03:00').getTime(); t < at('2026-12-02', '12:00').getTime(); t += 17 * HOUR) {
      stepped = resolve(stepped, new Date(t), DENVER).state;
    }
    stepped = resolve(stepped, at('2026-12-02', '12:00'), DENVER).state;
    expect(stepped).toEqual(once);
    expect(resolve(once, at('2026-12-02', '12:00'), DENVER).state).toEqual(once);
  });
});

describe('daylight saving on a weekend goal', () => {
  it('fall-back: Saturday is open 29 hours, through Sunday', () => {
    const s = newGoal({ days: WEEKEND });
    const sat = windowFor(s, '2026-10-31');
    expect(sat.opensAt).toEqual(at('2026-10-31', '20:00'));
    expect(sat.closesAt).toEqual(at('2026-11-02', '00:00'));
    expect(sat.closesAt.getTime() - sat.opensAt.getTime()).toBe(29 * HOUR);
    const sun = windowFor(s, '2026-11-01');
    expect(sun.closesAt).toEqual(at('2026-11-03', '00:00')); // Monday is a rest day
    expect(nextGoalDay(s, '2026-11-01')).toBe('2026-11-07');
  });

  it('spring-forward: Saturday is open 27 hours', () => {
    const s = newGoal({ days: WEEKEND, day: '2027-03-01' });
    const sat = windowFor(s, '2027-03-13');
    expect(sat.closesAt.getTime() - sat.opensAt.getTime()).toBe(27 * HOUR);
  });

  it('a check-in time inside the gap on a check-in Sunday moves past it', () => {
    const s = newGoal({ days: WEEKEND, day: '2027-03-01', checkInTime: '02:30' });
    expect(opensAt(s, '2027-03-14')).toEqual(at('2027-03-14', '03:30'));
  });

  it("Santiago: Friday's window closes at a midnight that doesn't exist, at 01:00 instead", () => {
    const s = newGoal({ days: MON_FRI, tz: SANTIAGO, day: '2026-09-01' });
    expect(closesAt(s, '2026-09-04')).toEqual(at('2026-09-06', '01:00', SANTIAGO));
    const r = answer(s, { answer: 'yes', day: '2026-09-04' }, at('2026-09-05', '23:30', SANTIAGO), SANTIAGO);
    // Tuesday to Thursday were missed on the way; Friday is still open late Saturday.
    expect(r.ok).toBe(true);
  });
});

describe('travel', () => {
  it('LA → Tokyo on Friday night: Friday stays open, Monday opens on Tokyo time', () => {
    const s = yesOn(newGoal({ days: MON_FRI, tz: LA }), ['2026-10-13', '2026-10-14', '2026-10-15'], LA);
    const now = at('2026-10-16', '21:00', LA);
    const before = closesAt(s, '2026-10-16');
    const after = resolve(s, now, TOKYO).state;
    expect(pendingWindow(after, now)?.day).toBe('2026-10-16');
    expect(closesAt(after, '2026-10-16').getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(latestScheduleEntry(after)).toMatchObject({ fromDay: '2026-10-19', tz: TOKYO, days: MON_FRI });
    expect(opensAt(after, '2026-10-19')).toEqual(at('2026-10-19', '20:00', TOKYO));
  });

  it('across the date line, a check-in day the calendar jumps over still gets its window', () => {
    let s = newGoal({ days: MON_FRI, tz: PAGO_PAGO });
    // Tuesday 21:00 in Pago Pago is already Wednesday night on Kiritimati.
    s = resolve(s, at(DAY0, '21:00', PAGO_PAGO), KIRITIMATI).state;
    s = resolve(s, at('2026-11-02', '12:00', KIRITIMATI), KIRITIMATI).state;
    expect(s.history.map((e) => e.day)).toEqual(weekdaysBetween(DAY0, s.lastSettledDay!, MON_FRI));
  });
});

describe('changing the days', () => {
  const sat = (time: string) => at('2026-10-17', time);

  it('every day → weekdays on Saturday morning: Saturday rests, Friday stays open', () => {
    const s = yesOn(newGoal(), ['2026-10-13', '2026-10-14', '2026-10-15']); // Friday unanswered
    const r = setCheckInDays(s, MON_FRI, sat('10:00'), DENVER);
    expect(latestScheduleEntry(r.state)).toMatchObject({ fromDay: '2026-10-17', days: MON_FRI });
    expect(pendingWindow(r.state, sat('10:00'))?.day).toBe('2026-10-16');
    expect(closesAt(r.state, '2026-10-16')).toEqual(closesAt(s, '2026-10-16'));
    expect(isGoalDay(r.state, '2026-10-17')).toBe(false);
    expect(nextGoalDay(r.state, '2026-10-16')).toBe('2026-10-19');
  });

  it("weekdays → every day on Saturday night: Saturday's check-in opens straight away", () => {
    const s = yesOn(newGoal({ days: MON_FRI }), ['2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16']);
    const now = sat('21:00');
    const r = setCheckInDays(s, [...EVERY_DAY], now, DENVER);
    expect(Object.keys(latestScheduleEntry(r.state))).not.toContain('days');
    expect(isEveryDay(r.state)).toBe(true);
    expect(pendingWindow(r.state, now)?.day).toBe('2026-10-17');
    expect(opensAt(r.state, '2026-10-17')).toEqual(now);
  });

  it("never touches a check-in that has arrived: dropping today's day starts tomorrow", () => {
    const s = yesOn(newGoal({ days: MON_FRI }), ['2026-10-13', '2026-10-14', '2026-10-15']);
    const now = at('2026-10-16', '21:00'); // Friday's window is open
    const r = setCheckInDays(s, [1, 2, 3, 4], now, DENVER);
    expect(latestScheduleEntry(r.state).fromDay).toBe('2026-10-17');
    expect(isGoalDay(r.state, '2026-10-16')).toBe(true);
    expect(pendingWindow(r.state, now)?.day).toBe('2026-10-16');
    expect(closesAt(r.state, '2026-10-16')).toEqual(closesAt(s, '2026-10-16'));
    expect(isGoalDay(r.state, '2026-10-23')).toBe(false);
  });

  it('changes nothing when the days are the same', () => {
    const s = newGoal({ days: MON_FRI });
    const r = setCheckInDays(s, [5, 4, 3, 2, 1], at(DAY0, '13:00'), DENVER);
    expect(r.state.checkInSchedule).toEqual(s.checkInSchedule);
  });

  it('keeps the days through a new check-in time and a new time zone', () => {
    let s = newGoal({ days: MON_WED_FRI });
    s = setCheckInTime(s, '07:00', at('2026-10-14', '12:00'), DENVER).state;
    expect(latestScheduleEntry(s).days).toEqual(MON_WED_FRI);
    s = resolve(s, at('2026-10-15', '12:00'), NEW_YORK).state;
    expect(latestScheduleEntry(s)).toMatchObject({ tz: NEW_YORK, days: MON_WED_FRI });
  });

  it('keeps old rest days on the calendar after their schedule is pruned', () => {
    let s = yesOn(newGoal({ days: MON_FRI }), weekdaysBetween(DAY0, '2026-10-23', MON_FRI));
    s = setCheckInDays(s, [...EVERY_DAY], at('2026-10-24', '10:00'), DENVER).state;
    s = yesOn(s, ['2026-10-24', '2026-10-25', '2026-10-26']);
    expect(s.checkInSchedule).toHaveLength(1); // the weekday entry is gone
    expect(isRestDay(s, '2026-10-17')).toBe(true); // a past Saturday: history says so
    expect(isRestDay(s, '2026-10-16')).toBe(false);
    expect(isRestDay(s, '2026-10-24')).toBe(false); // the first Saturday after the change
    expect(isRestDay(s, '2026-10-31')).toBe(false); // every day now
    expect(isRestDay(s, '2026-10-01')).toBe(false); // before the goal began
  });

  it('marks upcoming rest days from the schedule', () => {
    const s = newGoal({ days: MON_FRI });
    expect(isRestDay(s, '2026-10-17')).toBe(true);
    expect(isRestDay(s, '2026-10-19')).toBe(false);
  });
});

describe('reminders on a weekday goal', () => {
  it('cover 14 check-in days, about three weeks of Mon–Fri, with nothing asked on a rest day', () => {
    const s = newGoal({ days: MON_FRI, day: '2026-10-19' });
    const plan = planReminders(s, at('2026-10-19', '12:00'), { reengage: true });
    const checkIns = plan.filter((r) => r.kind === 'checkin');
    // 14 windows to the reset, plus the next check-in, which opens before the reset lands.
    expect(checkIns.map((r) => r.day)).toEqual(weekdaysBetween('2026-10-19', '2026-11-06', MON_FRI));
    for (const r of plan) {
      expect(isGoalDay(s, r.day)).toBe(true);
      if (r.kind !== 'morning') expect(MON_FRI).toContain(weekdayOf(r.day));
    }
    const nudges = plan.filter((r) => r.kind === 'reengage');
    expect(nudges.length).toBeGreaterThan(0);
  });

  it('lands weekly nudges on check-in days', () => {
    let s = yesOn(newGoal({ days: MON_WED_FRI }), ['2026-10-14']);
    s = resolve(s, at('2026-12-02', '12:00'), DENVER).state;
    expect(s.paused).toBe(true);
    const nudges = planReminders(s, at('2026-12-02', '12:00'), { reengage: true });
    expect(nudges.length).toBeGreaterThan(0);
    for (const r of nudges) {
      expect(r.kind).toBe('reengage');
      expect(MON_WED_FRI).toContain(weekdayOf(r.day));
    }
  });
});

describe('random weekday schedules, flights, edits and answers', () => {
  it('never closes an open window early, never skips or repeats a check-in day, never settles a rest day', () => {
    const zones = [DENVER, LA, NEW_YORK, TOKYO, PAGO_PAGO, KIRITIMATI, LONDON];
    const times = ['00:15', '06:00', '12:30', '18:00', '20:00', '23:59'];
    const daySets = [MON_FRI, MON_WED_FRI, WEEKEND, [0], [2, 4], [...EVERY_DAY], [1, 2, 3, 4, 5, 6]];
    const pick = <T,>(list: readonly T[], r: number): T => list[Math.floor(r * list.length)] as T;

    /** New history entries are exactly the goal days after the last one, by `schedule`'s days. */
    const expectChain = (schedule: GoalState, from: GoalState, to: GoalState) => {
      let last = from.lastSettledDay;
      for (const e of to.history.slice(from.history.length)) {
        expect(e.day).toBe(last === null ? firstGoalDay(schedule) : nextGoalDay(schedule, last));
        last = e.day;
      }
    };

    for (const seed of [3, 11, 29]) {
      const rand = seeded(seed);
      let s = newGoal({ days: pick(daySets, rand()) });
      let t = at(DAY0, '12:00').getTime();
      for (let step = 0; step < 300; step++) {
        t += rand() * 40 * HOUR;
        const now = new Date(t);
        const tz = latestScheduleEntry(s).tz;
        const before = resolve(s, now, tz).state;
        expectChain(s, s, before);
        const open = pendingWindow(before, now);
        const roll = rand();
        let next: GoalState;
        if (roll < 0.15) next = resolve(before, now, pick(zones, rand())).state;
        else if (roll < 0.3) next = setCheckInTime(before, pick(times, rand()), now, tz).state;
        else if (roll < 0.45) next = setCheckInDays(before, pick(daySets, rand()), now, tz).state;
        else if (roll < 0.75) next = answer(before, { answer: rand() < 0.8 ? 'yes' : 'not-today' }, now, tz).state;
        else next = before;
        expectChain(before, before, next);
        s = next;

        if (open && (s.lastSettledDay ?? '') < open.day) {
          expect(closesAt(s, open.day).getTime()).toBeGreaterThanOrEqual(open.closesAt.getTime());
        }
        let day = firstUnsettledDay(s);
        for (let i = 0; i < 6; i++) {
          const after = nextGoalDay(s, day);
          expect(opensAt(s, after).getTime()).toBeGreaterThan(opensAt(s, day).getTime());
          expect(closesAt(s, after).getTime()).toBeGreaterThan(closesAt(s, day).getTime());
          day = after;
        }
      }
      expect(s.history.length).toBeGreaterThan(40);
    }
  });
});
