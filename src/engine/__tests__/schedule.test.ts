// Editing the check-in time, morning time and goal text (SPEC 6 Settings).
import { describe, expect, it } from '@jest/globals';

import { planReminders } from '../reminders';
import { answer, currentCheckInTime, setCheckInTime, setGoalText, setMorningTime } from '../resolve';
import { closesAt, opensAt, pendingWindow, windowFor } from '../windows';
import { at, answerDay, DAY0, DENVER, newGoal, yesDays } from './fixtures';

describe('setCheckInTime', () => {
  it('moving it later keeps the open window open until midnight ending the next day', () => {
    const now = at(DAY0, '21:00');
    const { state } = setCheckInTime(newGoal(), '22:00', now, DENVER);
    expect(currentCheckInTime(state)).toBe('22:00');
    expect(pendingWindow(state, now)?.day).toBe(DAY0);
    expect(closesAt(state, DAY0)).toEqual(at('2026-10-15', '00:00'));
    expect(opensAt(state, '2026-10-14')).toEqual(at('2026-10-14', '22:00'));
    expect(opensAt(state, '2026-10-15')).toEqual(at('2026-10-15', '22:00'));
  });

  it('moving it earlier never closes the open window early, and moves the next check-in', () => {
    const now = at(DAY0, '21:00');
    const { state } = setCheckInTime(newGoal(), '18:00', now, DENVER);
    expect(pendingWindow(state, now)?.day).toBe(DAY0);
    expect(closesAt(state, DAY0)).toEqual(at('2026-10-15', '00:00')); // its original close
    expect(opensAt(state, '2026-10-14')).toEqual(at('2026-10-14', '18:00'));
    expect(windowFor(state, '2026-10-14').closesAt).toEqual(at('2026-10-16', '00:00'));
    expect(opensAt(state, '2026-10-16')).toEqual(at('2026-10-16', '18:00'));
    // The next evening, the open window is still answerable.
    expect(answerDay(state, DAY0, 'yes', { timeDay: '2026-10-14', time: '23:30' }).outcome).toMatchObject({
      day: DAY0,
    });
  });

  it("applies a new time to today's check-in while yesterday's is still open", () => {
    const s = answerDay(newGoal(), DAY0, 'yes').state; // 10-14 left unanswered
    const now = at('2026-10-15', '10:00');
    const { state } = setCheckInTime(s, '11:45', now, DENVER);
    expect(pendingWindow(state, now)?.day).toBe('2026-10-14');
    expect(closesAt(state, '2026-10-14')).toEqual(at('2026-10-16', '00:00')); // unchanged
    expect(opensAt(state, '2026-10-15')).toEqual(at('2026-10-15', '11:45'));
    expect(planReminders(state, now, { reengage: false })[0]).toEqual({
      at: at('2026-10-15', '11:45'),
      kind: 'checkin',
      day: '2026-10-15',
      earlier: '2026-10-14',
    });

    // A time that already passed today opens today's check-in right away.
    const passed = setCheckInTime(s, '09:30', now, DENVER).state;
    expect(opensAt(passed, '2026-10-15')).toEqual(now);
    expect(answer(passed, { answer: 'yes' }, now, DENVER)).toMatchObject({ ok: true, outcome: { day: '2026-10-14' } });
  });

  it("starts from tomorrow once today's check-in has arrived", () => {
    const s = answerDay(newGoal(), DAY0, 'yes').state; // 10-14 left unanswered
    const now = at('2026-10-15', '21:00'); // 10-14 and 10-15 both open
    const { state } = setCheckInTime(s, '22:00', now, DENVER);
    expect(opensAt(state, '2026-10-15')).toEqual(at('2026-10-15', '20:00'));
    expect(opensAt(state, '2026-10-16')).toEqual(at('2026-10-16', '22:00'));
    expect(closesAt(state, '2026-10-14')).toEqual(at('2026-10-16', '00:00'));
  });

  it('an edit after answering applies from the next day', () => {
    const answered = answerDay(newGoal(), DAY0, 'yes').state;
    const { state } = setCheckInTime(answered, '18:00', at(DAY0, '22:00'), DENVER);
    expect(opensAt(state, '2026-10-14')).toEqual(at('2026-10-14', '18:00'));
  });

  it('a window that has not opened yet may open right away under the new time', () => {
    const answered = answerDay(newGoal(), DAY0, 'yes').state;
    const now = at('2026-10-14', '10:00');
    const { state } = setCheckInTime(answered, '08:00', now, DENVER);
    expect(pendingWindow(state, now)?.day).toBe('2026-10-14');
    expect(opensAt(state, '2026-10-14')).toEqual(now);
    expect(opensAt(state, '2026-10-15')).toEqual(at('2026-10-15', '08:00'));

    const later = setCheckInTime(answered, '21:00', now, DENVER).state;
    expect(opensAt(later, '2026-10-14')).toEqual(at('2026-10-14', '21:00'));
  });

  it('catches up first, so a later time cannot reopen a window that already closed', () => {
    const now = at('2026-10-15', '00:30'); // Oct 13 closed at midnight
    const { state, events } = setCheckInTime(newGoal(), '22:00', now, DENVER);
    expect(events.map((e) => e.day)).toEqual([DAY0]);
    expect(state.history.at(-1)).toMatchObject({ day: DAY0, result: 'missed' });
    expect(pendingWindow(state, now)?.day).toBe('2026-10-14');
  });

  it('two edits while the same window is open: it keeps its close, and the latest time applies next', () => {
    const now = at(DAY0, '21:00');
    let s = setCheckInTime(newGoal(), '22:00', now, DENVER).state;
    s = setCheckInTime(s, '18:00', at(DAY0, '21:30'), DENVER).state;
    expect(closesAt(s, DAY0)).toEqual(at('2026-10-15', '00:00'));
    expect(opensAt(s, '2026-10-14')).toEqual(at('2026-10-14', '18:00'));
    expect(opensAt(s, '2026-10-15')).toEqual(at('2026-10-15', '18:00'));
    expect(s.checkInSchedule).toHaveLength(2);
  });

  it('is a no-op when the time is unchanged, and validates input', () => {
    const s = newGoal();
    expect(setCheckInTime(s, '20:00', at(DAY0, '12:00'), DENVER).state).toEqual(s);
    expect(() => setCheckInTime(s, '8:00 PM', at(DAY0, '12:00'), DENVER)).toThrow(RangeError);
  });

  it('keeps the schedule short as days settle', () => {
    let s = newGoal();
    for (let i = 0; i < 10; i++) {
      const day = `2026-10-${13 + i}`;
      s = setCheckInTime(s, i % 2 ? '20:00' : '21:00', at(day, '12:00'), DENVER).state;
      s = answerDay(s, day, 'yes', { time: '22:00' }).state;
    }
    expect(s.streak).toBe(10);
    expect(s.checkInSchedule.length).toBeLessThanOrEqual(2);
  });
});

describe('setMorningTime', () => {
  it('moves the reminder only, never the window', () => {
    const s = setMorningTime(newGoal(), '07:15');
    const w = windowFor(s, DAY0);
    expect(w.remindAt).toEqual(at('2026-10-14', '07:15'));
    expect(w.opensAt).toEqual(at(DAY0, '20:00'));
    expect(() => setMorningTime(s, '7:15')).toThrow(RangeError);
  });
});

describe('setGoalText', () => {
  it('keeps the streak and history', () => {
    const s = yesDays(newGoal(), DAY0, 3);
    const edited = setGoalText(s, '  Stay sober ');
    expect(edited.goal).toBe('Stay sober');
    expect(edited.streak).toBe(3);
    expect(edited.history).toBe(s.history);
    expect(() => setGoalText(s, ' ')).toThrow(RangeError);
  });
});
