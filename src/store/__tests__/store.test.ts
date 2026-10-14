// The persisted store: lifecycle, notices, weapons, rounds, persistence and migration.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it } from '@jest/globals';
import type { AppStateStatus } from 'react-native';

import { currentCheckInTime, latestScheduleEntry, MS_PER_DAY, type ClockTime, type DayKey, type GoalState } from '@/engine';
import { at, DAY0, DENVER, newGoal, TOKYO, yesDays } from '@/engine/__tests__/fixtures';

import { createAppStore, type AppStore } from '../createAppStore';
import { startLifecycle } from '../lifecycle';
import { DEFAULT_PERSISTED } from '../migrate';
import { STORE_KEY, STORE_VERSION } from '../types';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function harness(opts: { dev?: boolean } = {}) {
  const clock = { t: at(DAY0, '12:00').getTime() };
  const zone = { tz: DENVER };
  let ids = 0;
  const store = createAppStore({
    storage: AsyncStorage,
    now: () => new Date(clock.t),
    timeZone: () => zone.tz,
    makeId: () => `goal-${++ids}`,
    dev: opts.dev ?? true,
  });
  const setTime = (day: DayKey, time: ClockTime) => {
    clock.t = at(day, time).getTime();
  };
  return { store, clock, zone, setTime };
}

async function ready(store: AppStore) {
  for (let i = 0; i < 50 && !store.getState().hydrated; i++) await flush();
  expect(store.getState().hydrated).toBe(true);
}

/** A fake AppState that records its listener, so a test can bring the app to the foreground. */
function fakeAppState() {
  const listeners: ((s: AppStateStatus) => void)[] = [];
  return {
    addEventListener: (_type: 'change', fn: (s: AppStateStatus) => void) => {
      listeners.push(fn);
      return { remove: () => listeners.splice(listeners.indexOf(fn), 1) };
    },
    emit: (s: AppStateStatus) => listeners.forEach((fn) => fn(s)),
    count: () => listeners.length,
  };
}

async function withGoal(goal: GoalState, opts: { dev?: boolean } = {}) {
  const h = harness(opts);
  await ready(h.store);
  h.store.setState({ ...DEFAULT_PERSISTED, goal }); // not whatever an earlier store left in storage
  return h;
}

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('lifecycle', () => {
  it('resolves when the app returns to the foreground, following a time zone change', async () => {
    const h = await withGoal(yesDays(newGoal(), DAY0, 10)); // answered through 10-22
    const app = fakeAppState();
    const stop = startLifecycle(h.store, app);

    h.setTime('2026-11-01', '20:30'); // 10-23 .. 10-31 have closed
    app.emit('background');
    expect(h.store.getState().goal?.history).toHaveLength(10);

    app.emit('active');
    const goal = h.store.getState().goal;
    expect(goal?.history).toHaveLength(19);
    expect(goal).toMatchObject({ streak: 8, consecutiveMissed: 9 }); // 7 free, then 2 slips

    h.zone.tz = TOKYO;
    app.emit('active');
    expect(latestScheduleEntry(h.store.getState().goal!).tz).toBe(TOKYO);

    stop();
    expect(app.count()).toBe(0);
  });

  it('resolves once storage has been read at launch', async () => {
    const first = harness();
    await ready(first.store);
    first.store.setState({ goal: yesDays(newGoal(), DAY0, 3) }); // through 10-15
    await flush();

    const h = harness();
    h.setTime('2026-10-20', '21:00'); // 10-16 .. 10-19 closed
    const stop = startLifecycle(h.store, fakeAppState());
    expect(h.store.getState().hydrated).toBe(false);
    await ready(h.store);
    expect(h.store.getState().goal?.consecutiveMissed).toBe(4);
    stop();
  });

  it('ignores actions until storage has been read', () => {
    const { store } = harness();
    expect(store.getState().refresh()).toEqual([]);
    expect(store.getState().answer('yes')).toBeNull();
    expect(store.getState().setupGoal({ goal: 'x', checkInTime: '20:00', morningTime: '09:00' })).toEqual({
      ok: false,
      reason: 'not-ready',
    });
  });
});

describe('setup and settings', () => {
  it('creates a goal and keeps the morning reminder before check-in', async () => {
    const { store } = harness();
    await ready(store);
    expect(store.getState().setupGoal({ goal: ' ', checkInTime: '20:00', morningTime: '09:00' })).toMatchObject({
      reason: 'empty-goal',
    });
    expect(store.getState().setupGoal({ goal: 'Read', checkInTime: '08:00', morningTime: '09:00' })).toMatchObject({
      reason: 'order',
    });
    expect(store.getState().setupGoal({ goal: ' Stop drinking ', checkInTime: '20:00', morningTime: '09:00' })).toEqual({
      ok: true,
    });
    expect(store.getState().goal).toMatchObject({ goalId: 'goal-1', goal: 'Stop drinking', firstDay: DAY0 });

    expect(store.getState().setCheckInTime('08:30')).toEqual({ ok: false, reason: 'order' });
    expect(store.getState().setMorningTime('21:00')).toEqual({ ok: false, reason: 'order' });
    expect(store.getState().setCheckInTime('21:00')).toEqual({ ok: true });
    expect(currentCheckInTime(store.getState().goal!)).toBe('21:00');
    expect(store.getState().setMorningTime('07:30')).toEqual({ ok: true });
    expect(store.getState().goal?.morningTime).toBe('07:30');
    expect(store.getState().setGoalText('  ')).toEqual({ ok: false, reason: 'empty-goal' });
    expect(store.getState().setGoalText('Stay sober')).toEqual({ ok: true });
    expect(store.getState().goal?.goal).toBe('Stay sober');
  });
});

describe('notices', () => {
  it('shows a missed-day notice once, and nothing for the free week', async () => {
    const h = await withGoal(yesDays(newGoal(), DAY0, 10)); // through 10-22
    h.setTime('2026-10-30', '20:30');
    h.store.getState().refresh(); // seven free misses
    expect(h.store.getState().takeMissNotice()).toBeNull();
    expect(h.store.getState().seenThrough).toBe('2026-10-29');

    h.setTime('2026-11-01', '20:30');
    h.store.getState().refresh(); // two slips
    const notice = { kind: 'slipping', cause: 'missed', lost: 2, streak: 8, days: 2 };
    expect(h.store.getState().takeMissNotice()).toEqual(notice);
    expect(h.store.getState().notice).toEqual(notice);
    expect(h.store.getState().takeMissNotice()).toBeNull();
  });

  it('shows Reset or Shielded for a missed-day final', async () => {
    const reset = await withGoal({ ...yesDays(newGoal(), DAY0, 20), shields: 0 });
    reset.setTime('2026-11-16', '20:00');
    reset.store.getState().refresh();
    expect(reset.store.getState().takeMissNotice()).toEqual({
      kind: 'reset',
      cause: 'missed',
      lostStreak: 20,
      bestStreak: 20,
      days: 14,
    });

    const shielded = await withGoal(yesDays(newGoal(), DAY0, 20)); // 2 shields
    shielded.setTime('2026-11-16', '20:00');
    shielded.store.getState().refresh();
    expect(shielded.store.getState().takeMissNotice()).toEqual({
      kind: 'shielded',
      cause: 'missed',
      lost: 6,
      streak: 14,
      shieldsLeft: 1,
      days: 14,
    });
  });

  it('a Not today sets the matching notice', async () => {
    const h = await withGoal({ ...yesDays(newGoal(), DAY0, 10), shields: 0 }); // through 10-22
    h.setTime('2026-10-23', '21:00');
    expect(h.store.getState().answer('not-today')).toMatchObject({ ok: true, outcome: { kind: 'slipped' } });
    expect(h.store.getState().notice).toEqual({ kind: 'slipping', cause: 'answer', lost: 1, streak: 9, days: 1 });

    h.store.getState().clearNotice();
    expect(h.store.getState().notice).toBeNull();

    h.store.setState({ goal: { ...h.store.getState().goal!, slide: 6 } });
    h.setTime('2026-10-24', '21:00');
    h.store.getState().answer('not-today');
    expect(h.store.getState().notice).toEqual({
      kind: 'reset',
      cause: 'answer',
      lostStreak: 9,
      bestStreak: 10,
      days: 1,
    });

    h.setTime('2026-10-25', '21:00');
    h.store.getState().answer('not-today'); // already at 0
    expect(h.store.getState().notice).toEqual({ kind: 'noted' });

    const s = await withGoal({ ...yesDays(newGoal(), DAY0, 10), slide: 6, shields: 1 });
    s.setTime('2026-10-23', '21:00');
    s.store.getState().answer('not-today');
    expect(s.store.getState().notice).toEqual({
      kind: 'shielded',
      cause: 'answer',
      lost: 0,
      streak: 10,
      shieldsLeft: 0,
      days: 1,
    });
  });
});

describe('weapons and rounds', () => {
  it("equips a newly unlocked weapon, and otherwise keeps the player's pick", async () => {
    const h = await withGoal(yesDays(newGoal(), DAY0, 2)); // best 2, through 10-14
    h.store.getState().selectWeapon('twin'); // not unlocked yet
    expect(h.store.getState().weapon).toBeNull();
    h.store.getState().selectWeapon('pea');
    expect(h.store.getState().weapon).toBe('pea');

    h.setTime('2026-10-15', '21:00');
    h.store.getState().answer('yes'); // streak 3 unlocks the Twin Barrel
    expect(h.store.getState().weapon).toBe('twin');

    h.store.getState().selectWeapon('pea');
    h.setTime('2026-10-16', '21:00');
    h.store.getState().answer('yes'); // streak 4, nothing new
    expect(h.store.getState().weapon).toBe('pea');
  });

  it('records the round at Yes, and drops it once the next day settles', async () => {
    const h = await withGoal(yesDays(newGoal(), DAY0, 4)); // through 10-16
    h.setTime('2026-10-17', '21:00');
    h.store.getState().answer('yes'); // streak 5: a bomb
    expect(h.store.getState().round).toEqual({
      day: '2026-10-17',
      n: 5,
      rewards: { bomb: true, shield: false, shieldCapped: false, weapons: [] },
      played: false,
    });
    expect(h.store.getState().goal?.bombs).toBe(1);

    h.store.getState().finishRound();
    expect(h.store.getState().round?.played).toBe(true);

    h.setTime('2026-10-18', '21:00');
    h.store.getState().refresh(); // 10-18 is open, not settled
    expect(h.store.getState().round?.day).toBe('2026-10-17');
    h.store.getState().answer('not-today');
    expect(h.store.getState().round).toBeNull();
  });

  it('spends bombs through the engine', async () => {
    const h = await withGoal({ ...newGoal(), bombs: 1 });
    expect(h.store.getState().spendBomb()).toBe(true);
    expect(h.store.getState().goal?.bombs).toBe(0);
    expect(h.store.getState().spendBomb()).toBe(false);
  });
});

describe('persistence', () => {
  it('round-trips through storage into a second store', async () => {
    const a = harness();
    await ready(a.store);
    a.store.getState().setupGoal({ goal: 'Exercise more', checkInTime: '19:00', morningTime: '08:00' });
    a.setTime(DAY0, '21:00');
    a.store.getState().answer('yes');
    a.store.getState().setPref('sound', false);
    a.store.getState().setPref('reengage', false);
    a.store.getState().selectWeapon('pea');
    a.store.setState({ notice: { kind: 'noted' } });
    await flush();

    const b = harness();
    await ready(b.store);
    const pick = (s: ReturnType<AppStore['getState']>) => ({
      goal: s.goal,
      weapon: s.weapon,
      prefs: s.prefs,
      seenThrough: s.seenThrough,
      round: s.round,
      devClockOffsetMs: s.devClockOffsetMs,
    });
    expect(pick(b.store.getState())).toEqual(pick(a.store.getState()));
    expect(b.store.getState().prefs).toEqual({ sound: false, haptics: true, reengage: false });
    expect(b.store.getState().round).toMatchObject({ n: 1, played: false });
    expect(b.store.getState().notice).toBeNull(); // not persisted

    const raw = JSON.parse((await AsyncStorage.getItem(STORE_KEY)) ?? '{}');
    expect(raw.version).toBe(STORE_VERSION);
    expect(Object.keys(raw.state).sort()).toEqual(
      ['devClockOffsetMs', 'goal', 'prefs', 'round', 'seenThrough', 'weapon'].sort(),
    );
  });

  it('migrates an unversioned blob, keeping the goal and filling in defaults', async () => {
    const { slide: _slide, paused: _paused, ...legacyGoal } = yesDays(newGoal(), DAY0, 3);
    await AsyncStorage.setItem(
      STORE_KEY,
      JSON.stringify({
        version: 0,
        state: { goal: legacyGoal, prefs: { sound: false }, weapon: 'laser-cannon', round: { day: 'soon' } },
      }),
    );
    const { store } = harness();
    await ready(store);
    expect(store.getState().goal).toMatchObject({ goalId: 'g1', streak: 3, slide: 0, paused: false });
    expect(store.getState().goal?.history).toHaveLength(3);
    expect(store.getState().prefs).toEqual({ sound: false, haptics: true, reengage: true });
    expect(store.getState().weapon).toBeNull();
    expect(store.getState().round).toBeNull();

    await flush();
    const raw = JSON.parse((await AsyncStorage.getItem(STORE_KEY)) ?? '{}');
    expect(raw.version).toBe(STORE_VERSION); // written back in the current shape
    expect(raw.state.goal.slide).toBe(0);
  });

  it('starts fresh from a corrupt blob instead of hanging', async () => {
    await AsyncStorage.setItem(STORE_KEY, '{not json');
    const { store } = harness();
    await ready(store);
    expect(store.getState().goal).toBeNull();
  });

  it('erase clears the state and storage', async () => {
    const h = await withGoal(yesDays(newGoal(), DAY0, 3));
    h.store.getState().setPref('haptics', false);
    h.store.getState().erase();
    expect(h.store.getState().goal).toBeNull();
    expect(h.store.getState().prefs.haptics).toBe(true);
    await flush();
    expect(await AsyncStorage.getItem(STORE_KEY)).toBeNull();
  });
});

describe('debug clock', () => {
  it('moves the app clock in development and resolves', async () => {
    const h = await withGoal(yesDays(newGoal(), DAY0, 1)); // answered 10-13; clock at 10-13 12:00
    h.store.getState().advanceDevClock(9 * MS_PER_DAY); // 10-22 12:00: 10-14 .. 10-20 closed
    expect(h.store.getState().now().getTime()).toBe(h.clock.t + 9 * MS_PER_DAY);
    expect(h.store.getState().goal?.consecutiveMissed).toBe(7);
    h.store.getState().resetDevClock();
    expect(h.store.getState().now().getTime()).toBe(h.clock.t);
  });

  it('is ignored outside development', async () => {
    const h = await withGoal(yesDays(newGoal(), DAY0, 1), { dev: false });
    h.store.getState().advanceDevClock(MS_PER_DAY);
    expect(h.store.getState().devClockOffsetMs).toBe(0);
    h.store.setState({ devClockOffsetMs: MS_PER_DAY }); // e.g. left over in storage
    expect(h.store.getState().now().getTime()).toBe(h.clock.t);
  });
});
