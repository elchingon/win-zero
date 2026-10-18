// Every merge rule for a move into Win Zero Plus (SPEC 9): goals keep their ids, a goal both apps
// have is the user's pick (the one answered later by default), a full Plus refuses, credits
// arrive once, rewards paid stay paid, and the arsenal never reaches less.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it } from '@jest/globals';

import { resolve, type GoalState } from '@/engine';
import { at, DAY0, DENVER, newGoal, notTodays, yesDays } from '@/engine/__tests__/fixtures';
import { harness, ready } from '@/store/__tests__/harness';
import { PLUS_LIMITS } from '@/store/limits';
import { DEFAULT_PERSISTED } from '@/store/migrate';
import type { PersistedState } from '@/store/types';

import { applyImport, lastAnswered, planImport, suggestedCopy, type Choices } from '../merge';

const ID = 'move-0001';
const NOW = at('2026-10-21', '12:00');
const CREATED = at('2026-10-21', '11:58').toISOString();
const plan = (current: PersistedState, incoming: PersistedState) =>
  planImport(current, incoming, { transferId: ID, limits: PLUS_LIMITS, now: NOW, tz: DENVER });
const apply = (current: PersistedState, incoming: PersistedState, choices: Choices = {}) =>
  applyImport(current, incoming, choices, { transferId: ID, createdAt: CREATED, now: NOW, limits: PLUS_LIMITS });

function goalNamed(goalId: string, text: string, yes = 0): GoalState {
  const g = { ...newGoal(), goalId, goal: text };
  return yes > 0 ? yesDays(g, DAY0, yes) : g;
}

function stateOf(goals: GoalState[], patch: Partial<PersistedState> = {}): PersistedState {
  return { ...DEFAULT_PERSISTED, goals: goals.map((goal) => ({ goal, round: null, seenThrough: null })), ...patch };
}

const freeCredits = { balance: { game: 2, weapon: 1 }, claimed: ['goal-set', 'zeros-2', 'yes-run-3'] };

describe('a move into an empty Plus', () => {
  const incoming = stateOf([goalNamed('g1', 'Stop drinking', 3)], {
    credits: freeCredits,
    prefs: { ...DEFAULT_PERSISTED.prefs, sound: false, goalInReminders: true },
    weapon: 'twin',
    arsenalBest: 4,
  });

  it('previews the goal, the credits and the settings coming over', () => {
    expect(plan(DEFAULT_PERSISTED, incoming)).toEqual({
      kind: 'preview',
      goals: [
        {
          incoming: { goalId: 'g1', text: 'Stop drinking', streak: 3, bestStreak: 3, yesDays: 3, lastAnswered: '2026-10-15' },
          existing: null,
          archivedHere: false,
          canTakeIncoming: true,
          suggested: 'incoming',
        },
      ],
      credits: { game: 2, weapon: 1 },
      takesSettings: true,
    });
  });

  it('takes everything, and records the move so its credits arrive once', () => {
    const r = apply(DEFAULT_PERSISTED, incoming);
    if (!r.ok) throw new Error(r.reason);
    expect(r.replaced).toEqual([]);
    expect(r.state.goals).toEqual(incoming.goals);
    expect(r.state.prefs).toEqual(incoming.prefs);
    expect(r.state.weapon).toBe('twin');
    expect(r.state.arsenalBest).toBe(4);
    expect(r.state.credits).toEqual(freeCredits);
    expect(r.state.imports).toEqual({ [ID]: { at: NOW.toISOString(), createdAt: CREATED, game: 2, weapon: 1 } });

    // The same move again: no more credits, whatever else happens.
    const again = apply({ ...DEFAULT_PERSISTED, ...r.state }, incoming);
    expect(again.ok && again.state.credits).toEqual(freeCredits);
    expect(plan({ ...DEFAULT_PERSISTED, ...r.state }, incoming)).toEqual({ kind: 'already' });
  });
});

describe('a move into a Plus with goals of its own', () => {
  const plusCredits = { balance: { game: 1, weapon: 0 }, claimed: ['goal-set', 'comeback'] };
  const current = stateOf([goalNamed('p1', 'Walk every day', 2)], {
    credits: plusCredits,
    prefs: { ...DEFAULT_PERSISTED.prefs, haptics: false },
    weapon: 'pea',
  });
  const incoming = stateOf([goalNamed('g1', 'Stop drinking', 3)], { credits: freeCredits, weapon: 'twin' });

  it('adds the goal after Plus’s, and keeps Plus’s settings', () => {
    const p = plan(current, incoming);
    expect(p).toMatchObject({ kind: 'preview', takesSettings: false });
    const r = apply(current, incoming);
    if (!r.ok) throw new Error(r.reason);
    expect(r.state.goals.map((s) => s.goal.goalId)).toEqual(['p1', 'g1']);
    expect(r.state.prefs.haptics).toBe(false);
    expect(r.state.weapon).toBe('pea');
  });

  it('adds the credits, and merges the rewards already paid as one set', () => {
    const r = apply(current, incoming);
    if (!r.ok) throw new Error(r.reason);
    expect(r.state.credits.balance).toEqual({ game: 3, weapon: 1 });
    expect([...r.state.credits.claimed].sort()).toEqual(['comeback', 'goal-set', 'yes-run-3', 'zeros-2']);
  });

  it('refuses a goal when Plus’s are full', () => {
    const full = stateOf([goalNamed('p1', 'Walk', 1), goalNamed('p2', 'Read', 1), goalNamed('p3', 'Sleep', 1)]);
    expect(plan(full, incoming)).toEqual({ kind: 'full', maxGoals: 3 });
    expect(apply(full, incoming)).toEqual({ ok: false, reason: 'full' });
  });

  it('keeps archived goals from Win Zero alongside Plus’s', () => {
    const old = goalNamed('g0', 'Quit smoking', 5);
    const withArchive = { ...incoming, archived: [{ goal: old, archivedAt: CREATED }] };
    const r = apply(current, withArchive);
    expect(r.ok && r.state.archived.map((a) => a.goal.goalId)).toEqual(['g0']);
  });

  it('never lets the arsenal reach less than either app did', () => {
    const strong = stateOf([goalNamed('p1', 'Walk', 9)], { arsenalBest: 2 });
    const weak = stateOf([goalNamed('g1', 'Stop drinking', 3)], { arsenalBest: 7 });
    const r = apply(strong, weak);
    expect(r.ok && r.state.arsenalBest).toBe(9);
    const r2 = apply(stateOf([], { arsenalBest: 1 }), weak);
    expect(r2.ok && r2.state.arsenalBest).toBe(7);
  });
});

describe('a goal both apps have (a second move)', () => {
  // Moved on 10-15 after three Yeses; the copies went their own ways after that.
  const base = yesDays(newGoal(), DAY0, 3);
  /** Answered in Win Zero through 10-19. */
  const usedThere = yesDays(base, '2026-10-16', 4);
  /** Left alone in Plus: opened on 10-21, the same days settle as missed. */
  const leftHere = resolve(base, NOW, DENVER).state;

  it('suggests the copy answered later, though both have settled up to the same day', () => {
    expect(usedThere.lastSettledDay).toBe('2026-10-19');
    expect(leftHere.lastSettledDay).toBe('2026-10-19');
    expect(lastAnswered(usedThere)).toBe('2026-10-19');
    expect(lastAnswered(leftHere)).toBe('2026-10-15');
    expect(suggestedCopy(usedThere, leftHere)).toBe('incoming');
    expect(suggestedCopy(leftHere, usedThere)).toBe('existing');
    // Even: Plus's own copy.
    expect(suggestedCopy(base, base)).toBe('existing');
    // A Not today is an answer too.
    expect(lastAnswered(notTodays(base, '2026-10-16', 1))).toBe('2026-10-16');
  });

  it('shows both copies, and replaces Plus’s in place when the one from Win Zero is kept', () => {
    const current = stateOf([goalNamed('p1', 'Walk', 1), leftHere]);
    const incoming = stateOf([usedThere]);
    const p = plan(current, incoming);
    expect(p).toMatchObject({
      kind: 'preview',
      goals: [{ incoming: { goalId: 'g1', streak: 7 }, existing: { goalId: 'g1', streak: 3 }, archivedHere: false, suggested: 'incoming' }],
    });
    const r = apply(current, incoming);
    if (!r.ok) throw new Error(r.reason);
    expect(r.replaced).toEqual(['g1']);
    expect(r.state.goals.map((s) => [s.goal.goalId, s.goal.streak])).toEqual([['p1', 1], ['g1', 7]]);
  });

  it('keeps Plus’s copy when the user picks it', () => {
    const current = stateOf([leftHere]);
    const r = apply(current, stateOf([usedThere]), { g1: 'existing' });
    if (!r.ok) throw new Error(r.reason);
    expect(r.replaced).toEqual([]);
    expect(r.state.goals[0]?.goal).toBe(leftHere);
  });

  it('a goal Plus has full doesn’t count against its room', () => {
    const current = stateOf([goalNamed('p1', 'Walk', 1), goalNamed('p2', 'Read', 1), leftHere]);
    expect(plan(current, stateOf([usedThere]))).toMatchObject({ kind: 'preview' });
    expect(apply(current, stateOf([usedThere])).ok).toBe(true);
  });

  it('brings an archived goal back when there’s room, and only then', () => {
    const archived = [{ goal: leftHere, archivedAt: CREATED }];
    const roomy = stateOf([goalNamed('p1', 'Walk', 1)], { archived });
    expect(plan(roomy, stateOf([usedThere]))).toMatchObject({
      kind: 'preview',
      goals: [{ archivedHere: true, canTakeIncoming: true, suggested: 'incoming' }],
    });
    const r = apply(roomy, stateOf([usedThere]));
    if (!r.ok) throw new Error(r.reason);
    expect(r.state.goals.map((s) => s.goal.goalId)).toEqual(['p1', 'g1']);
    expect(r.state.archived).toEqual([]);

    const full = stateOf([goalNamed('p1', 'Walk', 1), goalNamed('p2', 'Read', 1), goalNamed('p3', 'Sleep', 1)], { archived });
    expect(plan(full, stateOf([usedThere]))).toMatchObject({
      kind: 'preview',
      goals: [{ archivedHere: true, canTakeIncoming: false, suggested: 'existing' }],
    });
    expect(apply(full, stateOf([usedThere])).ok).toBe(true); // the suggestion keeps the archive
    expect(apply(full, stateOf([usedThere]), { g1: 'incoming' })).toEqual({ ok: false, reason: 'full' });
  });

  it('keeps Plus’s copy of an archived goal Win Zero also archived', () => {
    const current = stateOf([], { archived: [{ goal: leftHere, archivedAt: CREATED }] });
    const incoming = stateOf([], { archived: [{ goal: usedThere, archivedAt: CREATED }] });
    const r = apply(current, incoming);
    expect(r.ok && r.state.archived.map((a) => a.goal)).toEqual([leftHere]);
  });
});

describe('through the store', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('saves the merge, settles the days since, and keeps the credits once', async () => {
    const h = harness({ limits: PLUS_LIMITS });
    await ready(h.store);
    h.clock.t = NOW.getTime();
    const incoming = stateOf([yesDays(newGoal(), DAY0, 3)], { credits: freeCredits });
    const take = () =>
      h.store.getState().importMove((current, now) =>
        applyImport(current, incoming, {}, { transferId: ID, createdAt: CREATED, now, limits: h.store.getState().limits }),
      );
    expect(take().ok).toBe(true);
    const s = h.store.getState();
    expect(s.goals[0]?.goal.lastSettledDay).toBe('2026-10-19'); // resolved on the way in
    expect(s.credits.balance).toEqual({ game: 2, weapon: 1 });
    expect(Object.keys(s.imports)).toEqual([ID]);
    take();
    expect(h.store.getState().credits.balance).toEqual({ game: 2, weapon: 1 });
  });
});
