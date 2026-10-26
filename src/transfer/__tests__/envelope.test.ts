// A move is read the way Plus reads its own storage, and anything it can't be sure of is
// refused whole: another kind of data, a newer app's, a damaged goal, or the wrong id.
import { describe, expect, it } from '@jest/globals';

import { answer, EMPTY_WALLET, type GoalState } from '@/engine';
import { at, DAY0, DENVER, newGoal, yesDays } from '@/engine/__tests__/fixtures';
import { openDayAt, seedYesRun } from '@/dev/seedRun';
import { DEFAULT_PERSISTED, GOAL_VERSION } from '@/store/migrate';
import { STORE_VERSION, type PersistedState } from '@/store/types';

import { decodeMove, encodeMove } from '../codec';
import { makeMove, moveStateOf, MOVE_FORMAT, MOVE_KIND, readMove } from '../envelope';

const ID = '0f8e2b1c-5d4a-4b3e-9a7f-1c2d3e4f5a6b';
const NOW = at('2026-10-20', '21:00');
const read = (text: string, id = ID) => readMove(text, { id, now: NOW, tz: DENVER });

function stateWith(goal: GoalState, patch: Partial<PersistedState> = {}): PersistedState {
  return { ...DEFAULT_PERSISTED, goals: [{ goal, round: null, seenThrough: null }], ...patch };
}

/** An envelope written by hand, to send what Win Zero never would. */
function envelope(patch: Record<string, unknown> = {}, state: unknown = stateWith(yesDays(newGoal(), DAY0, 3))) {
  return encodeMove(
    JSON.stringify({
      kind: MOVE_KIND,
      v: MOVE_FORMAT,
      id: ID,
      createdAt: NOW.toISOString(),
      from: { appVersion: '1.2.0', storeVersion: STORE_VERSION },
      state,
      ...patch,
    }),
  );
}

describe('makeMove and readMove', () => {
  it('carry the progress, and nothing of this phone’s', () => {
    const goal = yesDays(newGoal(), DAY0, 5);
    const state = stateWith(goal, {
      credits: { balance: { game: 2, weapon: 1 }, claimed: ['goal-set', 'zeros-2'] },
      prefs: { ...DEFAULT_PERSISTED.prefs, sound: false },
      weapon: 'twin',
      reminderCardHiddenUntil: NOW.toISOString(),
      devClockOffsetMs: 86_400_000,
    });
    const text = makeMove({ id: ID, now: NOW, appVersion: '1.2.0', state });

    const raw = JSON.parse(decodeMove(text));
    expect(raw).toMatchObject({ kind: 'winzero.move', v: 1, id: ID, from: { appVersion: '1.2.0', storeVersion: STORE_VERSION } });
    expect(Object.keys(raw.state).sort()).toEqual(['archived', 'arsenalBest', 'credits', 'goals', 'prefs', 'weapon']);

    const r = read(text);
    if (!r.ok) throw new Error(r.reason);
    expect(r.id).toBe(ID);
    expect(r.createdAt).toBe(NOW.toISOString());
    expect(r.incoming.goals).toEqual(state.goals);
    expect(r.incoming.credits).toEqual(state.credits);
    expect(r.incoming.prefs.sound).toBe(false);
    expect(r.incoming.weapon).toBe('twin');
    expect(r.incoming.reminderCardHiddenUntil).toBeNull();
    expect(r.incoming.devClockOffsetMs).toBe(0);
  });

  it('turns a bonus round still to play into the credits that paid for it', () => {
    const goal = newGoal();
    const credits = { balance: { game: 1, weapon: 0 }, claimed: [] };
    const waiting = stateWith(goal, { credits, bonus: { n: 50, borrowed: ['chain'], played: false } });
    expect(moveStateOf(waiting).credits.balance).toEqual({ game: 2, weapon: 1 });
    const played = stateWith(goal, { credits, bonus: { n: 50, borrowed: [], played: true } });
    expect(moveStateOf(played).credits.balance).toEqual({ game: 1, weapon: 0 });
    expect('bonus' in moveStateOf(waiting)).toBe(false);
  });

  it('keeps 1,000 days of history under 30 KB', () => {
    const now = at('2029-07-08', '21:00');
    let goal = seedYesRun({ ...newGoal(), goalId: ID }, 1000, now, DENVER);
    const r = answer(goal, { answer: 'yes', day: openDayAt(goal, now, DENVER) }, now, DENVER);
    if (!r.ok) throw new Error(r.reason);
    goal = r.state;
    expect(goal.history).toHaveLength(1000);
    const text = makeMove({ id: ID, now, appVersion: '1.2.0', state: stateWith(goal) });
    expect(text.length).toBeLessThan(30_000);
    const back = readMove(text, { id: ID, now, tz: DENVER });
    expect(back.ok && back.incoming.goals[0]?.goal).toEqual(goal);
  });
});

describe('readMove refuses', () => {
  it('anything that is not a move', () => {
    expect(read('hello')).toEqual({ ok: false, reason: 'not-a-move' });
    expect(read(envelope({ kind: 'something.else' }))).toEqual({ ok: false, reason: 'not-a-move' });
    expect(read(encodeMove('[1,2,3]'))).toEqual({ ok: false, reason: 'not-a-move' });
    expect(read(encodeMove('{not json'))).toEqual({ ok: false, reason: 'unreadable' });
  });

  it('a move from a newer app, by its format, store version or goal shape', () => {
    expect(read(envelope({ v: MOVE_FORMAT + 1 }))).toEqual({ ok: false, reason: 'update-needed' });
    const newer = { appVersion: '9.0.0', storeVersion: STORE_VERSION + 1 };
    expect(read(envelope({ from: newer }))).toEqual({ ok: false, reason: 'update-needed' });
    const future = { ...newGoal(), version: GOAL_VERSION + 1 };
    expect(read(envelope({}, stateWith(future as unknown as GoalState)))).toEqual({ ok: false, reason: 'update-needed' });
  });

  it('a move under another id than the link’s', () => {
    expect(read(envelope(), 'aaaaaaaa-0000-4000-8000-000000000000')).toEqual({ ok: false, reason: 'unreadable' });
    expect(read(envelope({ id: '../../x' }), '../../x')).toEqual({ ok: false, reason: 'unreadable' });
  });

  it('a move with a field it needs missing or wrong', () => {
    expect(read(envelope({ v: 'one' }))).toEqual({ ok: false, reason: 'unreadable' });
    expect(read(envelope({ from: { storeVersion: 2.5 } }))).toEqual({ ok: false, reason: 'unreadable' });
    expect(read(envelope({ createdAt: 'yesterday' }))).toEqual({ ok: false, reason: 'unreadable' });
    expect(read(envelope({ state: [] }))).toEqual({ ok: false, reason: 'unreadable' });
  });

  it('a move with any goal it can’t read, rather than dropping it', () => {
    const goal = newGoal();
    const broken = { ...goal, firstDay: undefined };
    const state = { ...stateWith(goal), archived: [{ goal: broken, archivedAt: NOW.toISOString() }] };
    expect(read(envelope({}, state))).toEqual({ ok: false, reason: 'unreadable' });
  });

  it('a move whose goal can’t be resolved', () => {
    const goal = newGoal();
    const lost = { ...goal, checkInSchedule: [{ ...goal.checkInSchedule[0]!, tz: 'Mars/Olympus_Mons' }] };
    expect(read(envelope({}, stateWith(lost)))).toEqual({ ok: false, reason: 'unreadable' });
  });

  it('a move too big to be one', () => {
    expect(read('wz1.' + 'A'.repeat(200_000))).toEqual({ ok: false, reason: 'too-large' });
  });
});

describe('readMove upgrades', () => {
  it('a move saved by an older store, as the store would on launch', () => {
    const goal = yesDays(newGoal(), DAY0, 2);
    const v2 = { goal, round: null, seenThrough: DAY0, credits: EMPTY_WALLET, bonus: null };
    const r = read(envelope({ from: { appVersion: '1.1.0', storeVersion: 2 } }, v2));
    if (!r.ok) throw new Error(r.reason);
    expect(r.incoming.goals).toEqual([{ goal, round: null, seenThrough: DAY0 }]);
    expect(r.from).toEqual({ appVersion: '1.1.0', storeVersion: 2 });
  });
});
