// More than one goal (SPEC 9): the shared arsenal, and one reminder budget across goals.
import { describe, expect, it } from '@jest/globals';

import { addDays } from '../dates';
import {
  planAllReminders,
  planReminders,
  REENGAGE_NUDGE_COUNT,
  REMINDER_NEAR_WINDOWS,
  type PlannedReminder,
} from '../reminders';
import { answer, createGoal, resolve } from '../resolve';
import { applyYes } from '../rules';
import type { GoalState } from '../types';
import { arsenalReach } from '../weapons';
import { at, DAY0, DENVER, newGoal, seeded, stateWith, TOKYO, yesDays } from './fixtures';

const strip = ({ at: when, kind, day, earlier }: PlannedReminder) => ({ at: when, kind, day, earlier });

function goal(goalId: string, checkInTime = '20:00', tz = DENVER, day = DAY0): GoalState {
  return createGoal({ goalId, goal: `Goal ${goalId}`, checkInTime, now: at(day, '12:00', tz), tz });
}

describe('the shared arsenal', () => {
  it('reaches as far as the best goal, or the record kept for removed ones', () => {
    expect(arsenalReach(0, [])).toBe(0);
    expect(arsenalReach(0, [{ bestStreak: 4 }, { bestStreak: 31 }, { bestStreak: 0 }])).toBe(31);
    expect(arsenalReach(60, [{ bestStreak: 4 }])).toBe(60);
  });

  it("announces a weapon only when a Yes raises the shared best", () => {
    const ctx = { day: DAY0, at: at(DAY0, '21:00'), tz: DENVER };
    // Goal B climbs from 2 to 3 while another goal has reached 20: the Twin Barrel is old news.
    expect(applyYes(stateWith({ streak: 2, bestStreak: 2 }), ctx, 20).rewards.weapons).toEqual([]);
    // B reaches 30 while the best elsewhere is 25: the Chain Zapper is new.
    const zapper = applyYes(stateWith({ streak: 29, bestStreak: 29, runPeak: 29 }), ctx, 25).rewards.weapons;
    expect(zapper.map((w) => w.id)).toEqual(['chain']);
    // One goal alone, as before.
    expect(applyYes(stateWith({ streak: 2, bestStreak: 2 }), ctx).rewards.weapons.map((w) => w.id)).toEqual(['twin']);
  });

  it('passes the reach through an answer', () => {
    const s = yesDays(newGoal(), DAY0, 2);
    const day = addDays(DAY0, 2);
    const shared = answer(s, { answer: 'yes', day, arsenalBest: 14 }, at(day, '21:00'), DENVER);
    const alone = answer(s, { answer: 'yes', day }, at(day, '21:00'), DENVER);
    expect(shared.ok && shared.outcome.kind === 'yes' && shared.outcome.rewards.weapons).toEqual([]);
    expect(alone.ok && alone.outcome.kind === 'yes' && alone.outcome.rewards.weapons.map((w) => w.id)).toEqual(['twin']);
  });
});

describe('planAllReminders', () => {
  it("is planReminders's plan for one goal, whatever its state", () => {
    const rand = seeded(5);
    let s = newGoal();
    let t = at(DAY0, '12:00').getTime();
    for (let step = 0; step < 120; step++) {
      t += rand() * 50 * 3_600_000;
      const now = new Date(t);
      s = resolve(s, now, DENVER).state;
      if (rand() < 0.5) {
        const r = answer(s, { answer: rand() < 0.85 ? 'yes' : 'not-today' }, now, DENVER);
        s = r.state;
      }
      for (const reengage of [true, false]) {
        const all = planAllReminders([s], now, { reengage, budget: 60 });
        expect(all.map(strip)).toEqual(planReminders(s, now, { reengage }).map(strip));
        expect(all.every((r) => r.goalId === s.goalId)).toBe(true);
      }
    }
  });

  it('three goals share the budget: each keeps its next windows, and the first nudge survives', () => {
    const goals = [goal('a', '20:00'), goal('b', '07:00'), goal('c', '20:00', TOKYO)];
    const now = at(DAY0, '13:00');
    const plan = planAllReminders(goals, now, { reengage: true, budget: 60 });
    const unlimited = planAllReminders(goals, now, { reengage: true, budget: Infinity });
    expect(unlimited.length).toBeGreaterThan(60);
    expect(plan).toHaveLength(60);
    for (const g of goals) {
      const own = unlimited.filter((r) => r.goalId === g.goalId && r.kind !== 'reengage');
      const nearDays = [...new Set(own.map((r) => r.day))].slice(0, REMINDER_NEAR_WINDOWS);
      for (const r of own.filter((x) => nearDays.includes(x.day))) expect(plan).toContainEqual(r);
    }
    const nudges = unlimited.filter((r) => r.kind === 'reengage');
    expect(nudges).toHaveLength(REENGAGE_NUDGE_COUNT);
    expect(plan).toContainEqual(nudges[0]);
    // In time order, and the rest of the budget went to the earliest of the other daily reminders.
    const times = plan.map((r) => r.at.getTime());
    expect(times).toEqual([...times].sort((x, y) => x - y));
    const key = (r: PlannedReminder & { goalId: string }) => `${r.goalId}:${r.kind}:${r.day}`;
    const kept = new Set(plan.map(key));
    const nearKeys = new Set(
      goals.flatMap((g) => {
        const own = unlimited.filter((r) => r.goalId === g.goalId && r.kind !== 'reengage');
        const days = [...new Set(own.map((r) => r.day))].slice(0, REMINDER_NEAR_WINDOWS);
        return own.filter((r) => days.includes(r.day)).map(key);
      }),
    );
    const later = unlimited.filter((r) => r.kind !== 'reengage' && !nearKeys.has(key(r)));
    const keptLater = later.filter((r) => kept.has(key(r)));
    const droppedLater = later.filter((r) => !kept.has(key(r)));
    expect(keptLater.length).toBeGreaterThan(0);
    expect(droppedLater.length).toBeGreaterThan(0);
    const lastKeptLater = Math.max(...keptLater.map((r) => r.at.getTime()));
    expect(droppedLater.every((r) => r.at.getTime() >= lastKeptLater)).toBe(true);
  });

  it('holds nudges back while another goal still asks every day', () => {
    // Goal a has been away long enough to pause; goal b was just set up.
    const away = resolve(goal('a'), at('2026-11-20', '12:00'), DENVER).state;
    expect(away.paused).toBe(true);
    const fresh = goal('b', '20:00', DENVER, '2026-11-20');
    const now = at('2026-11-20', '13:00');
    const plan = planAllReminders([away, fresh], now, { reengage: true, budget: 60 });
    const nudges = plan.filter((r) => r.kind === 'reengage');
    const lastDaily = Math.max(...plan.filter((r) => r.kind !== 'reengage').map((r) => r.at.getTime()));
    expect(nudges.length).toBeGreaterThan(0);
    expect(nudges.every((r) => r.goalId === 'b' && r.at.getTime() > lastDaily)).toBe(true);
    expect(plan.some((r) => r.goalId === 'a')).toBe(false); // paused: no daily reminders
  });

  it('keeps the nearest windows first under a tiny budget, and nothing under none', () => {
    const goals = [goal('a', '20:00'), goal('b', '18:00')];
    const now = at(DAY0, '13:00');
    const plan = planAllReminders(goals, now, { reengage: true, budget: 3 });
    expect(plan).toHaveLength(3);
    // Both mornings come at 09:00: a tie goes to the goal listed first.
    expect(plan.map((r) => [r.goalId, r.kind, r.day])).toEqual([
      ['b', 'checkin', DAY0],
      ['a', 'checkin', DAY0],
      ['a', 'morning', DAY0],
    ]);
    expect(planAllReminders(goals, now, { reengage: true, budget: 0 })).toEqual([]);
  });
});
