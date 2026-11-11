// Which goals can be archived, and what Past goals shows for each (SPEC 9).
import { describe, expect, it } from '@jest/globals';

import {
  accomplishmentTotals,
  ARCHIVE_MIN_BEST,
  canArchive,
  goalAccomplishments,
  goalRemoval,
  MILESTONES,
} from '../accomplishments';
import { startBreak } from '../breaks';
import { addDays } from '../dates';
import { createGoalWithHeadStart } from '../headStart';
import { resolve } from '../resolve';
import { answerDay, at, DAY0, DENVER, newGoal, notTodays, stateWith, yesDays } from './fixtures';

const headStart = (n: number) =>
  createGoalWithHeadStart({ goalId: 'g1', goal: 'Stop drinking', now: at(DAY0, '12:00'), tz: DENVER, headStart: n });

describe('archiving', () => {
  it('opens once the best run reaches ARCHIVE_MIN_BEST zeros', () => {
    expect(ARCHIVE_MIN_BEST).toBe(7);
    expect(canArchive(yesDays(newGoal(), DAY0, 6))).toBe(false);
    expect(canArchive(yesDays(newGoal(), DAY0, 7))).toBe(true);
    expect(goalRemoval(newGoal())).toBe('delete');
    expect(goalRemoval(yesDays(newGoal(), DAY0, 7))).toBe('archive');
  });

  it('stays open after a slide below it', () => {
    const s = notTodays(yesDays(newGoal(), DAY0, 7), '2026-10-20', 5);
    expect(s.streak).toBe(2);
    expect(canArchive(s)).toBe(true);
  });

  it("counts a head start's days", () => {
    expect(canArchive(headStart(6))).toBe(false);
    expect(canArchive(headStart(7))).toBe(true);
  });
});

describe('goalAccomplishments', () => {
  it('adds up a goal from its first day to the day it ends', () => {
    let s = yesDays(headStart(5), DAY0, 10); // 10-08 .. 10-12 head start, then 10-13 .. 10-22
    s = notTodays(s, '2026-10-23', 3); // 12 zeros
    s = answerDay(s, '2026-10-26', 'yes').state; // a comeback: 13
    // 10-27 .. 11-09 missed (Nov 1 among them): 7 free, 6 slips, then the shield takes the final.
    s = resolve(s, at('2026-11-11', '12:00'), DENVER).state;
    expect(s.history.filter((e) => e.result === 'shielded')).toHaveLength(1);
    expect(goalAccomplishments(s, '2026-11-11')).toEqual({
      firstDay: '2026-10-08',
      lastDay: '2026-11-11',
      days: 35,
      bestStreak: 15,
      bestRun: { from: '2026-10-08', to: '2026-10-22' },
      yesDays: 16,
      headStartDays: 5,
      answered: 14,
      comebacks: 1,
      shieldsUsed: 1,
      breakDays: 0,
      milestones: [7, 14],
    });
  });

  it('counts the days it spent on a break', () => {
    const r = startBreak(yesDays(newGoal(), DAY0, 3), addDays(DAY0, 9), at(addDays(DAY0, 3), '12:00'), DENVER);
    if (!r.ok) throw new Error(r.reason);
    const s = answerDay(r.state, addDays(DAY0, 10), 'yes').state;
    expect(goalAccomplishments(s, addDays(DAY0, 5))).toMatchObject({ breakDays: 3 });
    expect(goalAccomplishments(s, addDays(DAY0, 20))).toMatchObject({ breakDays: 7, yesDays: 4, days: 21 });
  });

  it('keeps the milestones a slide or a reset came after', () => {
    const s = stateWith({ bestStreak: 100, streak: 0 });
    expect(goalAccomplishments(s, DAY0).milestones).toEqual([7, 14, 30, 60, 100]);
    expect(goalAccomplishments(stateWith({ bestStreak: 365 }), DAY0).milestones).toEqual([...MILESTONES]);
  });

  it("doesn't count missed days as answered, paused ones included", () => {
    const s = resolve(yesDays(newGoal(), DAY0, 2), at('2026-11-20', '12:00'), DENVER).state;
    expect(s.history.some((e) => e.paused)).toBe(true);
    expect(goalAccomplishments(s, '2026-11-20')).toMatchObject({ answered: 2, yesDays: 2, comebacks: 0, milestones: [] });
  });

  it('counts its days by the calendar across a time change, and a goal ended on its first day as one', () => {
    const s = yesDays(newGoal({ day: '2026-10-25' }), '2026-10-25', 12); // 10-25 .. 11-05, past Nov 1
    expect(goalAccomplishments(s, addDays('2026-10-25', 11))).toMatchObject({
      days: 12,
      bestRun: { from: '2026-10-25', to: '2026-11-05' },
      milestones: [7],
    });
    expect(goalAccomplishments(newGoal(), DAY0).days).toBe(1);
  });
});

describe('accomplishmentTotals', () => {
  it('adds past goals up', () => {
    const a = yesDays(newGoal(), DAY0, 9);
    const b = answerDay(notTodays(yesDays({ ...newGoal(), goalId: 'g2' }, DAY0, 4), '2026-10-17', 3), '2026-10-20', 'yes').state;
    expect(accomplishmentTotals([a, b])).toEqual({ goals: 2, yesDays: 14, comebacks: 1, bestStreak: 9 });
    expect(accomplishmentTotals([])).toEqual({ goals: 0, yesDays: 0, comebacks: 0, bestStreak: 0 });
  });
});
