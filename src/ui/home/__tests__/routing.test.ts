// What Home opens, against a real store, the lifecycle, and notification responses: an answer
// and missed-day news arriving in either order are both shown, once each, one screen at a time.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { DAY0, newGoal, yesDays } from '@/engine/__tests__/fixtures';
import { fakeResponses, response } from '@/notifications/__tests__/fakes';
import { startResponses } from '@/notifications/responses';
import { ACTION_NOT_TODAY, ACTION_YES } from '@/notifications/shared';
import { fakeAppState, flush, harness, ready, withGoal } from '@/store/__tests__/harness';
import { startLifecycle } from '@/store/lifecycle';
import type { AppStore } from '@/store/createAppStore';

import { startHomeRouting } from '../routing';

beforeEach(async () => {
  await AsyncStorage.clear();
});

/** The day the user comes back to: 10-23 .. 10-31 went unanswered (7 free, then 2 slips). */
const BACK = '2026-11-01';

/** Home, as screens come and go over it. */
function home(store: AppStore) {
  const pushed: string[] = [];
  let stop: (() => void) | null = null;
  const focus = () => {
    stop = startHomeRouting(store, (path) => pushed.push(path));
  };
  const blur = () => {
    stop?.();
    stop = null;
  };
  return {
    pushed,
    focus,
    blur,
    /** The screen on top closed, and Home has focus again. */
    refocus: () => {
      blur();
      focus();
    },
    /** The Notice screen mounting: what it shows, now marked shown. */
    showNotice: () => {
      const p = store.getState().nextNotice();
      if (p) store.getState().noticeShown(p);
      return p;
    },
  };
}

/** Answered through 10-22, the app open on Home the next day, then sent to the background. */
async function scene() {
  const h = await withGoal(yesDays(newGoal(), DAY0, 10));
  h.setTime('2026-10-23', '12:00');
  const app = fakeAppState();
  const fake = fakeResponses();
  const nav = { toHome: jest.fn() };
  startLifecycle(h.store, app);
  startResponses(h.store, fake.api, nav);
  const screen = home(h.store);
  return {
    ...h,
    ...screen,
    app,
    nav,
    s: () => h.store.getState(),
    /** Nine days pass with the app in the background. */
    away: () => h.setTime(BACK, '20:30'),
    yes: () => fake.tap(response(ACTION_YES, { day: BACK })),
    notToday: () => fake.tap(response(ACTION_NOT_TODAY, { day: BACK })),
  };
}

const missedSlip = { source: 'missed', notice: { kind: 'slipping', cause: 'missed', lost: 2 } };
/** The same news, read after the Yes: the copy says the slide has stopped. */
const stoppedSlip = { source: 'missed', notice: { ...missedSlip.notice, stopped: true } };
const answerSlip = { source: 'answer', notice: { kind: 'slipping', cause: 'answer', lost: 1 } };

describe('Home after a long time in the background', () => {
  it('foreground first, then Yes: the news, then the round, never one over the other', async () => {
    const t = await scene();
    t.focus();
    t.away();
    t.app.emit('active');
    expect(t.pushed).toEqual(['/notice']);

    t.yes(); // lands while the notice is on its way
    expect(t.pushed).toEqual(['/notice']);
    expect(t.s().route).toBe('/play');
    expect(t.s().seenThrough).toBe('2026-10-22'); // nothing shown yet

    expect(t.showNotice()).toMatchObject(stoppedSlip);
    expect(t.s().seenThrough).toBe('2026-11-01');
    t.refocus();
    expect(t.pushed).toEqual(['/notice', '/play']);
    t.refocus();
    expect(t.pushed).toEqual(['/notice', '/play']);
  });

  it('foreground first, the notice showing before the Yes lands', async () => {
    const t = await scene();
    t.focus();
    t.away();
    t.app.emit('active');
    expect(t.showNotice()).toMatchObject({ notice: { ...missedSlip.notice, stopped: false } });
    expect(t.s().seenThrough).toBe('2026-10-31');
    t.yes();
    t.refocus();
    expect(t.pushed).toEqual(['/notice', '/play']);
    t.refocus();
    expect(t.pushed).toHaveLength(2);
  });

  it('Yes first, then foreground: the round, then the news', async () => {
    const t = await scene();
    t.focus();
    t.away();
    t.yes();
    expect(t.pushed).toEqual(['/play']);
    t.app.emit('active');
    expect(t.pushed).toEqual(['/play']);

    t.refocus(); // back from the round
    expect(t.pushed).toEqual(['/play', '/notice']);
    expect(t.showNotice()).toMatchObject(stoppedSlip); // "Your Yes stopped the slide"

    t.refocus();
    expect(t.pushed).toHaveLength(2);
  });

  it('Not today after the news has shown: each notice once, the news first', async () => {
    const t = await scene();
    t.focus();
    t.away();
    t.app.emit('active');
    expect(t.showNotice()).toMatchObject(missedSlip);
    t.notToday();
    expect(t.pushed).toEqual(['/notice']);

    t.refocus();
    expect(t.pushed).toEqual(['/notice', '/notice']);
    expect(t.showNotice()).toMatchObject(answerSlip);
    t.refocus();
    expect(t.pushed).toHaveLength(2);
    expect(t.s().nextNotice()).toBeNull();
  });

  it('Not today before the notice shows: each notice once, the answer first', async () => {
    const t = await scene();
    t.focus();
    t.away();
    t.app.emit('active');
    t.notToday();
    expect(t.showNotice()).toMatchObject(answerSlip);

    t.refocus();
    expect(t.pushed).toEqual(['/notice', '/notice']);
    expect(t.showNotice()).toMatchObject(missedSlip);
    t.refocus();
    expect(t.pushed).toHaveLength(2);
    expect(t.s().nextNotice()).toBeNull();
  });

  it('opens one screen, however many times days settle before Home leaves', async () => {
    const t = await scene();
    t.focus();
    t.setTime('2026-10-31', '20:30');
    t.s().refresh(); // Home's own timer: 7 free, then a slip
    t.setTime(BACK, '20:30');
    t.s().refresh(); // another slip
    t.app.emit('active');
    expect(t.pushed).toEqual(['/notice']);
  });

  it('shows nothing for the free week, and counts those days as seen', async () => {
    const t = await scene();
    t.focus();
    t.setTime('2026-10-28', '20:30');
    t.app.emit('active');
    expect(t.pushed).toEqual([]);
    expect(t.s().seenThrough).toBe('2026-10-27');
  });

  it('from another screen: back to Home, then the round, then the news', async () => {
    const t = await scene();
    t.away();
    t.app.emit('active');
    t.yes();
    expect(t.nav.toHome).toHaveBeenCalledTimes(1);
    t.focus();
    expect(t.pushed).toEqual(['/play']);
    t.refocus();
    expect(t.pushed).toEqual(['/play', '/notice']);
  });

  it('cold start with missed days and a Yes: the round, then the news', async () => {
    const first = harness();
    await ready(first.store);
    first.store.setState({ goal: yesDays(newGoal(), DAY0, 10) }); // through 10-22, saved
    await flush();

    const h = harness();
    h.setTime(BACK, '20:30');
    const fake = fakeResponses();
    fake.launchWith(response(ACTION_YES, { day: BACK }));
    // The root layout starts these before storage is read; Home mounts after.
    startLifecycle(h.store, fakeAppState());
    startResponses(h.store, fake.api, { toHome: jest.fn() });
    await ready(h.store);

    const screen = home(h.store);
    screen.focus();
    expect(screen.pushed).toEqual(['/play']);
    screen.refocus();
    expect(screen.pushed).toEqual(['/play', '/notice']);
    expect(screen.showNotice()).toMatchObject(missedSlip);
  });
});

describe('Home routing', () => {
  it("drops a Not today's route when its notice has already been shown", async () => {
    const t = await scene();
    t.setTime('2026-10-23', '20:30');
    t.s().answer('not-today'); // e.g. from a notification, while another screen was up
    t.showNotice(); // and a Notice screen showed it
    t.focus();
    expect(t.pushed).toEqual([]);
    expect(t.s().route).toBeNull();
  });

  it('clears a turned-down answer when Home loses focus', async () => {
    const t = await scene();
    t.focus();
    t.s().answer('yes', '2026-10-25'); // not open yet
    expect(t.s().rejection).toBe('not-open');
    t.blur();
    expect(t.s().rejection).toBeNull();
  });
});
