// Reading saved data: upgrade steps run in order, a goal is kept whenever it can be read
// (old, unversioned, or from a newer build), and one that can't be read is flagged for backup.
import { describe, expect, it } from '@jest/globals';

import { EMPTY_WALLET } from '@/engine';
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

describe('reading saved credits and rounds', () => {
  const round = { day: '2026-10-17', n: 5, rewards: { bomb: true, shield: false, shieldCapped: false, weapons: [] }, played: false };

  it('fills in an empty wallet and no bonus round when there are none', () => {
    expect(normalizePersisted({})).toMatchObject({ credits: EMPTY_WALLET, bonus: null });
  });

  it('keeps what it can of a damaged wallet', () => {
    const credits = { balance: { game: -1, weapon: 2 }, claimed: ['goal-set', 3, 'goal-set', 'yes-run-3'] };
    expect(normalizePersisted({ credits }).credits).toEqual({ balance: { game: 0, weapon: 2 }, claimed: ['goal-set', 'yes-run-3'] });
    expect(normalizePersisted({ credits: 'lots' }).credits).toEqual(EMPTY_WALLET);
  });

  it('keeps a bonus round that can be played, unplayed when in doubt', () => {
    expect(normalizePersisted({ bonus: { n: 250, borrowed: ['rocket', 'laser-cannon'] } }).bonus).toEqual({
      n: 250,
      borrowed: ['rocket'],
      played: false,
    });
    expect(normalizePersisted({ bonus: { n: 0, borrowed: [], played: false } }).bonus).toBeNull();
    expect(normalizePersisted({ bonus: { n: 1.5 } }).bonus).toBeNull();
  });

  it('gives a round saved before credits no borrowed weapons and no credits', () => {
    expect(normalizePersisted({ round }).round).toEqual({
      ...round,
      rewards: { ...round.rewards, credits: [] },
      borrowed: [],
    });
  });

  it("keeps a round's valid credits and borrowed weapons", () => {
    const grant = { kind: 'weapon', amount: 1, key: 'yes-run-3' };
    const saved = {
      ...round,
      rewards: { ...round.rewards, credits: [grant, { kind: 'coins', amount: 1, key: 'x' }, { kind: 'game', amount: 0, key: 'y' }] },
      borrowed: ['nuke', 'nope'],
    };
    expect(normalizePersisted({ round: saved }).round).toMatchObject({ rewards: { credits: [grant] }, borrowed: ['nuke'] });
  });
});

describe('migratePersisted', () => {
  it("upgrades without dropping anything, so the read after it can back up what it can't use", () => {
    const blob = { goal: { goalId: 'g1' }, prefs: { sound: false } };
    expect(migratePersisted(blob, 0)).toEqual({ ...blob, credits: EMPTY_WALLET, bonus: null });
    expect(migratePersisted(blob, 9)).toEqual(blob); // a newer build's blob
    expect(migratePersisted('not a blob', 0)).toBe('not a blob');
  });

  it('pays a goal set up before credits its Game credit, once', () => {
    const goal = yesDays(newGoal(), DAY0, 3);
    const earned = { balance: { game: 1, weapon: 0 }, claimed: ['goal-set'] };
    expect(migratePersisted({ goal }, 1)).toEqual({ goal, credits: earned, bonus: null });
    expect(migratePersisted({ goal }, 0)).toMatchObject({ credits: earned });
    // Already at version 2: nothing runs again.
    const current = { goal, credits: earned, bonus: null };
    expect(migratePersisted(current, 2)).toBe(current);
  });

  it('gives a save with no goal an empty wallet', () => {
    expect(migratePersisted({ goal: null }, 1)).toEqual({ goal: null, credits: EMPTY_WALLET, bonus: null });
  });
});
