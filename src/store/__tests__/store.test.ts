// The persisted store: lifecycle, notices, weapons, rounds, persistence and migration.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it } from '@jest/globals';

import {
  addDays,
  BONUS_MAX_N,
  currentCheckInTime,
  EMPTY_WALLET,
  GOAL_ALIAS_MAX_LENGTH,
  latestScheduleEntry,
  MODE_IDS,
  MS_PER_DAY,
  pendingWindow,
  PLAYABLE_MODES,
  THEME_IDS,
  THEME_UNLOCK_AURORA,
  THEME_UNLOCK_EMBER,
  THEME_UNLOCK_GOLD,
  type CreditWallet,
  type ModeId,
} from '@/engine';
import { answerDay, at, DAY0, DENVER, newGoal, TOKYO, yesDays } from '@/engine/__tests__/fixtures';

import {
  createAppStore,
  REMINDER_CARD_HIDE_MS,
  UNDO_MS,
  UNDO_MS_SCREEN_READER,
  type AppState,
  type AppStore,
} from '../createAppStore';
import { startLifecycle } from '../lifecycle';
import { DEFAULT_PERSISTED } from '../migrate';
import { STORE_BACKUP_KEY, STORE_KEY, STORE_VERSION } from '../types';
import { fakeAppState, flush, gid, harness, noticeOf, oneGoal, putGoal, ready, withGoal } from './harness';
import { PLUS_LIMITS } from '../limits';
import {
  arsenalBestOf,
  canAddGoal,
  gameModeOf,
  isMovedOut,
  primaryGoal,
  primaryRound,
  primarySlot,
  slotById,
  themeOf,
  totalBombs,
} from '../select';

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('lifecycle', () => {
  it('resolves when the app returns to the foreground, following a time zone change', async () => {
    const h = await withGoal(yesDays(newGoal(), DAY0, 10)); // answered through 10-22
    const app = fakeAppState();
    const stop = startLifecycle(h.store, app);

    h.setTime('2026-11-02', '00:30'); // 10-23 .. 10-31 have closed
    app.emit('background');
    expect(primaryGoal(h.store.getState())?.history).toHaveLength(10);

    app.emit('active');
    const goal = primaryGoal(h.store.getState());
    expect(goal?.history).toHaveLength(19);
    expect(goal).toMatchObject({ streak: 8, consecutiveMissed: 9 }); // 7 free, then 2 slips

    h.zone.tz = TOKYO;
    app.emit('active');
    expect(latestScheduleEntry(primaryGoal(h.store.getState())!).tz).toBe(TOKYO);

    stop();
    expect(app.count()).toBe(0);
  });

  it('resolves once storage has been read at launch', async () => {
    const first = harness();
    await ready(first.store);
    first.store.setState(oneGoal(yesDays(newGoal(), DAY0, 3))); // through 10-15
    await flush();

    const h = harness();
    h.setTime('2026-10-21', '00:30'); // 10-16 .. 10-19 closed
    const stop = startLifecycle(h.store, fakeAppState());
    expect(h.store.getState().hydrated).toBe(false);
    await ready(h.store);
    expect(primaryGoal(h.store.getState())?.consecutiveMissed).toBe(4);
    stop();
  });

  it('ignores actions until storage has been read', () => {
    const { store } = harness();
    expect(store.getState().refresh()).toEqual([]);
    expect(store.getState().answer('g1', 'yes')).toBeNull();
    expect(store.getState().addGoal({ goal: 'x', checkInTime: '20:00', morningTime: '09:00' })).toEqual({
      ok: false,
      reason: 'not-ready',
    });
  });
});

describe('setup and settings', () => {
  it('creates a goal, and takes a reminder at any time of day', async () => {
    const { store } = harness();
    await ready(store);
    expect(store.getState().addGoal({ goal: ' ', checkInTime: '20:00', morningTime: '09:00' })).toMatchObject({
      reason: 'empty-goal',
    });
    // A shift worker: check in after the night shift, reminder after sleeping.
    expect(store.getState().addGoal({ goal: 'Read', checkInTime: '06:00', morningTime: '14:00' })).toEqual({
      ok: true,
      goalId: 'goal-1',
    });
    expect(primaryGoal(store.getState())).toMatchObject({ checkInSchedule: [{ time: '06:00' }], morningTime: '14:00' });
    // The free app keeps one goal.
    expect(store.getState().addGoal({ goal: 'Run', checkInTime: '20:00', morningTime: '09:00' })).toEqual({
      ok: false,
      reason: 'full',
    });
    store.getState().erase();
    expect(store.getState().addGoal({ goal: ' Stop drinking ', checkInTime: '20:00', morningTime: '09:00' })).toEqual({
      ok: true,
      goalId: 'goal-2',
    });
    expect(primaryGoal(store.getState())).toMatchObject({ goalId: 'goal-2', goal: 'Stop drinking', firstDay: DAY0 });

    expect(store.getState().setCheckInTime(gid(store), '08:30')).toEqual({ ok: true }); // now before the reminder
    expect(store.getState().setMorningTime(gid(store), '21:00')).toEqual({ ok: true }); // later than check-in
    expect(store.getState().setMorningTime(gid(store), '20:00')).toEqual({ ok: true }); // the same as check-in time
    expect(store.getState().setCheckInTime(gid(store), '21:00')).toEqual({ ok: true });
    expect(currentCheckInTime(primaryGoal(store.getState())!)).toBe('21:00');
    expect(store.getState().setMorningTime(gid(store), '07:30')).toEqual({ ok: true });
    expect(primaryGoal(store.getState())?.morningTime).toBe('07:30');
    expect(store.getState().setGoalText(gid(store), '  ')).toEqual({ ok: false, reason: 'empty-goal' });
    expect(store.getState().setGoalText(gid(store), 'Stay sober')).toEqual({ ok: true });
    expect(primaryGoal(store.getState())?.goal).toBe('Stay sober');
  });
});

describe('notices', () => {
  it('shows a missed-day notice once, and nothing for the free week', async () => {
    const h = await withGoal(yesDays(newGoal(), DAY0, 10)); // through 10-22
    h.setTime('2026-10-31', '00:30');
    h.store.getState().refresh(); // seven free misses
    expect(h.store.getState().nextNotice()).toBeNull();
    h.store.getState().markQuietMisses();
    expect(primarySlot(h.store.getState())?.seenThrough).toBe('2026-10-29');

    h.setTime('2026-11-02', '00:30');
    h.store.getState().refresh(); // two slips
    const pending = h.store.getState().nextNotice();
    expect(pending).toEqual({
      source: 'missed',
      goalId: 'g1',
      notice: { kind: 'slipping', cause: 'missed', lost: 2, streak: 8, days: 2, stopped: false },
      through: '2026-10-31',
    });
    h.store.getState().noticeShown(pending!);
    expect(primarySlot(h.store.getState())?.seenThrough).toBe('2026-10-31');
    expect(h.store.getState().nextNotice()).toBeNull();
  });

  it('only marks missed days seen once their news is shown', async () => {
    const h = await withGoal(yesDays(newGoal(), DAY0, 10)); // through 10-22
    h.setTime('2026-11-02', '00:30');
    h.store.getState().refresh(); // 7 free misses, then 2 slips
    const first = h.store.getState().nextNotice();
    expect(h.store.getState().nextNotice()).toEqual(first); // reading it changes nothing
    expect(primarySlot(h.store.getState())?.seenThrough).toBeNull();
    h.store.getState().markQuietMisses(); // there is news, so nothing is quiet
    expect(primarySlot(h.store.getState())?.seenThrough).toBeNull();

    // A Yes now leaves the news in place, for after the round.
    expect(h.store.getState().answer(gid(h.store), 'yes')).toMatchObject({ ok: true });
    expect(h.store.getState().nextNotice()).toMatchObject({ source: 'missed', notice: { kind: 'slipping', lost: 2 } });
  });

  it('never moves the seen mark back', async () => {
    const h = await withGoal(yesDays(newGoal(), DAY0, 10)); // through 10-22
    h.setTime('2026-11-02', '00:30');
    h.store.getState().refresh();
    const early = h.store.getState().nextNotice()!; // through 10-31
    h.setTime('2026-11-03', '00:30');
    h.store.getState().refresh(); // one more slip
    const late = h.store.getState().nextNotice()!;
    expect(late).toMatchObject({ through: '2026-11-01', notice: { lost: 3 } });
    h.store.getState().noticeShown(late);
    h.store.getState().noticeShown(early); // e.g. an older Notice screen closing late
    expect(primarySlot(h.store.getState())?.seenThrough).toBe('2026-11-01');
  });

  it("puts an answer's notice ahead of missed-day news, and clears only the one shown", async () => {
    const h = await withGoal({ ...yesDays(newGoal(), DAY0, 10), shields: 0 }); // through 10-22
    h.setTime('2026-11-02', '00:30');
    h.store.getState().refresh(); // 2 slips, not yet shown
    const missed = h.store.getState().nextNotice()!;
    h.store.getState().answer(gid(h.store), 'not-today'); // one more
    const answered = h.store.getState().nextNotice()!;
    expect(answered).toEqual({
      source: 'answer',
      goalId: 'g1',
      notice: { kind: 'slipping', cause: 'answer', lost: 1, streak: 7, days: 1, stopped: false },
    });

    h.store.getState().noticeShown(missed);
    expect(h.store.getState().nextNotice()?.notice).toBe(answered.notice); // still waiting its turn
    h.store.setState({ notices: { g1: { kind: 'noted' } } }); // a newer answer's notice
    h.store.getState().noticeShown(answered);
    expect(noticeOf(h.store)).toEqual({ kind: 'noted' });
  });

  it('shows Reset or Shielded for a missed-day final', async () => {
    const reset = await withGoal({ ...yesDays(newGoal(), DAY0, 20), shields: 0 });
    reset.setTime('2026-11-17', '00:00');
    reset.store.getState().refresh();
    expect(reset.store.getState().nextNotice()?.notice).toEqual({
      kind: 'reset',
      cause: 'missed',
      lostStreak: 20,
      bestStreak: 20,
      days: 14,
      stopped: false,
    });

    const shielded = await withGoal(yesDays(newGoal(), DAY0, 20)); // 2 shields
    shielded.setTime('2026-11-17', '00:00');
    shielded.store.getState().refresh();
    expect(shielded.store.getState().nextNotice()?.notice).toEqual({
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
    expect(h.store.getState().answer(gid(h.store), 'not-today')).toMatchObject({ ok: true, outcome: { kind: 'slipped' } });
    expect(noticeOf(h.store)).toEqual({ kind: 'slipping', cause: 'answer', lost: 1, streak: 9, days: 1, stopped: false });

    h.store.getState().noticeShown(h.store.getState().nextNotice()!);
    expect(noticeOf(h.store)).toBeNull();

    putGoal(h.store, { ...primaryGoal(h.store.getState())!, slide: 6 });
    h.setTime('2026-10-24', '21:00');
    h.store.getState().answer(gid(h.store), 'not-today');
    expect(noticeOf(h.store)).toEqual({
      kind: 'reset',
      cause: 'answer',
      lostStreak: 9,
      bestStreak: 10,
      days: 1,
      stopped: false,
    });

    h.setTime('2026-10-25', '21:00');
    h.store.getState().answer(gid(h.store), 'not-today'); // already at 0
    expect(noticeOf(h.store)).toEqual({ kind: 'noted' });

    const s = await withGoal({ ...yesDays(newGoal(), DAY0, 10), slide: 6, shields: 1 });
    s.setTime('2026-10-23', '21:00');
    s.store.getState().answer(gid(s.store), 'not-today');
    expect(noticeOf(s.store)).toEqual({
      kind: 'shielded',
      cause: 'answer',
      lost: 0,
      streak: 10,
      shieldsLeft: 0,
      days: 1,
    });
  });
});

describe('answering a given day', () => {
  it('answers the open window when its day is named', async () => {
    const h = await withGoal(yesDays(newGoal(), DAY0, 2)); // through 10-14
    h.setTime('2026-10-15', '20:05');
    expect(h.store.getState().answer(gid(h.store), 'yes', '2026-10-15')).toMatchObject({
      ok: true,
      outcome: { kind: 'yes', day: '2026-10-15', streak: 3 },
    });
    expect(primaryRound(h.store.getState())).toMatchObject({ day: '2026-10-15', n: 3, played: false });
  });

  it("answers yesterday's window from the morning reminder", async () => {
    const h = await withGoal(yesDays(newGoal(), DAY0, 2)); // through 10-14
    h.setTime('2026-10-16', '09:00'); // 10-15 stays open until midnight tonight
    expect(h.store.getState().answer(gid(h.store), 'not-today', '2026-10-15')).toMatchObject({
      ok: true,
      outcome: { kind: 'slipped', day: '2026-10-15' },
    });
    expect(primaryGoal(h.store.getState())?.lastSettledDay).toBe('2026-10-15');
    expect(noticeOf(h.store)).toMatchObject({ kind: 'slipping', cause: 'answer' });
  });

  it("turns down a day that closed, was answered, or hasn't opened", async () => {
    const h = await withGoal(yesDays(newGoal(), DAY0, 2)); // through 10-14
    h.setTime('2026-10-17', '00:30'); // 10-15 closed unanswered at midnight
    expect(h.store.getState().answer(gid(h.store), 'yes', '2026-10-15')).toMatchObject({ ok: false, reason: 'expired' });
    expect(primaryGoal(h.store.getState())?.lastSettledDay).toBe('2026-10-15'); // caught up all the same
    expect(h.store.getState().answer(gid(h.store), 'yes', '2026-10-14')).toMatchObject({ ok: false, reason: 'already-answered' });
    expect(h.store.getState().answer(gid(h.store), 'not-today', '2026-10-17')).toMatchObject({ ok: false, reason: 'not-open' });
    expect(primaryRound(h.store.getState())).toBeNull();

    expect(h.store.getState().answer(gid(h.store), 'yes', '2026-10-16')).toMatchObject({ ok: true });
    expect(h.store.getState().answer(gid(h.store), 'yes', '2026-10-16')).toMatchObject({ ok: false, reason: 'already-answered' });
    expect(primaryRound(h.store.getState())).toMatchObject({ day: '2026-10-16', n: 3 });
  });
});

describe('where an answer leads', () => {
  it('leaves Home the round or the notice to open, in the same update as the answer', async () => {
    const h = await withGoal(yesDays(newGoal(), DAY0, 2)); // through 10-14
    const seen: { settled: string | null | undefined; route: string | null }[] = [];
    const settled = (s: AppState) => primaryGoal(s)?.lastSettledDay;
    const stop = h.store.subscribe((s, prev) => {
      if (settled(s) !== settled(prev)) seen.push({ settled: settled(s), route: s.route?.path ?? null });
    });

    h.setTime('2026-10-15', '21:00');
    h.store.getState().answer(gid(h.store), 'yes');
    expect(seen).toEqual([{ settled: '2026-10-15', route: '/play' }]);
    expect(h.store.getState().takeRoute()).toEqual({ path: '/play', goalId: 'g1' });
    expect(h.store.getState().takeRoute()).toBeNull();

    h.setTime('2026-10-16', '21:00');
    h.store.getState().answer(gid(h.store), 'not-today');
    expect(seen.at(-1)).toEqual({ settled: '2026-10-16', route: '/notice' });
    expect(h.store.getState().takeRoute()).toEqual({ path: '/notice', goalId: 'g1' });
    stop();
  });

  it("leaves a notification's Yes on Home: the round waits, nothing opens", async () => {
    const h = await withGoal(yesDays(newGoal(), DAY0, 2)); // through 10-14
    h.setTime('2026-10-15', '21:00');
    expect(h.store.getState().answer(gid(h.store), 'yes', '2026-10-15', 'notification')).toMatchObject({ ok: true });
    expect(h.store.getState().route).toBeNull();
    expect(primaryRound(h.store.getState())).toMatchObject({ day: '2026-10-15', n: 3, played: false });

    h.setTime('2026-10-16', '21:00');
    h.store.getState().answer(gid(h.store), 'not-today', '2026-10-16', 'notification');
    expect(h.store.getState().route?.path).toBe('/notice'); // Not today still shows its notice
  });

  it("records why an answer was turned down for Home's banner, and keeps a route still waiting", async () => {
    const h = await withGoal(yesDays(newGoal(), DAY0, 2)); // through 10-14
    h.setTime('2026-10-15', '21:00');
    h.store.getState().answer(gid(h.store), 'yes'); // its round hasn't been opened yet
    h.store.getState().answer(gid(h.store), 'yes', '2026-10-15');
    expect(h.store.getState()).toMatchObject({
      rejection: { reason: 'already-answered', goalId: 'g1' },
      route: { path: '/play', goalId: 'g1' },
    });

    h.store.getState().clearRejection();
    expect(h.store.getState().rejection).toBeNull();

    h.setTime('2026-10-18', '00:30'); // 10-16 closed unanswered at midnight
    h.store.getState().answer(gid(h.store), 'not-today', '2026-10-16');
    expect(h.store.getState().rejection?.reason).toBe('expired');
    h.store.getState().answer(gid(h.store), 'not-today');
    expect(h.store.getState()).toMatchObject({ rejection: null, route: { path: '/notice' } });
  });

  it('starts clean after erase', async () => {
    const h = await withGoal(yesDays(newGoal(), DAY0, 2));
    h.store.setState({ route: { path: '/play', goalId: 'g1' }, rejection: { reason: 'expired', goalId: 'g1' } });
    h.store.getState().erase();
    expect(h.store.getState()).toMatchObject({ goals: [], route: null, rejection: null, notices: {}, undo: null });
  });
});

describe('undo Not today', () => {
  it('puts back the goal and the round it dropped, so the check-in can be answered again', async () => {
    const h = await withGoal(yesDays(newGoal(), DAY0, 4)); // through 10-16
    h.setTime('2026-10-17', '21:00');
    h.store.getState().answer(gid(h.store), 'yes'); // streak 5, its round unplayed
    const round = primaryRound(h.store.getState());
    const before = primaryGoal(h.store.getState());

    h.setTime('2026-10-18', '21:00');
    h.store.getState().answer(gid(h.store), 'not-today');
    expect(primaryRound(h.store.getState())).toBeNull();
    expect(primaryGoal(h.store.getState())).toMatchObject({ streak: 4 });
    expect(h.store.getState().route).toEqual({ path: '/notice', goalId: 'g1' });
    expect(h.store.getState().undo).toMatchObject({ goalId: 'g1', day: '2026-10-18', at: h.clock.t });
    expect(h.store.getState().undo?.notice).toBe(h.store.getState().nextNotice()?.notice);

    h.clock.t += UNDO_MS - 1;
    expect(h.store.getState().undoNotToday()).toBe(true);
    expect(primaryGoal(h.store.getState())).toEqual(before);
    expect(primaryRound(h.store.getState())).toEqual(round);
    expect(h.store.getState()).toMatchObject({ notices: {}, route: null, undo: null });
    expect(pendingWindow(primaryGoal(h.store.getState())!, h.store.getState().now())?.day).toBe('2026-10-18');
    expect(h.store.getState().undoNotToday()).toBe(false); // once

    expect(h.store.getState().answer(gid(h.store), 'yes')).toMatchObject({ ok: true, outcome: { day: '2026-10-18', streak: 6 } });
  });

  it('gives back a shield a Shielded answer spent, and a streak a Reset took', async () => {
    const shielded = await withGoal({ ...yesDays(newGoal(), DAY0, 10), slide: 6, shields: 1 }); // through 10-22
    shielded.setTime('2026-10-23', '21:00');
    expect(shielded.store.getState().answer(gid(shielded.store), 'not-today')).toMatchObject({ outcome: { kind: 'shielded' } });
    expect(shielded.store.getState().undoNotToday()).toBe(true);
    expect(primaryGoal(shielded.store.getState())).toMatchObject({ streak: 10, shields: 1, slide: 6 });

    const reset = await withGoal({ ...yesDays(newGoal(), DAY0, 10), slide: 6, shields: 0 });
    reset.setTime('2026-10-23', '21:00');
    expect(reset.store.getState().answer(gid(reset.store), 'not-today')).toMatchObject({ outcome: { kind: 'reset' } });
    expect(reset.store.getState().undoNotToday()).toBe(true);
    expect(primaryGoal(reset.store.getState())).toMatchObject({ streak: 10, slide: 6, lastSettledDay: '2026-10-22' });
  });

  it("works for a Not today that cost nothing, and for one from a notification's button", async () => {
    const noted = await withGoal(newGoal());
    noted.setTime(DAY0, '21:00');
    noted.store.getState().answer(gid(noted.store), 'not-today');
    expect(noticeOf(noted.store)).toEqual({ kind: 'noted' });
    expect(noted.store.getState().undoNotToday()).toBe(true);
    expect(primaryGoal(noted.store.getState())?.history).toEqual([]);

    const h = await withGoal(yesDays(newGoal(), DAY0, 2)); // through 10-14
    h.setTime('2026-10-16', '09:00'); // the morning reminder for 10-15
    h.store.getState().answer(gid(h.store), 'not-today', '2026-10-15', 'notification');
    expect(h.store.getState().undoNotToday()).toBe(true);
    expect(pendingWindow(primaryGoal(h.store.getState())!, h.store.getState().now())?.day).toBe('2026-10-15');
  });

  it('lasts UNDO_MS, or the longer window passed in for a screen reader', async () => {
    const h = await withGoal(yesDays(newGoal(), DAY0, 2));
    h.setTime('2026-10-15', '21:00');
    h.store.getState().answer(gid(h.store), 'not-today');
    h.clock.t += UNDO_MS;
    expect(h.store.getState().undoNotToday()).toBe(false);
    expect(h.store.getState().undo).toBeNull(); // the Notice screen drops its button
    expect(primaryGoal(h.store.getState())?.lastSettledDay).toBe('2026-10-15');

    const s = await withGoal(yesDays(newGoal(), DAY0, 2));
    s.setTime('2026-10-15', '21:00');
    s.store.getState().answer(gid(s.store), 'not-today');
    s.clock.t += UNDO_MS_SCREEN_READER - 1;
    expect(s.store.getState().undoNotToday(UNDO_MS_SCREEN_READER)).toBe(true);
  });

  it('is turned down once the check-in has closed', async () => {
    const h = await withGoal(yesDays(newGoal(), DAY0, 2)); // through 10-14
    h.clock.t = at('2026-10-17', '00:00').getTime() - 2000; // 10-15 closes at midnight
    h.store.getState().answer(gid(h.store), 'not-today', '2026-10-15');
    h.clock.t += 3000;
    expect(h.store.getState().undoNotToday()).toBe(false);
    expect(primaryGoal(h.store.getState())?.history.at(-1)).toMatchObject({ day: '2026-10-15', result: 'no' });
  });

  it('is turned down once another day has settled, but not by a time zone change', async () => {
    const h = await withGoal(yesDays(newGoal(), DAY0, 2)); // through 10-14
    h.setTime('2026-10-16', '21:00'); // 10-15 and 10-16 both open
    h.store.getState().answer(gid(h.store), 'not-today', '2026-10-15');
    putGoal(h.store, answerDay(primaryGoal(h.store.getState())!, '2026-10-16', 'yes').state);
    expect(h.store.getState().undoNotToday()).toBe(false);

    const t = await withGoal(yesDays(newGoal(), DAY0, 2));
    t.setTime('2026-10-15', '21:00');
    t.store.getState().answer(gid(t.store), 'not-today');
    t.zone.tz = TOKYO;
    t.store.getState().refresh(); // a new goal object, with nothing new settled
    expect(t.store.getState().undoNotToday()).toBe(true);
    expect(latestScheduleEntry(primaryGoal(t.store.getState())!).tz).toBe(TOKYO);
  });

  it('ends with any other answer of that goal, or erase', async () => {
    const h = await withGoal(yesDays(newGoal(), DAY0, 2));
    h.setTime('2026-10-15', '21:00');
    h.store.getState().answer(gid(h.store), 'not-today');
    h.store.getState().answer(gid(h.store), 'yes', '2026-10-15'); // turned down: already answered
    expect(h.store.getState().undo).toBeNull();

    h.setTime('2026-10-16', '21:00');
    h.store.getState().answer(gid(h.store), 'not-today');
    h.store.getState().erase();
    expect(h.store.getState().undo).toBeNull();
    expect(h.store.getState().undoNotToday()).toBe(false);

    const y = await withGoal(yesDays(newGoal(), DAY0, 2));
    y.setTime('2026-10-15', '21:00');
    y.store.getState().answer(gid(y.store), 'yes');
    expect(y.store.getState().undo).toBeNull();
  });
});

describe("Home's reminders-off card", () => {
  it('hides for a week on the app clock, until erase', async () => {
    const h = await withGoal(newGoal(), { dev: true });
    h.store.getState().advanceDevClock(60_000);
    h.store.getState().hideReminderCard();
    expect(h.store.getState().reminderCardHiddenUntil).toBe(
      new Date(h.clock.t + 60_000 + REMINDER_CARD_HIDE_MS).toISOString(),
    );
    expect(REMINDER_CARD_HIDE_MS).toBe(7 * MS_PER_DAY);
    h.store.getState().erase();
    expect(h.store.getState().reminderCardHiddenUntil).toBeNull();
  });

  it('reads a stored value that is not a time as not hidden', async () => {
    await AsyncStorage.setItem(
      STORE_KEY,
      JSON.stringify({ version: STORE_VERSION, state: { goal: newGoal(), reminderCardHiddenUntil: 'next week' } }),
    );
    const { store } = harness();
    await ready(store);
    expect(primaryGoal(store.getState())?.goalId).toBe('g1');
    expect(store.getState().reminderCardHiddenUntil).toBeNull();
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
    h.store.getState().answer(gid(h.store), 'yes'); // streak 3 unlocks the Twin Barrel
    expect(h.store.getState().weapon).toBe('twin');

    h.store.getState().selectWeapon('pea');
    h.setTime('2026-10-16', '21:00');
    h.store.getState().answer(gid(h.store), 'yes'); // streak 4, nothing new
    expect(h.store.getState().weapon).toBe('pea');
  });

  it('records the round at Yes, and drops it once the next day settles', async () => {
    const h = await withGoal(yesDays(newGoal(), DAY0, 4)); // through 10-16
    h.setTime('2026-10-17', '21:00');
    h.store.getState().answer(gid(h.store), 'yes'); // streak 5: a bomb
    expect(primaryRound(h.store.getState())).toEqual({
      day: '2026-10-17',
      n: 5,
      rewards: {
        bomb: true,
        shield: false,
        shieldCapped: false,
        weapons: [],
        // The wallet started empty, so this Yes collects the credits the run already reached.
        credits: [
          { kind: 'game', amount: 1, key: 'zeros-3' },
          { kind: 'weapon', amount: 1, key: 'yes-run-3' },
        ],
      },
      borrowed: [],
      played: false,
    });
    expect(primaryGoal(h.store.getState())?.bombs).toBe(1);

    h.store.getState().finishRound(gid(h.store), '2026-10-16'); // an older round's: left alone
    expect(primaryRound(h.store.getState())?.played).toBe(false);
    h.store.getState().finishRound(gid(h.store), '2026-10-17');
    expect(primaryRound(h.store.getState())?.played).toBe(true);

    h.setTime('2026-10-18', '21:00');
    h.store.getState().refresh(); // 10-18 is open, not settled
    expect(primaryRound(h.store.getState())?.day).toBe('2026-10-17');
    h.store.getState().answer(gid(h.store), 'not-today');
    expect(primaryRound(h.store.getState())).toBeNull();
  });

  it('spends bombs through the engine', async () => {
    const h = await withGoal({ ...newGoal(), bombs: 1 });
    expect(h.store.getState().spendBomb(gid(h.store))).toBe(true);
    expect(primaryGoal(h.store.getState())?.bombs).toBe(0);
    expect(h.store.getState().spendBomb(gid(h.store))).toBe(false);
  });
});

describe('credits (SPEC 5)', () => {
  const holding = (game: number, weapon: number): CreditWallet => ({ balance: { game, weapon }, claimed: [] });

  it('pays the goal its Game credit at setup, once until everything is erased', async () => {
    const h = harness();
    await ready(h.store);
    const setup = () => h.store.getState().addGoal({ goal: 'Exercise more', checkInTime: '19:00', morningTime: '08:00' });
    setup();
    expect(h.store.getState().credits).toEqual({ balance: { game: 1, weapon: 0 }, claimed: ['goal-set'] });
    setup();
    expect(h.store.getState().credits.balance.game).toBe(1);
    h.store.getState().erase();
    setup();
    expect(h.store.getState().credits.balance.game).toBe(1);
  });

  it('pays what a Yes earned into the wallet, and records it on the round', async () => {
    const h = await withGoal(yesDays(newGoal(), DAY0, 1)); // through 10-13
    h.setTime('2026-10-14', '21:00');
    h.store.getState().answer(gid(h.store), 'yes'); // 2 zeros: nothing yet
    expect(primaryRound(h.store.getState())?.rewards.credits).toEqual([]);
    expect(h.store.getState().credits).toEqual(EMPTY_WALLET);

    h.setTime('2026-10-15', '21:00');
    h.store.getState().answer(gid(h.store), 'yes', '2026-10-15', 'notification'); // 3 zeros, 3 in a row, from a notification
    expect(primaryRound(h.store.getState())?.rewards).toMatchObject({
      weapons: ['twin'],
      credits: [
        { kind: 'game', amount: 1, key: 'zeros-3' },
        { kind: 'weapon', amount: 1, key: 'yes-run-3' },
      ],
    });
    expect(h.store.getState().credits).toEqual({ balance: { game: 1, weapon: 1 }, claimed: ['zeros-3', 'yes-run-3'] });

    h.setTime('2026-10-16', '21:00');
    h.store.getState().answer(gid(h.store), 'yes');
    expect(primaryRound(h.store.getState())?.rewards.credits).toEqual([]);
  });

  it('pays a Game credit for every 7 Yeses in a row, keyed by the goal and the day', async () => {
    const h = await withGoal(yesDays(newGoal(), DAY0, 13)); // through 10-25
    h.store.setState({ credits: { balance: { game: 0, weapon: 0 }, claimed: ['zeros-3', 'yes-run-3'] } });
    h.setTime('2026-10-26', '21:00');
    h.store.getState().answer(gid(h.store), 'yes'); // the 14th in a row
    expect(primaryRound(h.store.getState())?.rewards.credits).toEqual([
      { kind: 'game', amount: 1, key: `yes-every-7@${gid(h.store)}:2026-10-26` },
      { kind: 'weapon', amount: 1, key: 'yes-run-14' },
    ]);
    expect(h.store.getState().credits.balance).toEqual({ game: 1, weapon: 1 });
  });

  it('earns nothing for a Not today', async () => {
    const h = await withGoal(yesDays(newGoal(), DAY0, 1));
    h.setTime('2026-10-14', '21:00');
    h.store.getState().answer(gid(h.store), 'not-today');
    expect(h.store.getState().credits).toEqual(EMPTY_WALLET);
  });

  it('spends a Game credit on a bonus round, one waiting at a time', async () => {
    const h = await withGoal(yesDays(newGoal(), DAY0, 3));
    expect(h.store.getState().startBonusRound(250)).toBe(false); // no credit
    h.store.setState({ credits: holding(2, 0) });
    expect(h.store.getState().startBonusRound(0)).toBe(false);
    expect(h.store.getState().startBonusRound(BONUS_MAX_N + 1)).toBe(false);
    expect(h.store.getState().startBonusRound(250)).toBe(true);
    expect(h.store.getState().bonus).toEqual({ n: 250, borrowed: [], played: false });
    expect(h.store.getState().credits.balance.game).toBe(1);

    expect(h.store.getState().startBonusRound(10)).toBe(false); // the first is still waiting
    h.store.getState().finishBonusRound();
    expect(h.store.getState().bonus?.played).toBe(true);
    expect(h.store.getState().startBonusRound(BONUS_MAX_N)).toBe(true);
    expect(h.store.getState().bonus).toEqual({ n: BONUS_MAX_N, borrowed: [], played: false });
    expect(h.store.getState().credits.balance.game).toBe(0);
    // Nothing about the goal changes.
    expect(primaryGoal(h.store.getState())).toMatchObject({ streak: 3, bombs: 0 });
  });

  it('plays no bonus round without a goal', async () => {
    const h = harness();
    await ready(h.store);
    h.store.setState({ credits: holding(1, 0) });
    expect(h.store.getState().startBonusRound(10)).toBe(false);
  });

  it("spends a Weapon credit to lend a round a weapon it hasn't unlocked, once per round", async () => {
    const h = await withGoal(yesDays(newGoal(), DAY0, 3)); // best 3, through 10-15
    h.setTime('2026-10-16', '21:00');
    h.store.getState().answer(gid(h.store), 'yes');
    h.store.setState({ credits: holding(0, 0) });
    expect(h.store.getState().borrowWeapon({ round: 'daily', goalId: gid(h.store) }, 'rocket')).toBe(false); // no credit
    h.store.setState({ credits: holding(0, 2) });
    expect(h.store.getState().borrowWeapon({ round: 'daily', goalId: gid(h.store) }, 'twin')).toBe(false); // already unlocked
    expect(h.store.getState().borrowWeapon({ round: 'daily', goalId: gid(h.store) }, 'rocket')).toBe(true);
    expect(primaryRound(h.store.getState())?.borrowed).toEqual(['rocket']);
    expect(h.store.getState().credits.balance.weapon).toBe(1);
    expect(h.store.getState().borrowWeapon({ round: 'daily', goalId: gid(h.store) }, 'laser')).toBe(false); // the round's share is spent
    expect(h.store.getState().weapon).toBeNull(); // the saved pick stays an unlocked one

    h.store.setState({ credits: holding(1, 1) });
    expect(h.store.getState().borrowWeapon({ round: 'bonus' }, 'nuke')).toBe(false); // no bonus round
    h.store.getState().startBonusRound(500);
    expect(h.store.getState().borrowWeapon({ round: 'bonus' }, 'nuke')).toBe(true);
    expect(h.store.getState().bonus?.borrowed).toEqual(['nuke']);
    expect(primaryRound(h.store.getState())?.borrowed).toEqual(['rocket']);
  });

  it('lends nothing to a round already played', async () => {
    const h = await withGoal(yesDays(newGoal(), DAY0, 3));
    h.setTime('2026-10-16', '21:00');
    h.store.getState().answer(gid(h.store), 'yes');
    h.store.getState().finishRound(gid(h.store), '2026-10-16');
    h.store.setState({ credits: holding(0, 1) });
    expect(h.store.getState().borrowWeapon({ round: 'daily', goalId: gid(h.store) }, 'rocket')).toBe(false);
    expect(h.store.getState().credits.balance.weapon).toBe(1);
  });

  it('lets a borrowed weapon go with its round when the round goes unplayed', async () => {
    const h = await withGoal(yesDays(newGoal(), DAY0, 3));
    h.setTime('2026-10-16', '21:00');
    h.store.getState().answer(gid(h.store), 'yes');
    h.store.setState({ credits: holding(0, 1) });
    h.store.getState().borrowWeapon({ round: 'daily', goalId: gid(h.store) }, 'rocket');
    h.setTime('2026-10-19', '12:00'); // 10-17's check-in closed unanswered at midnight
    h.store.getState().refresh();
    expect(primaryRound(h.store.getState())).toBeNull();
    expect(h.store.getState().credits.balance.weapon).toBe(0);
  });

  it('brings a borrowed weapon back with its round when a Not today is undone', async () => {
    const h = await withGoal(yesDays(newGoal(), DAY0, 3));
    h.setTime('2026-10-16', '21:00');
    h.store.getState().answer(gid(h.store), 'yes');
    h.store.setState({ credits: holding(0, 1) });
    h.store.getState().borrowWeapon({ round: 'daily', goalId: gid(h.store) }, 'rocket');
    h.setTime('2026-10-17', '21:00');
    h.store.getState().answer(gid(h.store), 'not-today');
    expect(primaryRound(h.store.getState())).toBeNull();
    expect(h.store.getState().undoNotToday()).toBe(true);
    expect(primaryRound(h.store.getState())).toMatchObject({ day: '2026-10-16', borrowed: ['rocket'] });
    expect(h.store.getState().credits.balance.weapon).toBe(0);
  });

  it('pays every credit a debug jump reaches, and can empty the wallet, in development only', async () => {
    const h = await withGoal(yesDays(newGoal(), DAY0, 2));
    h.store.getState().devJumpToDay(gid(h.store), 30);
    // One Yes after the rebuilt run: what it has reached, and the every-30 mark it lands on.
    expect(primaryRound(h.store.getState())?.rewards.credits.map((g) => g.key.split('@')[0])).toEqual([
      'zeros-3',
      'yes-run-3',
      'yes-run-14',
      'yes-every-30',
    ]);
    expect(h.store.getState().credits.balance).toEqual({ game: 1, weapon: 3 });
    h.store.getState().devResetCredits();
    expect(h.store.getState().credits).toEqual(EMPTY_WALLET);

    const prod = await withGoal(newGoal(), { dev: false });
    prod.store.setState({ credits: holding(1, 1) });
    prod.store.getState().devResetCredits();
    expect(prod.store.getState().credits).toEqual(holding(1, 1));
  });

  it("gives a free Game credit for Plus's secret, every time, and claims nothing", async () => {
    const h = await withGoal(newGoal(), { limits: PLUS_LIMITS });
    h.store.setState({ credits: { balance: { game: 1, weapon: 0 }, claimed: ['goal-set'] } });
    expect(h.store.getState().giftCredit()).toBe(2);
    expect(h.store.getState().giftCredit()).toBe(3);
    expect(h.store.getState().credits).toEqual({ balance: { game: 3, weapon: 0 }, claimed: ['goal-set'] });
  });

  it('has no secret credits in Win Zero or on the website, or before a goal', async () => {
    const free = await withGoal(newGoal());
    expect(free.store.getState().giftCredit()).toBeNull();
    expect(free.store.getState().credits.balance.game).toBe(0);

    const empty = await withGoal(newGoal(), { limits: PLUS_LIMITS });
    empty.store.setState({ goals: [] });
    expect(empty.store.getState().giftCredit()).toBeNull();
  });
});

describe('game modes (SPEC 9)', () => {
  const OTHER_MODES = MODE_IDS.filter((id) => id !== 'shooter');

  it('plays the Shooter until a mode is picked', async () => {
    const h = await withGoal(newGoal());
    expect(h.store.getState().gameMode).toBeNull();
    expect(gameModeOf(h.store.getState())).toBe('shooter');
  });

  it('keeps Win Zero on the Shooter', async () => {
    const h = await withGoal(yesDays(newGoal(), DAY0, 100));
    for (const id of OTHER_MODES) expect(h.store.getState().setGameMode(id)).toBe(false);
    expect(h.store.getState().gameMode).toBeNull();
    expect(h.store.getState().setGameMode('shooter')).toBe(true);
    expect(h.store.getState().gameMode).toBe('shooter');
  });

  it('saves any mode whose round is built in Plus, and nothing else', async () => {
    const h = harness({ limits: PLUS_LIMITS });
    await ready(h.store);
    h.store.setState({ ...DEFAULT_PERSISTED, ...oneGoal(yesDays(newGoal(), DAY0, 100)) });
    for (const id of OTHER_MODES.filter((m) => !PLAYABLE_MODES.includes(m))) {
      expect(h.store.getState().setGameMode(id)).toBe(false);
    }
    expect(h.store.getState().setGameMode('pong' as ModeId)).toBe(false);
    for (const id of PLAYABLE_MODES) {
      expect(h.store.getState().setGameMode(id)).toBe(true);
      expect(h.store.getState().gameMode).toBe(id);
    }
    expect(h.store.getState().setGameMode('catch')).toBe(true);
    expect(gameModeOf(h.store.getState())).toBe('catch');
  });

  it('waits for storage before saving a pick', async () => {
    const h = harness();
    expect(h.store.getState().setGameMode('shooter')).toBe(false);
    await ready(h.store);
    expect(h.store.getState().gameMode).toBeNull();
  });

  it('plays a saved mode only where this app offers it', async () => {
    const free = await withGoal(newGoal());
    free.store.setState({ gameMode: 'catch' });
    expect(gameModeOf(free.store.getState())).toBe('shooter');
    const plus = harness({ limits: PLUS_LIMITS });
    await ready(plus.store);
    plus.store.setState({ ...DEFAULT_PERSISTED, ...oneGoal(newGoal()), gameMode: 'catch' });
    expect(gameModeOf(plus.store.getState())).toBe('catch');
  });

  it('forgets the pick on erase', async () => {
    const h = await withGoal(newGoal());
    h.store.getState().setGameMode('shooter');
    h.store.getState().erase();
    expect(h.store.getState().gameMode).toBeNull();
  });
});

describe('themes (SPEC 9)', () => {
  const OTHER_THEMES = THEME_IDS.filter((id) => id !== 'classic');

  it('draws in Classic until a theme is picked', async () => {
    const h = await withGoal(newGoal());
    expect(h.store.getState().theme).toBeNull();
    expect(themeOf(h.store.getState())).toBe('classic');
  });

  it('keeps Win Zero in Classic', async () => {
    const h = await withGoal(yesDays(newGoal(), DAY0, 100));
    h.store.setState({ arsenalBest: 400 });
    for (const id of OTHER_THEMES) expect(h.store.getState().setTheme(id)).toBe(false);
    expect(h.store.getState().theme).toBeNull();
    expect(h.store.getState().setTheme('classic')).toBe(true);
    expect(h.store.getState().theme).toBe('classic');
  });

  it('offers Plus the included themes from the start, and each earned one at its best streak', async () => {
    const h = await withGoal(newGoal(), { limits: PLUS_LIMITS });
    for (const id of ['classic', 'neon', 'mono', 'pastel'] as const) expect(h.store.getState().setTheme(id)).toBe(true);
    const steps = [
      ['ember', THEME_UNLOCK_EMBER],
      ['aurora', THEME_UNLOCK_AURORA],
      ['gold', THEME_UNLOCK_GOLD],
    ] as const;
    for (const [id, best] of steps) {
      h.store.setState({ arsenalBest: best - 1 });
      expect(h.store.getState().setTheme(id)).toBe(false);
      h.store.setState({ arsenalBest: best });
      expect(h.store.getState().setTheme(id)).toBe(true);
      expect(themeOf(h.store.getState())).toBe(id);
    }
  });

  it('never takes an earned theme away: it follows the shared best, not the current streak', async () => {
    const h = await withGoal(newGoal(), { limits: PLUS_LIMITS });
    h.store.setState({ arsenalBest: THEME_UNLOCK_EMBER });
    expect(h.store.getState().setTheme('ember')).toBe(true);
    expect(primaryGoal(h.store.getState())?.streak).toBe(0);
    expect(themeOf(h.store.getState())).toBe('ember');
  });

  it('waits for storage before saving a pick', async () => {
    const h = harness({ limits: PLUS_LIMITS });
    expect(h.store.getState().setTheme('neon')).toBe(false);
    await ready(h.store);
    expect(h.store.getState().theme).toBeNull();
  });

  it('draws a saved theme only where this app offers it, and once it is earned', async () => {
    const free = await withGoal(newGoal());
    free.store.setState({ theme: 'neon', arsenalBest: 400 });
    expect(themeOf(free.store.getState())).toBe('classic');
    const plus = await withGoal(newGoal(), { limits: PLUS_LIMITS });
    plus.store.setState({ theme: 'neon' });
    expect(themeOf(plus.store.getState())).toBe('neon');
    plus.store.setState({ theme: 'gold', arsenalBest: THEME_UNLOCK_GOLD - 1 });
    expect(themeOf(plus.store.getState())).toBe('classic');
  });

  it('forgets the pick on erase', async () => {
    const h = await withGoal(newGoal(), { limits: PLUS_LIMITS });
    h.store.getState().setTheme('pastel');
    h.store.getState().erase();
    expect(h.store.getState().theme).toBeNull();
  });
});

describe('themes a Yes unlocked (SPEC 9)', () => {
  /** A goal answered Yes on the n days before 10-13, with 10-13's check-in open at 21:00. */
  async function plusAt(n: number, opts: { limits?: typeof PLUS_LIMITS } = { limits: PLUS_LIMITS }) {
    const from = addDays(DAY0, -n);
    const h = await withGoal(yesDays(newGoal({ day: from }), from, n), opts);
    h.setTime(DAY0, '21:00');
    return h;
  }

  it('records Ember on the Yes that reaches 30', async () => {
    const h = await plusAt(THEME_UNLOCK_EMBER - 1);
    h.store.getState().answer(gid(h.store), 'yes');
    expect(primaryRound(h.store.getState())).toMatchObject({ n: THEME_UNLOCK_EMBER, unlocks: ['ember'] });
  });

  it('records nothing once the shared best had already passed it', async () => {
    const other = await plusAt(THEME_UNLOCK_EMBER - 1);
    const from = addDays(DAY0, -40);
    const forty = { ...yesDays(newGoal({ day: from }), from, 40), goalId: 'g2' };
    other.store.setState({ goals: [...other.store.getState().goals, { goal: forty, round: null, seenThrough: null }] });
    other.store.getState().answer(gid(other.store), 'yes');
    expect(primaryRound(other.store.getState())).toMatchObject({ n: THEME_UNLOCK_EMBER });
    expect(primaryRound(other.store.getState())).not.toHaveProperty('unlocks');

    const archived = await plusAt(THEME_UNLOCK_EMBER - 1);
    archived.store.setState({ arsenalBest: THEME_UNLOCK_EMBER });
    archived.store.getState().answer(gid(archived.store), 'yes');
    expect(primaryRound(archived.store.getState())).not.toHaveProperty('unlocks');
  });

  it('records only the step a debug jump takes: Ember at 30, Gold Year at 365', async () => {
    const h = await withGoal(yesDays(newGoal(), DAY0, 2), { limits: PLUS_LIMITS });
    h.store.getState().devJumpToDay(gid(h.store), THEME_UNLOCK_EMBER);
    expect(primaryRound(h.store.getState())?.unlocks).toEqual(['ember']);
    h.store.getState().devJumpToDay(gid(h.store), THEME_UNLOCK_GOLD);
    expect(primaryRound(h.store.getState())?.unlocks).toEqual(['gold']);
  });

  it('records nothing in Win Zero, which has no themes to earn', async () => {
    const h = await plusAt(THEME_UNLOCK_EMBER - 1, {});
    h.store.getState().answer(gid(h.store), 'yes');
    expect(primaryRound(h.store.getState())).toMatchObject({ n: THEME_UNLOCK_EMBER, rewards: { weapons: ['chain'] } });
    expect(primaryRound(h.store.getState())).not.toHaveProperty('unlocks');
  });
});

describe('lock-screen names (SPEC 9)', () => {
  it('keeps a trimmed name up to its limit, and clears it when emptied', async () => {
    const h = await withGoal(newGoal(), { limits: PLUS_LIMITS });
    const id = gid(h.store);
    expect(h.store.getState().setGoalAlias(id, '  Morning run  ')).toEqual({ ok: true });
    expect(primaryGoal(h.store.getState())?.alias).toBe('Morning run');
    h.store.getState().setGoalAlias(id, 'x'.repeat(GOAL_ALIAS_MAX_LENGTH + 5));
    expect(primaryGoal(h.store.getState())?.alias).toHaveLength(GOAL_ALIAS_MAX_LENGTH);
    expect(h.store.getState().setGoalAlias(id, '   ')).toEqual({ ok: true });
    expect(primaryGoal(h.store.getState())).not.toHaveProperty('alias');
    expect(h.store.getState().setGoalAlias('nobody', 'Run')).toEqual({ ok: false, reason: 'no-goal' });
  });

  it('waits for storage, then saves it', async () => {
    const h = harness({ limits: PLUS_LIMITS });
    expect(h.store.getState().setGoalAlias('goal-1', 'Run')).toEqual({ ok: false, reason: 'no-goal' });
    await ready(h.store);
    h.store.getState().addGoal({ goal: 'Exercise more', checkInTime: '19:00', morningTime: '08:00' });
    h.store.getState().setGoalAlias(gid(h.store), 'Run');
    await flush();

    const b = harness({ limits: PLUS_LIMITS });
    await ready(b.store);
    expect(primaryGoal(b.store.getState())?.alias).toBe('Run');
  });
});

describe('persistence', () => {
  it('round-trips through storage into a second store', async () => {
    const a = harness();
    await ready(a.store);
    a.store.getState().addGoal({ goal: 'Exercise more', checkInTime: '19:00', morningTime: '08:00' });
    a.setTime(DAY0, '21:00');
    a.store.getState().answer(gid(a.store), 'yes');
    a.store.getState().setPref('sound', false);
    a.store.getState().setPref('reengage', false);
    a.store.getState().setPref('goalInReminders', true);
    a.store.getState().selectWeapon('pea');
    expect(a.store.getState().setGameMode('shooter')).toBe(true);
    expect(a.store.getState().setTheme('classic')).toBe(true);
    a.store.getState().hideReminderCard();
    a.store.getState().startMoveOut();
    a.store.setState({
      notices: { [gid(a.store)]: { kind: 'noted' } },
      imports: { 'move-1': { at: '2026-10-12T18:00:00.000Z', createdAt: '2026-10-12T17:59:00.000Z', game: 1, weapon: 0 } },
    });
    await flush();

    const b = harness();
    await ready(b.store);
    const pick = (s: ReturnType<AppStore['getState']>) => ({
      goals: s.goals,
      archived: s.archived,
      arsenalBest: s.arsenalBest,
      weapon: s.weapon,
      gameMode: s.gameMode,
      theme: s.theme,
      prefs: s.prefs,
      credits: s.credits,
      bonus: s.bonus,
      reminderCardHiddenUntil: s.reminderCardHiddenUntil,
      devClockOffsetMs: s.devClockOffsetMs,
      moveOut: s.moveOut,
      imports: s.imports,
    });
    expect(pick(b.store.getState())).toEqual(pick(a.store.getState()));
    expect(b.store.getState().moveOut).toMatchObject({ status: 'sent' });
    expect(b.store.getState().gameMode).toBe('shooter');
    expect(b.store.getState().theme).toBe('classic');
    expect(b.store.getState().reminderCardHiddenUntil).not.toBeNull();
    expect(b.store.getState().prefs).toEqual({ sound: false, haptics: true, reengage: false, goalInReminders: true });
    expect(primaryRound(b.store.getState())).toMatchObject({ n: 1, played: false });
    expect(noticeOf(b.store)).toBeNull(); // not persisted

    const raw = JSON.parse((await AsyncStorage.getItem(STORE_KEY)) ?? '{}');
    expect(raw.version).toBe(STORE_VERSION);
    expect(Object.keys(raw.state).sort()).toEqual(
      [
        'archived',
        'arsenalBest',
        'bonus',
        'credits',
        'devClockOffsetMs',
        'gameMode',
        'goals',
        'imports',
        'moveOut',
        'prefs',
        'reminderCardHiddenUntil',
        'theme',
        'weapon',
        // Version 2's fields, copied from the first goal for a build still on it.
        'goal',
        'round',
        'seenThrough',
      ].sort(),
    );
    const first = raw.state.goals[0];
    expect(raw.state).toMatchObject({ goal: first.goal, round: first.round, seenThrough: first.seenThrough });
    expect(await AsyncStorage.getItem(STORE_BACKUP_KEY)).toBeNull(); // nothing unreadable
  });

  it('keeps a goal saved by a newer build, after a downgrade', async () => {
    const goal = { ...yesDays(newGoal(), DAY0, 3), version: 2, mood: 'steady' };
    await AsyncStorage.setItem(STORE_KEY, JSON.stringify({ version: STORE_VERSION + 1, state: { goal } }));
    const { store } = harness();
    await ready(store);
    expect(primaryGoal(store.getState())).toMatchObject({ goalId: 'g1', streak: 3, version: 2, mood: 'steady' });
    await flush();
    expect(await AsyncStorage.getItem(STORE_BACKUP_KEY)).toBeNull();
  });

  it("backs up a goal it can't read before starting fresh, and keeps the rest", async () => {
    // Same version, and an older one that goes through migrate first.
    for (const version of [STORE_VERSION, 0]) {
      await AsyncStorage.clear();
      const { history: _history, ...broken } = yesDays(newGoal(), DAY0, 3);
      await AsyncStorage.setItem(STORE_KEY, JSON.stringify({ version, state: { goal: broken, prefs: { sound: false } } }));
      const { store } = harness();
      await ready(store);
      expect(primaryGoal(store.getState())).toBeNull();
      expect(store.getState().prefs.sound).toBe(false);

      await flush();
      const backup = JSON.parse((await AsyncStorage.getItem(STORE_BACKUP_KEY)) ?? '{}');
      expect(backup.state.goal).toEqual(broken);
      expect(backup.at).toBe(at(DAY0, '12:00').toISOString());
      const saved = JSON.parse((await AsyncStorage.getItem(STORE_KEY)) ?? '{}');
      expect(saved.state.goal).toBeNull(); // the main copy moved on; the backup didn't
    }
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
    expect(primaryGoal(store.getState())).toMatchObject({ goalId: 'g1', streak: 3, slide: 0, paused: false });
    expect(primaryGoal(store.getState())?.history).toHaveLength(3);
    expect(store.getState().prefs).toEqual({ sound: false, haptics: true, reengage: true, goalInReminders: false });
    expect(store.getState().weapon).toBeNull();
    expect(primaryRound(store.getState())).toBeNull();
    expect(store.getState().credits).toEqual({ balance: { game: 1, weapon: 0 }, claimed: ['goal-set'] });

    await flush();
    const raw = JSON.parse((await AsyncStorage.getItem(STORE_KEY)) ?? '{}');
    expect(raw.version).toBe(STORE_VERSION); // written back in the current shape
    expect(raw.state.goal.slide).toBe(0);
  });

  it('upgrades a save from before credits: the goal earns its Game credit, and the round reads as before', async () => {
    const goal = yesDays(newGoal(), DAY0, 5); // through 10-17
    const round = { day: '2026-10-17', n: 5, rewards: { bomb: true, shield: false, shieldCapped: false, weapons: [] }, played: false };
    await AsyncStorage.setItem(STORE_KEY, JSON.stringify({ version: 1, state: { goal, round, weapon: 'twin' } }));
    const { store } = harness();
    await ready(store);
    expect(store.getState().credits).toEqual({ balance: { game: 1, weapon: 0 }, claimed: ['goal-set'] });
    expect(store.getState().bonus).toBeNull();
    expect(primaryRound(store.getState())).toEqual({ ...round, rewards: { ...round.rewards, credits: [] }, borrowed: [] });
    expect(store.getState().weapon).toBe('twin');

    await flush();
    const raw = JSON.parse((await AsyncStorage.getItem(STORE_KEY)) ?? '{}');
    expect(raw.version).toBe(STORE_VERSION);
    expect(raw.state.credits.claimed).toEqual(['goal-set']);
  });

  it('starts fresh from a corrupt blob instead of hanging', async () => {
    await AsyncStorage.setItem(STORE_KEY, '{not json');
    const { store } = harness();
    await ready(store);
    expect(primaryGoal(store.getState())).toBeNull();
  });

  it('erase clears the state and storage, backup included', async () => {
    const h = await withGoal(yesDays(newGoal(), DAY0, 3));
    await AsyncStorage.setItem(STORE_BACKUP_KEY, '{"state":{}}');
    h.store.getState().setPref('haptics', false);
    h.store.setState({
      credits: { balance: { game: 2, weapon: 1 }, claimed: ['goal-set', 'zeros-2'] },
      bonus: { n: 250, borrowed: [], played: false },
    });
    h.store.getState().erase();
    expect(primaryGoal(h.store.getState())).toBeNull();
    expect(h.store.getState().prefs.haptics).toBe(true);
    // Credits go with everything else, as an uninstall would take them.
    expect(h.store.getState().credits).toEqual(EMPTY_WALLET);
    expect(h.store.getState().bonus).toBeNull();
    await flush();
    expect(await AsyncStorage.getItem(STORE_KEY)).toBeNull();
    expect(await AsyncStorage.getItem(STORE_BACKUP_KEY)).toBeNull();
  });
});

describe('moving to Win Zero Plus (SPEC 9)', () => {
  const credits = { balance: { game: 2, weapon: 1 }, claimed: ['goal-set', 'zeros-2'] };

  it('gives every try one id, until the move is cancelled', async () => {
    const h = await withGoal(yesDays(newGoal(), DAY0, 3));
    const s = () => h.store.getState();
    const id = s().startMoveOut();
    expect(id).toBe('goal-1');
    expect(s().moveOut).toEqual({ id, status: 'sent', sentAt: at(DAY0, '12:00').toISOString() });
    expect(isMovedOut(s())).toBe(false);

    h.setTime('2026-10-14', '09:00');
    expect(s().startMoveOut()).toBe(id);
    expect(s().moveOut?.sentAt).toBe(at('2026-10-14', '09:00').toISOString());

    s().cancelMoveOut();
    expect(s().moveOut).toBeNull();
    expect(s().startMoveOut()).not.toBe(id);
  });

  it('needs storage read, and a goal to move', async () => {
    const early = harness();
    expect(early.store.getState().startMoveOut()).toBeNull();
    await ready(early.store);
    expect(early.store.getState().startMoveOut()).toBeNull();
    expect(early.store.getState().moveOut).toBeNull();
  });

  it('acts only on the confirmation of the move it sent', async () => {
    const h = await withGoal(yesDays(newGoal(), DAY0, 3));
    const s = () => h.store.getState();
    h.store.setState({ credits, bonus: { n: 40, borrowed: [], played: false } });
    const id = s().startMoveOut()!;

    expect(s().confirmMovedOut('someone-else')).toBe(false);
    expect(s().moveOut?.status).toBe('sent');
    expect(s().credits).toEqual(credits);

    expect(s().confirmMovedOut(id)).toBe(true);
    expect(isMovedOut(s())).toBe(true);
    expect(s().moveOut).toMatchObject({ id, status: 'moved' });
    // The credits went with the move; what they were earned for stays claimed here.
    expect(s().credits).toEqual({ balance: { game: 0, weapon: 0 }, claimed: credits.claimed });
    expect(s().bonus).toBeNull();
    expect(primaryGoal(s())?.streak).toBe(3);

    // Done: the same confirmation again, a new try or a cancel change nothing.
    expect(s().confirmMovedOut(id)).toBe(false);
    expect(s().startMoveOut()).toBeNull();
    s().cancelMoveOut();
    expect(isMovedOut(s())).toBe(true);
  });

  it('keeps a played bonus round for its replays', async () => {
    const h = await withGoal(newGoal());
    const played = { n: 40, borrowed: [], played: true };
    h.store.setState({ bonus: played });
    h.store.getState().confirmMovedOut(h.store.getState().startMoveOut()!);
    expect(h.store.getState().bonus).toEqual(played);
  });

  it('keeps using this app after a move, settling the days since as any break', async () => {
    const h = await withGoal(yesDays(newGoal(), DAY0, 3)); // through 10-15
    const s = () => h.store.getState();
    s().confirmMovedOut(s().startMoveOut()!);
    h.setTime('2026-10-20', '12:00');
    s().keepUsingHere();
    expect(s().moveOut).toBeNull();
    expect(primaryGoal(s())?.lastSettledDay).toBe('2026-10-18'); // 10-19 is open until tonight
    expect(primaryGoal(s())?.streak).toBe(3); // the free days
    expect(s().startMoveOut()).toBe('goal-2'); // a later move is a new one
  });

  it('takes in a merged move, and drops news about the goals it replaced', async () => {
    const h = await withGoal(yesDays(newGoal(), DAY0, 3), { limits: PLUS_LIMITS });
    const s = () => h.store.getState();
    h.store.setState({
      notices: { g1: { kind: 'noted' }, g2: { kind: 'noted' } },
      route: { path: '/notice', goalId: 'g1' },
      rejection: { reason: 'expired', goalId: 'g1' },
    });
    const incoming = { ...yesDays(newGoal(), DAY0, 5) };
    const imports = { 'move-1': { at: at(DAY0, '12:00').toISOString(), createdAt: at(DAY0, '11:59').toISOString(), game: 2, weapon: 0 } };
    let seen: { goals: number; now: Date } | null = null;
    const r = s().importMove((current, now) => {
      seen = { goals: current.goals.length, now };
      return {
        ok: true,
        state: { ...current, goals: [{ goal: incoming, round: null, seenThrough: null }], imports },
        replaced: ['g1'],
      };
    });
    expect(r.ok).toBe(true);
    expect(seen).toEqual({ goals: 1, now: at(DAY0, '12:00') });
    expect(primaryGoal(s())?.streak).toBe(5);
    expect(s().imports).toEqual(imports);
    expect(s().notices).toEqual({ g2: { kind: 'noted' } });
    expect(s().route).toBeNull();
    expect(s().rejection).toBeNull();
  });

  it('leaves everything as it was when the merge refuses, or before storage is read', async () => {
    const early = harness({ limits: PLUS_LIMITS });
    expect(early.store.getState().importMove(() => ({ ok: false, reason: 'full' }))).toEqual({ ok: false, reason: 'not-ready' });
    const h = await withGoal(newGoal(), { limits: PLUS_LIMITS });
    const before = h.store.getState().goals;
    expect(h.store.getState().importMove(() => ({ ok: false, reason: 'full' }))).toEqual({ ok: false, reason: 'full' });
    expect(h.store.getState().goals).toBe(before);
  });

  it('forgets moves both ways on erase', async () => {
    const h = await withGoal(newGoal());
    h.store.getState().startMoveOut();
    h.store.setState({ imports: { 'move-1': { at: DAY0, createdAt: DAY0, game: 0, weapon: 0 } } });
    h.store.getState().erase();
    expect(h.store.getState().moveOut).toBeNull();
    expect(h.store.getState().imports).toEqual({});
  });
});

describe('debug clock', () => {
  it('moves the app clock in development and resolves', async () => {
    const h = await withGoal(yesDays(newGoal(), DAY0, 1)); // answered 10-13; clock at 10-13 12:00
    h.store.getState().advanceDevClock(9 * MS_PER_DAY); // 10-22 12:00: 10-14 .. 10-20 closed
    expect(h.store.getState().now().getTime()).toBe(h.clock.t + 9 * MS_PER_DAY);
    expect(h.store.getState().clockOffsetMs()).toBe(9 * MS_PER_DAY);
    expect(primaryGoal(h.store.getState())?.consecutiveMissed).toBe(7);
    h.store.getState().resetDevClock();
    expect(h.store.getState().now().getTime()).toBe(h.clock.t);
    expect(h.store.getState().clockOffsetMs()).toBe(0);
  });

  it('is ignored outside development', async () => {
    const h = await withGoal(yesDays(newGoal(), DAY0, 1), { dev: false });
    h.store.getState().advanceDevClock(MS_PER_DAY);
    expect(h.store.getState().devClockOffsetMs).toBe(0);
    h.store.setState({ devClockOffsetMs: MS_PER_DAY }); // e.g. left over in storage
    expect(h.store.getState().now().getTime()).toBe(h.clock.t);
    expect(h.store.getState().clockOffsetMs()).toBe(0);
  });
});

describe('debug jump to day', () => {
  it('rebuilds a run and readies the Day N round in development', async () => {
    const h = await withGoal(yesDays(newGoal(), DAY0, 2)); // a short run, clock at 10-13 12:00
    const r = h.store.getState().devJumpToDay(gid(h.store), 30);
    expect(r?.ok).toBe(true);
    const s = h.store.getState();
    expect(primaryGoal(s)).toMatchObject({ goalId: 'g1', streak: 30, bestStreak: 30, bombs: 6, shields: 3 });
    expect(primaryGoal(s)?.history.every((e) => e.result === 'yes')).toBe(true);
    expect(primaryRound(s)).toMatchObject({ day: addDays(DAY0, -1), n: 30, played: false, rewards: { bomb: true, weapons: ['chain'] } });
    expect(s.weapon).toBe('chain');
    expect(s.notices).toEqual({});
    expect(s.nextNotice()).toBeNull();
  });

  it('does nothing without the development tools, as in a production build', async () => {
    const h = await withGoal(yesDays(newGoal(), DAY0, 2), { dev: false });
    expect(h.store.getState().devJumpToDay(gid(h.store), 30)).toBeNull();

    const noTools = createAppStore({ storage: AsyncStorage, now: () => new Date(h.clock.t), timeZone: () => DENVER, makeId: () => 'x', dev: true });
    await ready(noTools);
    noTools.setState(oneGoal(yesDays(newGoal(), DAY0, 2)));
    expect(noTools.getState().devJumpToDay(gid(noTools), 30)).toBeNull();
    expect(primaryGoal(noTools.getState())?.streak).toBe(2);
  });

  it('turns down run lengths it cannot build', async () => {
    const h = await withGoal(yesDays(newGoal(), DAY0, 2));
    const before = primaryGoal(h.store.getState());
    for (const n of [0, 2.5, 100_000]) expect(h.store.getState().devJumpToDay(gid(h.store), n)).toBeNull();
    expect(primaryGoal(h.store.getState())).toBe(before);
  });

  it('is ignored outside development', async () => {
    const h = await withGoal(yesDays(newGoal(), DAY0, 2), { dev: false });
    const before = primaryGoal(h.store.getState());
    expect(h.store.getState().devJumpToDay(gid(h.store), 30)).toBeNull();
    expect(primaryGoal(h.store.getState())).toBe(before);
    expect(primaryRound(h.store.getState())).toBeNull();
  });
});

describe('debug skip to next check-in', () => {
  it('moves the clock to just after the next window opens', async () => {
    const h = await withGoal(yesDays(newGoal(), DAY0, 1)); // answered 10-13; clock at 10-13 12:00
    h.store.getState().devSkipToNextCheckIn();
    const s = h.store.getState();
    expect(s.now().getTime()).toBe(at(addDays(DAY0, 1), '20:00').getTime() + 1000);
    expect(pendingWindow(primaryGoal(s)!, s.now())?.day).toBe(addDays(DAY0, 1));
    expect(primaryGoal(s)?.history).toHaveLength(1); // nothing was missed on the way
  });

  it('does nothing while a window is open', async () => {
    const h = await withGoal(yesDays(newGoal(), DAY0, 1));
    h.store.getState().devSkipToNextCheckIn(); // 10-14's window is now open
    const offset = h.store.getState().devClockOffsetMs;
    h.store.getState().devSkipToNextCheckIn();
    expect(h.store.getState().devClockOffsetMs).toBe(offset);
  });

  it('is ignored outside development', async () => {
    const h = await withGoal(yesDays(newGoal(), DAY0, 1), { dev: false });
    h.store.getState().devSkipToNextCheckIn();
    expect(h.store.getState().devClockOffsetMs).toBe(0);
  });
});

describe('several goals (SPEC 9)', () => {
  const add = (store: AppStore, goal: string, checkInTime = '20:00', days?: number[]) =>
    store.getState().addGoal({ goal, checkInTime, morningTime: '09:00', days });
  const idOf = (store: AppStore, i: number) => store.getState().goals[i]!.goal.goalId;

  it('keeps up to three in Plus, and pays the first goal its Game credit only', async () => {
    const { store } = harness({ limits: PLUS_LIMITS });
    await ready(store);
    expect(add(store, 'Stop drinking')).toEqual({ ok: true, goalId: 'goal-1' });
    expect(add(store, 'Run', '07:00')).toEqual({ ok: true, goalId: 'goal-2' });
    expect(add(store, 'Read', '21:00', [1, 3, 5])).toEqual({ ok: true, goalId: 'goal-3' });
    expect(add(store, 'Stretch')).toEqual({ ok: false, reason: 'full' });
    expect(store.getState().goals.map((s) => s.goal.goal)).toEqual(['Stop drinking', 'Run', 'Read']);
    expect(store.getState().goals[2]?.goal.checkInSchedule[0]?.days).toEqual([1, 3, 5]);
    expect(store.getState().credits).toEqual({ balance: { game: 1, weapon: 0 }, claimed: ['goal-set'] });
    expect(canAddGoal(store.getState())).toBe(false);
  });

  it('offers check-in days only where the app does', async () => {
    const free = harness();
    await ready(free.store);
    expect(add(free.store, 'Run', '20:00', [1, 2, 3, 4, 5])).toEqual({ ok: false, reason: 'days-not-allowed' });
    expect(add(free.store, 'Run', '20:00', [0, 1, 2, 3, 4, 5, 6])).toMatchObject({ ok: true });
    expect(free.store.getState().setCheckInDays(idOf(free.store, 0), [1])).toEqual({ ok: false, reason: 'days-not-allowed' });

    const plus = harness({ limits: PLUS_LIMITS });
    await ready(plus.store);
    add(plus.store, 'Run');
    expect(plus.store.getState().setCheckInDays(idOf(plus.store, 0), [])).toEqual({ ok: false, reason: 'no-days' });
    expect(plus.store.getState().setCheckInDays(idOf(plus.store, 0), [1, 2, 3, 4, 5])).toEqual({ ok: true });
    expect(latestScheduleEntry(primaryGoal(plus.store.getState())!).days).toEqual([1, 2, 3, 4, 5]);
    expect(plus.store.getState().setCheckInDays('nobody', [1])).toEqual({ ok: false, reason: 'no-goal' });
  });

  it('answers each goal on its own: its round, its notice, its route', async () => {
    const { store, setTime } = harness({ limits: PLUS_LIMITS });
    await ready(store);
    add(store, 'Stop drinking');
    add(store, 'Run', '19:00');
    const [a, b] = [idOf(store, 0), idOf(store, 1)];
    setTime(DAY0, '21:00');
    store.getState().answer(b, 'not-today');
    expect(store.getState().undo?.goalId).toBe(b);
    store.getState().answer(a, 'yes');
    expect(slotById(store.getState(), a)?.round).toMatchObject({ n: 1, played: false });
    expect(slotById(store.getState(), b)?.round).toBeNull();
    expect(store.getState().route).toEqual({ path: '/play', goalId: a });
    // A's Yes ends B's undo, as any answer does, but B's notice still waits its turn.
    expect(store.getState().undo).toBeNull();
    expect(store.getState().notices[b]).toEqual({ kind: 'noted' });
    expect(store.getState().nextNotice()).toMatchObject({ source: 'answer', goalId: b });
    store.getState().finishRound(a, slotById(store.getState(), a)?.round?.day ?? '');
    expect(slotById(store.getState(), a)?.round?.played).toBe(true);
    expect(store.getState().spendBomb(b)).toBe(false);
  });

  it('shows missed-day news goal by goal, the preferred goal first', async () => {
    const { store, setTime } = harness({ limits: PLUS_LIMITS });
    await ready(store);
    store.setState({
      goals: [
        { goal: { ...yesDays(newGoal(), DAY0, 10), goalId: 'a' }, round: null, seenThrough: null },
        { goal: { ...yesDays(newGoal(), DAY0, 10), goalId: 'b' }, round: null, seenThrough: null },
      ],
    });
    setTime('2026-11-02', '00:30');
    store.getState().refresh(); // both: 7 free, then 2 slips
    expect(store.getState().nextNotice()).toMatchObject({ source: 'missed', goalId: 'a' });
    expect(store.getState().nextNotice('b')).toMatchObject({ source: 'missed', goalId: 'b' });
    store.getState().noticeShown(store.getState().nextNotice()!);
    expect(store.getState().nextNotice()).toMatchObject({ goalId: 'b' });
    expect(slotById(store.getState(), 'a')?.seenThrough).toBe('2026-10-31');
    expect(slotById(store.getState(), 'b')?.seenThrough).toBeNull();
  });

  it('shares the arsenal: weapons follow the best goal, and archiving or deleting it takes none away', async () => {
    const { store, setTime } = harness({ limits: PLUS_LIMITS });
    await ready(store);
    store.setState({
      goals: [
        { goal: { ...yesDays(newGoal(), DAY0, 30), goalId: 'long' }, round: null, seenThrough: null },
        { goal: { ...newGoal({ day: '2026-11-12' }), goalId: 'new' }, round: null, seenThrough: null },
      ],
    });
    expect(arsenalBestOf(store.getState())).toBe(30);
    // The new goal's first Yes unlocks nothing: the Pea Shooter through the Chain Zapper are old news.
    setTime('2026-11-12', '21:00');
    const r = store.getState().answer('new', 'yes');
    expect(r?.ok && r.outcome.kind === 'yes' && r.outcome.rewards.weapons).toEqual([]);
    store.getState().selectWeapon('chain');
    expect(store.getState().weapon).toBe('chain');

    expect(store.getState().archiveGoal('long')).toBe(true);
    expect(store.getState().goals.map((s) => s.goal.goalId)).toEqual(['new']);
    expect(store.getState().archived.map((a) => a.goal.goalId)).toEqual(['long']);
    expect(store.getState().arsenalBest).toBe(30);
    expect(arsenalBestOf(store.getState())).toBe(30);
    expect(store.getState().deleteArchivedGoal('long')).toBe(true);
    expect(store.getState().archived).toEqual([]);
    expect(arsenalBestOf(store.getState())).toBe(30);
    expect(store.getState().archiveGoal('long')).toBe(false);
  });

  it('gives a bonus round the bombs every goal has banked', async () => {
    const { store } = harness({ limits: PLUS_LIMITS });
    await ready(store);
    store.setState({
      goals: [
        { goal: { ...newGoal(), goalId: 'a', bombs: 2 }, round: null, seenThrough: null },
        { goal: { ...newGoal(), goalId: 'b', bombs: 3 }, round: null, seenThrough: null },
      ],
    });
    expect(totalBombs(store.getState())).toBe(5);
  });

  it('archiving clears what was waiting for that goal only', async () => {
    const { store, setTime } = harness({ limits: PLUS_LIMITS });
    await ready(store);
    add(store, 'Stop drinking');
    add(store, 'Run');
    const [a, b] = [idOf(store, 0), idOf(store, 1)];
    setTime(DAY0, '21:00');
    store.getState().answer(a, 'not-today');
    store.getState().answer(b, 'yes');
    store.getState().archiveGoal(a);
    expect(store.getState().notices).toEqual({});
    expect(store.getState().route).toEqual({ path: '/play', goalId: b });
    expect(canAddGoal(store.getState())).toBe(true);
  });
});
