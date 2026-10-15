// The persisted store: lifecycle, notices, weapons, rounds, persistence and migration.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it } from '@jest/globals';

import { addDays, currentCheckInTime, latestScheduleEntry, MS_PER_DAY, pendingWindow } from '@/engine';
import { answerDay, at, DAY0, DENVER, newGoal, TOKYO, yesDays } from '@/engine/__tests__/fixtures';

import { createAppStore, UNDO_MS, UNDO_MS_SCREEN_READER, type AppStore } from '../createAppStore';
import { startLifecycle } from '../lifecycle';
import { STORE_KEY, STORE_VERSION } from '../types';
import { fakeAppState, flush, harness, ready, withGoal } from './harness';

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
    h.setTime('2026-10-21', '00:30'); // 10-16 .. 10-19 closed
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
    expect(store.getState().setMorningTime('20:00')).toEqual({ ok: true }); // the same as check-in time
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
    h.setTime('2026-10-31', '00:30');
    h.store.getState().refresh(); // seven free misses
    expect(h.store.getState().nextNotice()).toBeNull();
    h.store.getState().markQuietMisses();
    expect(h.store.getState().seenThrough).toBe('2026-10-29');

    h.setTime('2026-11-02', '00:30');
    h.store.getState().refresh(); // two slips
    const pending = h.store.getState().nextNotice();
    expect(pending).toEqual({
      source: 'missed',
      notice: { kind: 'slipping', cause: 'missed', lost: 2, streak: 8, days: 2, stopped: false },
      through: '2026-10-31',
    });
    h.store.getState().noticeShown(pending!);
    expect(h.store.getState().seenThrough).toBe('2026-10-31');
    expect(h.store.getState().nextNotice()).toBeNull();
  });

  it('only marks missed days seen once their news is shown', async () => {
    const h = await withGoal(yesDays(newGoal(), DAY0, 10)); // through 10-22
    h.setTime('2026-11-02', '00:30');
    h.store.getState().refresh(); // 7 free misses, then 2 slips
    const first = h.store.getState().nextNotice();
    expect(h.store.getState().nextNotice()).toEqual(first); // reading it changes nothing
    expect(h.store.getState().seenThrough).toBeNull();
    h.store.getState().markQuietMisses(); // there is news, so nothing is quiet
    expect(h.store.getState().seenThrough).toBeNull();

    // A Yes now leaves the news in place, for after the round.
    expect(h.store.getState().answer('yes')).toMatchObject({ ok: true });
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
    expect(h.store.getState().seenThrough).toBe('2026-11-01');
  });

  it("puts an answer's notice ahead of missed-day news, and clears only the one shown", async () => {
    const h = await withGoal({ ...yesDays(newGoal(), DAY0, 10), shields: 0 }); // through 10-22
    h.setTime('2026-11-02', '00:30');
    h.store.getState().refresh(); // 2 slips, not yet shown
    const missed = h.store.getState().nextNotice()!;
    h.store.getState().answer('not-today'); // one more
    const answered = h.store.getState().nextNotice()!;
    expect(answered).toEqual({ source: 'answer', notice: { kind: 'slipping', cause: 'answer', lost: 1, streak: 7, days: 1, stopped: false } });

    h.store.getState().noticeShown(missed);
    expect(h.store.getState().nextNotice()?.notice).toBe(answered.notice); // still waiting its turn
    h.store.setState({ notice: { kind: 'noted' } }); // a newer answer's notice
    h.store.getState().noticeShown(answered);
    expect(h.store.getState().notice).toEqual({ kind: 'noted' });
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
    expect(h.store.getState().answer('not-today')).toMatchObject({ ok: true, outcome: { kind: 'slipped' } });
    expect(h.store.getState().notice).toEqual({ kind: 'slipping', cause: 'answer', lost: 1, streak: 9, days: 1, stopped: false });

    h.store.getState().noticeShown(h.store.getState().nextNotice()!);
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
      stopped: false,
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

describe('answering a given day', () => {
  it('answers the open window when its day is named', async () => {
    const h = await withGoal(yesDays(newGoal(), DAY0, 2)); // through 10-14
    h.setTime('2026-10-15', '20:05');
    expect(h.store.getState().answer('yes', '2026-10-15')).toMatchObject({
      ok: true,
      outcome: { kind: 'yes', day: '2026-10-15', streak: 3 },
    });
    expect(h.store.getState().round).toMatchObject({ day: '2026-10-15', n: 3, played: false });
  });

  it("answers yesterday's window from the morning reminder", async () => {
    const h = await withGoal(yesDays(newGoal(), DAY0, 2)); // through 10-14
    h.setTime('2026-10-16', '09:00'); // 10-15 stays open until midnight tonight
    expect(h.store.getState().answer('not-today', '2026-10-15')).toMatchObject({
      ok: true,
      outcome: { kind: 'slipped', day: '2026-10-15' },
    });
    expect(h.store.getState().goal?.lastSettledDay).toBe('2026-10-15');
    expect(h.store.getState().notice).toMatchObject({ kind: 'slipping', cause: 'answer' });
  });

  it("turns down a day that closed, was answered, or hasn't opened", async () => {
    const h = await withGoal(yesDays(newGoal(), DAY0, 2)); // through 10-14
    h.setTime('2026-10-17', '00:30'); // 10-15 closed unanswered at midnight
    expect(h.store.getState().answer('yes', '2026-10-15')).toMatchObject({ ok: false, reason: 'expired' });
    expect(h.store.getState().goal?.lastSettledDay).toBe('2026-10-15'); // caught up all the same
    expect(h.store.getState().answer('yes', '2026-10-14')).toMatchObject({ ok: false, reason: 'already-answered' });
    expect(h.store.getState().answer('not-today', '2026-10-17')).toMatchObject({ ok: false, reason: 'not-open' });
    expect(h.store.getState().round).toBeNull();

    expect(h.store.getState().answer('yes', '2026-10-16')).toMatchObject({ ok: true });
    expect(h.store.getState().answer('yes', '2026-10-16')).toMatchObject({ ok: false, reason: 'already-answered' });
    expect(h.store.getState().round).toMatchObject({ day: '2026-10-16', n: 3 });
  });
});

describe('where an answer leads', () => {
  it('leaves Home the round or the notice to open, in the same update as the answer', async () => {
    const h = await withGoal(yesDays(newGoal(), DAY0, 2)); // through 10-14
    const seen: { settled: string | null | undefined; route: string | null }[] = [];
    const stop = h.store.subscribe((s, prev) => {
      if (s.goal?.lastSettledDay !== prev.goal?.lastSettledDay) seen.push({ settled: s.goal?.lastSettledDay, route: s.route });
    });

    h.setTime('2026-10-15', '21:00');
    h.store.getState().answer('yes');
    expect(seen).toEqual([{ settled: '2026-10-15', route: '/play' }]);
    expect(h.store.getState().takeRoute()).toBe('/play');
    expect(h.store.getState().takeRoute()).toBeNull();

    h.setTime('2026-10-16', '21:00');
    h.store.getState().answer('not-today');
    expect(seen.at(-1)).toEqual({ settled: '2026-10-16', route: '/notice' });
    expect(h.store.getState().takeRoute()).toBe('/notice');
    stop();
  });

  it("leaves a notification's Yes on Home: the round waits, nothing opens", async () => {
    const h = await withGoal(yesDays(newGoal(), DAY0, 2)); // through 10-14
    h.setTime('2026-10-15', '21:00');
    expect(h.store.getState().answer('yes', '2026-10-15', 'notification')).toMatchObject({ ok: true });
    expect(h.store.getState()).toMatchObject({ route: null, round: { day: '2026-10-15', n: 3, played: false } });

    h.setTime('2026-10-16', '21:00');
    h.store.getState().answer('not-today', '2026-10-16', 'notification');
    expect(h.store.getState().route).toBe('/notice'); // Not today still shows its notice
  });

  it("records why an answer was turned down for Home's banner, and keeps a route still waiting", async () => {
    const h = await withGoal(yesDays(newGoal(), DAY0, 2)); // through 10-14
    h.setTime('2026-10-15', '21:00');
    h.store.getState().answer('yes'); // its round hasn't been opened yet
    h.store.getState().answer('yes', '2026-10-15');
    expect(h.store.getState()).toMatchObject({ rejection: 'already-answered', route: '/play' });

    h.store.getState().clearRejection();
    expect(h.store.getState().rejection).toBeNull();

    h.setTime('2026-10-18', '00:30'); // 10-16 closed unanswered at midnight
    h.store.getState().answer('not-today', '2026-10-16');
    expect(h.store.getState().rejection).toBe('expired');
    h.store.getState().answer('not-today');
    expect(h.store.getState()).toMatchObject({ rejection: null, route: '/notice' });
  });

  it('starts clean after erase and after setup', async () => {
    const h = await withGoal(yesDays(newGoal(), DAY0, 2));
    h.store.setState({ route: '/play', rejection: 'expired' });
    h.store.getState().erase();
    expect(h.store.getState()).toMatchObject({ route: null, rejection: null });
    h.store.setState({ route: '/notice', rejection: 'not-open' });
    h.store.getState().setupGoal({ goal: 'Read', checkInTime: '20:00', morningTime: '09:00' });
    expect(h.store.getState()).toMatchObject({ route: null, rejection: null });
  });
});

describe('undo Not today', () => {
  it('puts back the goal and the round it dropped, so the check-in can be answered again', async () => {
    const h = await withGoal(yesDays(newGoal(), DAY0, 4)); // through 10-16
    h.setTime('2026-10-17', '21:00');
    h.store.getState().answer('yes'); // streak 5, its round unplayed
    const round = h.store.getState().round;
    const before = h.store.getState().goal;

    h.setTime('2026-10-18', '21:00');
    h.store.getState().answer('not-today');
    expect(h.store.getState()).toMatchObject({ round: null, route: '/notice', goal: { streak: 4 } });
    expect(h.store.getState().undo).toMatchObject({ day: '2026-10-18', at: h.clock.t });
    expect(h.store.getState().undo?.notice).toBe(h.store.getState().nextNotice()?.notice);

    h.clock.t += UNDO_MS - 1;
    expect(h.store.getState().undoNotToday()).toBe(true);
    expect(h.store.getState()).toMatchObject({ goal: before, round, notice: null, route: null, undo: null });
    expect(pendingWindow(h.store.getState().goal!, h.store.getState().now())?.day).toBe('2026-10-18');
    expect(h.store.getState().undoNotToday()).toBe(false); // once

    expect(h.store.getState().answer('yes')).toMatchObject({ ok: true, outcome: { day: '2026-10-18', streak: 6 } });
  });

  it('gives back a shield a Shielded answer spent, and a streak a Reset took', async () => {
    const shielded = await withGoal({ ...yesDays(newGoal(), DAY0, 10), slide: 6, shields: 1 }); // through 10-22
    shielded.setTime('2026-10-23', '21:00');
    expect(shielded.store.getState().answer('not-today')).toMatchObject({ outcome: { kind: 'shielded' } });
    expect(shielded.store.getState().undoNotToday()).toBe(true);
    expect(shielded.store.getState().goal).toMatchObject({ streak: 10, shields: 1, slide: 6 });

    const reset = await withGoal({ ...yesDays(newGoal(), DAY0, 10), slide: 6, shields: 0 });
    reset.setTime('2026-10-23', '21:00');
    expect(reset.store.getState().answer('not-today')).toMatchObject({ outcome: { kind: 'reset' } });
    expect(reset.store.getState().undoNotToday()).toBe(true);
    expect(reset.store.getState().goal).toMatchObject({ streak: 10, slide: 6, lastSettledDay: '2026-10-22' });
  });

  it("works for a Not today that cost nothing, and for one from a notification's button", async () => {
    const noted = await withGoal(newGoal());
    noted.setTime(DAY0, '21:00');
    noted.store.getState().answer('not-today');
    expect(noted.store.getState().notice).toEqual({ kind: 'noted' });
    expect(noted.store.getState().undoNotToday()).toBe(true);
    expect(noted.store.getState().goal?.history).toEqual([]);

    const h = await withGoal(yesDays(newGoal(), DAY0, 2)); // through 10-14
    h.setTime('2026-10-16', '09:00'); // the morning reminder for 10-15
    h.store.getState().answer('not-today', '2026-10-15', 'notification');
    expect(h.store.getState().undoNotToday()).toBe(true);
    expect(pendingWindow(h.store.getState().goal!, h.store.getState().now())?.day).toBe('2026-10-15');
  });

  it('lasts UNDO_MS, or the longer window passed in for a screen reader', async () => {
    const h = await withGoal(yesDays(newGoal(), DAY0, 2));
    h.setTime('2026-10-15', '21:00');
    h.store.getState().answer('not-today');
    h.clock.t += UNDO_MS;
    expect(h.store.getState().undoNotToday()).toBe(false);
    expect(h.store.getState().undo).toBeNull(); // the Notice screen drops its button
    expect(h.store.getState().goal?.lastSettledDay).toBe('2026-10-15');

    const s = await withGoal(yesDays(newGoal(), DAY0, 2));
    s.setTime('2026-10-15', '21:00');
    s.store.getState().answer('not-today');
    s.clock.t += UNDO_MS_SCREEN_READER - 1;
    expect(s.store.getState().undoNotToday(UNDO_MS_SCREEN_READER)).toBe(true);
  });

  it('is turned down once the check-in has closed', async () => {
    const h = await withGoal(yesDays(newGoal(), DAY0, 2)); // through 10-14
    h.clock.t = at('2026-10-17', '00:00').getTime() - 2000; // 10-15 closes at midnight
    h.store.getState().answer('not-today', '2026-10-15');
    h.clock.t += 3000;
    expect(h.store.getState().undoNotToday()).toBe(false);
    expect(h.store.getState().goal?.history.at(-1)).toMatchObject({ day: '2026-10-15', result: 'no' });
  });

  it('is turned down once another day has settled, but not by a time zone change', async () => {
    const h = await withGoal(yesDays(newGoal(), DAY0, 2)); // through 10-14
    h.setTime('2026-10-16', '21:00'); // 10-15 and 10-16 both open
    h.store.getState().answer('not-today', '2026-10-15');
    h.store.setState({ goal: answerDay(h.store.getState().goal!, '2026-10-16', 'yes').state });
    expect(h.store.getState().undoNotToday()).toBe(false);

    const t = await withGoal(yesDays(newGoal(), DAY0, 2));
    t.setTime('2026-10-15', '21:00');
    t.store.getState().answer('not-today');
    t.zone.tz = TOKYO;
    t.store.getState().refresh(); // a new goal object, with nothing new settled
    expect(t.store.getState().undoNotToday()).toBe(true);
    expect(latestScheduleEntry(t.store.getState().goal!).tz).toBe(TOKYO);
  });

  it('ends with any other answer, erase or setup', async () => {
    const h = await withGoal(yesDays(newGoal(), DAY0, 2));
    h.setTime('2026-10-15', '21:00');
    h.store.getState().answer('not-today');
    h.store.getState().answer('yes', '2026-10-15'); // turned down: already answered
    expect(h.store.getState().undo).toBeNull();

    h.setTime('2026-10-16', '21:00');
    h.store.getState().answer('not-today');
    h.store.getState().erase();
    expect(h.store.getState().undo).toBeNull();
    expect(h.store.getState().undoNotToday()).toBe(false);

    const s = await withGoal(yesDays(newGoal(), DAY0, 2));
    s.setTime('2026-10-15', '21:00');
    s.store.getState().answer('not-today');
    s.store.getState().setupGoal({ goal: 'Read', checkInTime: '20:00', morningTime: '09:00' });
    expect(s.store.getState().undo).toBeNull();

    const y = await withGoal(yesDays(newGoal(), DAY0, 2));
    y.setTime('2026-10-15', '21:00');
    y.store.getState().answer('yes');
    expect(y.store.getState().undo).toBeNull();
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
    a.store.getState().setPref('goalInReminders', true);
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
    expect(b.store.getState().prefs).toEqual({ sound: false, haptics: true, reengage: false, goalInReminders: true });
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
    expect(store.getState().prefs).toEqual({ sound: false, haptics: true, reengage: true, goalInReminders: false });
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
    expect(h.store.getState().clockOffsetMs()).toBe(9 * MS_PER_DAY);
    expect(h.store.getState().goal?.consecutiveMissed).toBe(7);
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
    const r = h.store.getState().devJumpToDay(30);
    expect(r?.ok).toBe(true);
    const s = h.store.getState();
    expect(s.goal).toMatchObject({ goalId: 'g1', streak: 30, bestStreak: 30, bombs: 6, shields: 3 });
    expect(s.goal?.history.every((e) => e.result === 'yes')).toBe(true);
    expect(s.round).toMatchObject({ day: addDays(DAY0, -1), n: 30, played: false, rewards: { bomb: true, weapons: ['chain'] } });
    expect(s.weapon).toBe('chain');
    expect(s.notice).toBeNull();
    expect(s.nextNotice()).toBeNull();
  });

  it('does nothing without the development tools, as in a production build', async () => {
    const h = await withGoal(yesDays(newGoal(), DAY0, 2), { dev: false });
    expect(h.store.getState().devJumpToDay(30)).toBeNull();

    const noTools = createAppStore({ storage: AsyncStorage, now: () => new Date(h.clock.t), timeZone: () => DENVER, makeId: () => 'x', dev: true });
    await ready(noTools);
    noTools.setState({ goal: yesDays(newGoal(), DAY0, 2) });
    expect(noTools.getState().devJumpToDay(30)).toBeNull();
    expect(noTools.getState().goal?.streak).toBe(2);
  });

  it('turns down run lengths it cannot build', async () => {
    const h = await withGoal(yesDays(newGoal(), DAY0, 2));
    const before = h.store.getState().goal;
    for (const n of [0, 2.5, 100_000]) expect(h.store.getState().devJumpToDay(n)).toBeNull();
    expect(h.store.getState().goal).toBe(before);
  });

  it('is ignored outside development', async () => {
    const h = await withGoal(yesDays(newGoal(), DAY0, 2), { dev: false });
    const before = h.store.getState().goal;
    expect(h.store.getState().devJumpToDay(30)).toBeNull();
    expect(h.store.getState().goal).toBe(before);
    expect(h.store.getState().round).toBeNull();
  });
});

describe('debug skip to next check-in', () => {
  it('moves the clock to just after the next window opens', async () => {
    const h = await withGoal(yesDays(newGoal(), DAY0, 1)); // answered 10-13; clock at 10-13 12:00
    h.store.getState().devSkipToNextCheckIn();
    const s = h.store.getState();
    expect(s.now().getTime()).toBe(at(addDays(DAY0, 1), '20:00').getTime() + 1000);
    expect(pendingWindow(s.goal!, s.now())?.day).toBe(addDays(DAY0, 1));
    expect(s.goal?.history).toHaveLength(1); // nothing was missed on the way
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
