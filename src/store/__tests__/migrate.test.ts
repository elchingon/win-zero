// Reading saved data: upgrade steps run in order, a goal is kept whenever it can be read
// (old, unversioned, or from a newer build), and one that can't be read is flagged for backup.
import { describe, expect, it } from '@jest/globals';

import { DAY0, newGoal, yesDays } from '@/engine/__tests__/fixtures';

import { applyUpgrades, hasUnreadableGoal, migratePersisted, normalizePersisted, type Upgrade } from '../migrate';

describe('applyUpgrades', () => {
  const steps: Record<number, Upgrade> = {
    1: (v) => ({ ...v, log: [...(v.log as string[]), '1→2'] }),
    2: (v) => ({ ...v, log: [...(v.log as string[]), '2→3'] }),
  };

  it('runs each step from the saved version up, in order', () => {
    expect(applyUpgrades({ log: [] }, 1, 3, steps)).toEqual({ log: ['1→2', '2→3'] });
    expect(applyUpgrades({ log: [] }, 2, 3, steps)).toEqual({ log: ['2→3'] });
  });

  it('leaves current data, and data from a newer build, as it is', () => {
    const v = { log: [] };
    expect(applyUpgrades(v, 3, 3, steps)).toBe(v);
    expect(applyUpgrades(v, 4, 3, steps)).toBe(v);
  });
});

describe('reading a saved goal', () => {
  const goal = yesDays(newGoal(), DAY0, 3);

  it('keeps a current goal exactly', () => {
    expect(normalizePersisted({ goal }).goal).toEqual(goal);
    expect(hasUnreadableGoal({ goal })).toBe(false);
  });

  it('keeps a goal saved before goals had a version, as the first shape', () => {
    const { version: _version, ...unversioned } = goal;
    expect(normalizePersisted({ goal: unversioned }).goal).toEqual(goal);
  });

  it('keeps a goal from a newer build as it is, unknown fields and all', () => {
    const newer = { ...goal, version: 2, mood: 'steady' };
    expect(normalizePersisted({ goal: newer }).goal).toEqual(newer);
    expect(hasUnreadableGoal({ goal: newer })).toBe(false);
  });

  it("drops a goal that can't be read, and flags it for backup", () => {
    const { history: _history, ...broken } = goal;
    expect(normalizePersisted({ goal: broken }).goal).toBeNull();
    expect(hasUnreadableGoal({ goal: broken })).toBe(true);
    expect(hasUnreadableGoal({ goal: 'not a goal' })).toBe(true);
  });

  it('flags nothing when there was no goal', () => {
    expect(hasUnreadableGoal({ goal: null })).toBe(false);
    expect(hasUnreadableGoal({})).toBe(false);
    expect(hasUnreadableGoal('{not json')).toBe(false);
  });
});

describe('migratePersisted', () => {
  it("upgrades without dropping anything, so the read after it can back up what it can't use", () => {
    const blob = { goal: { goalId: 'g1' }, prefs: { sound: false } };
    expect(migratePersisted(blob, 0)).toEqual(blob);
    expect(migratePersisted(blob, 9)).toEqual(blob); // a newer build's blob
    expect(migratePersisted('not a blob', 0)).toBe('not a blob');
  });
});
