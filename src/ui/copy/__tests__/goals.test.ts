import { describe, expect, it } from '@jest/globals';

import { newGoal } from '@/engine/__tests__/fixtures';

import { goalEyebrow, goalFieldLabel } from '../goals';

const MONDAY_FIRST = 2;

describe('naming a goal by its days (SPEC 9)', () => {
  it('calls a goal that checks in every day a daily goal, as Win Zero does', () => {
    expect(goalEyebrow(newGoal(), MONDAY_FIRST)).toBe('Daily goal');
    expect(goalFieldLabel(newGoal())).toBe('Daily goal');
  });

  it('names the days of any other', () => {
    const goal = newGoal({ days: [1, 3, 5] });
    expect(goalEyebrow(goal, MONDAY_FIRST)).toBe('Goal · Mon, Wed, Fri');
    expect(goalEyebrow(newGoal({ days: [1, 2, 3, 4, 5] }), MONDAY_FIRST)).toBe('Goal · Weekdays');
    expect(goalFieldLabel(goal)).toBe('Goal');
  });
});
