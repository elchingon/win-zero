// Reading saved data: upgrade steps run in order, a goal is kept whenever it can be read
// (old, unversioned, or from a newer build), and one that can't be read is flagged for backup.
import { describe, expect, it } from '@jest/globals';

import { EMPTY_WALLET, MODE_IDS, THEME_IDS } from '@/engine';
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

  it("keeps a goal's lock-screen name, and drops one that isn't a name", () => {
    expect(firstGoal(slot({ ...goal, alias: 'Run' }))?.alias).toBe('Run');
    expect(firstGoal(slot({ ...goal, alias: 3 }))).toEqual(goal);
    expect(firstGoal(slot({ ...goal, alias: '  ' }))).toEqual(goal);
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

  it("keeps the earned themes a round's Yes opened, each once, and leaves the key off otherwise", () => {
    const saved = { ...round, unlocks: ['ember', 'sepia', 'ember', 7, 'gold'] };
    expect(firstRound({ goals: [{ goal, round: saved }] })?.unlocks).toEqual(['ember', 'gold']);
    for (const unlocks of [[], ['sepia'], 'ember', null, { ember: true }]) {
      expect(firstRound({ goals: [{ goal, round: { ...round, unlocks } }] })).not.toHaveProperty('unlocks');
    }
    // A round saved before themes, or by Win Zero, has none.
    expect(firstRound({ goals: [{ goal, round }] })).not.toHaveProperty('unlocks');
  });
});

describe('reading move records (SPEC 9)', () => {
  const at = '2026-10-13T18:00:00.000Z';

  it('keeps a known game mode, and reads anything else as the Shooter (null)', () => {
    expect(normalizePersisted({}).gameMode).toBeNull();
    for (const id of MODE_IDS) expect(normalizePersisted({ gameMode: id }).gameMode).toBe(id);
    for (const bad of ['pong', 'Shooter', '', 3, true, { id: 'catch' }, ['catch'], null]) {
      expect(normalizePersisted({ gameMode: bad }).gameMode).toBeNull();
    }
  });

  it('keeps a known theme, and reads anything else as Classic (null)', () => {
    expect(normalizePersisted({}).theme).toBeNull();
    for (const id of THEME_IDS) expect(normalizePersisted({ theme: id }).theme).toBe(id);
    for (const bad of ['sepia', 'Classic', 'Neon Arcade', '', 7, false, { id: 'neon' }, ['neon'], null]) {
      expect(normalizePersisted({ theme: bad }).theme).toBeNull();
    }
  });

  it('keeps a move out with a good id and status, and drops anything else', () => {
    expect(normalizePersisted({}).moveOut).toBeNull();
    const sent = { id: 'a1b2-c3d4', status: 'sent', sentAt: at };
    expect(normalizePersisted({ moveOut: sent }).moveOut).toEqual(sent);
    expect(normalizePersisted({ moveOut: { ...sent, status: 'moved' } }).moveOut).toEqual({ ...sent, status: 'moved' });
    for (const bad of [{ ...sent, id: '../x' }, { ...sent, status: 'gone' }, { ...sent, id: 7 }, 'sent']) {
      expect(normalizePersisted({ moveOut: bad }).moveOut).toBeNull();
    }
    // A lost time doesn't lose the move: it keeps its id, and Win Zero asks whether it finished.
    expect(normalizePersisted({ moveOut: { ...sent, sentAt: 'soon' } }).moveOut).toEqual({ ...sent, sentAt: '1970-01-01T00:00:00.000Z' });
  });

  it('keeps every move taken in under a good id, so its credits never pay twice', () => {
    expect(normalizePersisted({}).imports).toEqual({});
    const record = { at, createdAt: at, game: 2, weapon: 1 };
    expect(normalizePersisted({ imports: { 'a1b2-c3d4': record } }).imports).toEqual({ 'a1b2-c3d4': record });
    expect(normalizePersisted({ imports: { 'a1b2-c3d4': 'yes' } }).imports).toEqual({
      'a1b2-c3d4': { at: '1970-01-01T00:00:00.000Z', createdAt: '1970-01-01T00:00:00.000Z', game: 0, weapon: 0 },
    });
    expect(normalizePersisted({ imports: { '../x': record, __proto__: record } }).imports).toEqual({});
    expect(normalizePersisted({ imports: [record] }).imports).toEqual({});
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

  it('gives a goal set up before credits an empty wallet: what it has reached is paid on its next Yes', () => {
    const goal = yesDays(newGoal(), DAY0, 3);
    expect(migratePersisted({ goal }, 1)).toEqual({ goal, credits: EMPTY_WALLET, bonus: null, ...slots(goal) });
    expect(migratePersisted({ goal }, 0)).toMatchObject({ credits: EMPTY_WALLET });
    // Already at version 2: credits don't run again.
    const earned = { balance: { game: 1, weapon: 0 }, claimed: ['goal-set'] };
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
