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

/** The first goal stored data reads as. */
const firstGoal = (raw: unknown) => normalizePersisted(raw).goals[0]?.goal ?? null;
const firstRound = (raw: unknown) => normalizePersisted(raw).goals[0]?.round ?? null;

describe('reading a saved goal', () => {
  const goal = yesDays(newGoal(), DAY0, 3);
  const slot = (g: unknown) => ({ goals: [{ goal: g, round: null, seenThrough: null }] });

  it('keeps a current goal exactly, in a slot or in the single-goal shape', () => {
    expect(firstGoal(slot(goal))).toEqual(goal);
    expect(firstGoal({ goal })).toEqual(goal);
    expect(hasUnreadableGoal(slot(goal))).toBe(false);
    expect(hasUnreadableGoal({ goal })).toBe(false);
  });

  it('keeps a goal saved before goals had a version, as the first shape', () => {
    const { version: _version, ...unversioned } = goal;
    expect(firstGoal(slot(unversioned))).toEqual(goal);
  });

  it('keeps a goal from a newer build as it is, unknown fields and all', () => {
    const newer = { ...goal, version: 2, mood: 'steady' };
    expect(firstGoal(slot(newer))).toEqual(newer);
    expect(hasUnreadableGoal(slot(newer))).toBe(false);
  });

  it("drops a goal that can't be read, and flags it for backup", () => {
    const { history: _history, ...broken } = goal;
    expect(firstGoal(slot(broken))).toBeNull();
    expect(hasUnreadableGoal(slot(broken))).toBe(true);
    expect(hasUnreadableGoal({ goal: broken })).toBe(true);
    expect(hasUnreadableGoal({ goal: 'not a goal' })).toBe(true);
  });

  it('flags nothing when there was no goal', () => {
    expect(hasUnreadableGoal({ goal: null })).toBe(false);
    expect(hasUnreadableGoal({ goals: [] })).toBe(false);
    expect(hasUnreadableGoal({})).toBe(false);
    expect(hasUnreadableGoal('{not json')).toBe(false);
  });
});

describe('reading several goals (SPEC 9)', () => {
  const a = { ...yesDays(newGoal(), DAY0, 3), goalId: 'a' };
  const b = { ...yesDays(newGoal(), DAY0, 9), goalId: 'b' };
  const c = { ...newGoal(), goalId: 'c' };
  const { history: _history, ...broken } = { ...newGoal(), goalId: 'x' };

  it('keeps every goal it can read, in order, when one of three is unreadable', () => {
    const raw = { goals: [{ goal: a }, { goal: broken }, { goal: b, seenThrough: '2026-10-14' }] };
    const read = normalizePersisted(raw);
    expect(read.goals.map((s) => s.goal.goalId)).toEqual(['a', 'b']);
    expect(read.goals[1]).toMatchObject({ round: null, seenThrough: '2026-10-14' });
    expect(hasUnreadableGoal(raw)).toBe(true);
  });

  it('keeps one copy of a goal id, active before archived', () => {
    const read = normalizePersisted({
      goals: [{ goal: a }, { goal: a }],
      archived: [{ goal: a, archivedAt: '2026-10-20T00:00:00.000Z' }, { goal: c, archivedAt: 'whenever' }],
    });
    expect(read.goals.map((s) => s.goal.goalId)).toEqual(['a']);
    expect(read.archived).toEqual([{ goal: c, archivedAt: c.createdAt }]);
  });

  it("never lets the arsenal reach less than an archived goal's best", () => {
    const archived = [{ goal: b, archivedAt: '2026-10-20T00:00:00.000Z' }];
    expect(normalizePersisted({ goals: [], archived, arsenalBest: 2 }).arsenalBest).toBe(9);
    expect(normalizePersisted({ goals: [], archived, arsenalBest: 40 }).arsenalBest).toBe(40);
    expect(normalizePersisted({ arsenalBest: -3 }).arsenalBest).toBe(0);
    expect(hasUnreadableGoal({ goals: [], archived: [{ goal: broken }] })).toBe(true);
  });

  it('reads goals that are not a list as none', () => {
    expect(normalizePersisted({ goals: 'all of them' }).goals).toEqual([]);
    expect(normalizePersisted({ goals: [null, 3, { goal: a }] }).goals.map((s) => s.goal.goalId)).toEqual(['a']);
  });
});

describe('reading saved credits and rounds', () => {
  const goal = yesDays(newGoal(), DAY0, 5);
  const round = { day: '2026-10-17', n: 5, rewards: { bomb: true, shield: false, shieldCapped: false, weapons: [] }, played: false };

  it('fills in an empty wallet and no bonus round when there are none', () => {
    expect(normalizePersisted({})).toMatchObject({ credits: EMPTY_WALLET, bonus: null, goals: [], archived: [], arsenalBest: 0 });
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
    expect(firstRound({ goals: [{ goal, round }] })).toEqual({
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
    expect(firstRound({ goals: [{ goal, round: saved }] })).toMatchObject({ rewards: { credits: [grant] }, borrowed: ['nuke'] });
  });
});

describe('migratePersisted', () => {
  /** What the 2 → 3 step adds around a single goal. */
  const slots = (goal: unknown, round: unknown = null, seenThrough: unknown = null) => ({
    goals: goal ? [{ goal, round, seenThrough }] : [],
    archived: [],
    arsenalBest: 0,
  });

  it("upgrades without dropping anything, so the read after it can back up what it can't use", () => {
    const blob = { goal: { goalId: 'g1' }, prefs: { sound: false } };
    expect(migratePersisted(blob, 0)).toEqual({ ...blob, credits: EMPTY_WALLET, bonus: null, ...slots(blob.goal) });
    expect(migratePersisted(blob, 9)).toEqual(blob); // a newer build's blob
    expect(migratePersisted('not a blob', 0)).toBe('not a blob');
  });

  it('pays a goal set up before credits its Game credit, once', () => {
    const goal = yesDays(newGoal(), DAY0, 3);
    const earned = { balance: { game: 1, weapon: 0 }, claimed: ['goal-set'] };
    expect(migratePersisted({ goal }, 1)).toEqual({ goal, credits: earned, bonus: null, ...slots(goal) });
    expect(migratePersisted({ goal }, 0)).toMatchObject({ credits: earned });
    // Already at version 2: credits don't run again.
    const v2 = { goal, credits: earned, bonus: null };
    expect(migratePersisted(v2, 2)).toEqual({ ...v2, ...slots(goal) });
  });

  it('gives a save with no goal an empty wallet', () => {
    expect(migratePersisted({ goal: null }, 1)).toEqual({ goal: null, credits: EMPTY_WALLET, bonus: null, ...slots(null) });
  });

  it('moves the goal, its round and its seen mark into the first slot (2 → 3)', () => {
    const goal = yesDays(newGoal(), DAY0, 3);
    const rewards = { bomb: false, shield: false, shieldCapped: false, weapons: ['twin'], credits: [] };
    const round = { day: '2026-10-15', n: 3, rewards, borrowed: [], played: false };
    const v2 = { goal, round, seenThrough: '2026-10-14', weapon: 'twin' };
    const v3 = migratePersisted(v2, 2);
    expect(v3).toEqual({ ...v2, ...slots(goal, round, '2026-10-14') });
    expect(normalizePersisted(v3).goals).toEqual([{ goal, round, seenThrough: '2026-10-14' }]);
    // Already at version 3: nothing runs again.
    expect(migratePersisted(v3, 3)).toBe(v3);
  });
});
