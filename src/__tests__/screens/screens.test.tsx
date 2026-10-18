// Every screen, rendered in an in-memory router against the real store: the flows people use
// (set up, check in, Not today and Undo, reminders off, Settings → How it works) and the copy
// that has to be there. The Play canvas (Skia, gestures) isn't rendered here. Kept outside
// src/app, where expo-router would load test files as routes.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { afterEach, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Stack } from 'expo-router';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { Linking } from 'react-native';

import HowItWorksScreen from '@/app/how-it-works';
import HomeScreen from '@/app/index';
import NoticeScreen from '@/app/notice';
import SettingsScreen from '@/app/settings';
import SetupScreen from '@/app/setup';
import type { GoalState } from '@/engine';
import { at, DAY0, newGoal, yesDays } from '@/engine/__tests__/fixtures';
import { appStore, primaryGoal } from '@/store';
import { DEFAULT_PERSISTED } from '@/store/migrate';
import { APP_LINKS, SUPPORT_LINE } from '@/ui/support';

// Reanimated 4's mock needs the worklets runtime mocked first.
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
/** The notification permission the OS reports, set per test. */
const mockPermission: { value: 'granted' | 'denied' | 'undetermined' } = { value: 'granted' };
jest.mock('@/notifications/permissions', () => ({
  getReminderPermission: jest.fn(async () => mockPermission.value),
  requestReminderPermission: jest.fn(async () => mockPermission.value),
  ensureReminderChannel: jest.fn(async () => {}),
}));
jest.mock('@/notifications', () => ({ requestSync: jest.fn(async () => {}), onSynced: () => () => {} }));
jest.mock('@/dev/DebugSection', () => ({ DebugSection: () => null, DemoControls: () => null }));

const ROUTES = {
  _layout: () => <Stack screenOptions={{ headerShown: false }} />,
  index: HomeScreen,
  // The round itself (Skia) has its own tests; here it only needs somewhere to land.
  play: () => null,
  setup: SetupScreen,
  settings: SettingsScreen,
  notice: NoticeScreen,
  'how-it-works': HowItWorksScreen,
};

const tz = () => appStore.getState().timeZone();

/** Open the app at `path` with `goal` saved, at `day` `time` on the phone's clock. */
async function open(path: string, opts: { goal?: GoalState; day?: string; time?: string } = {}) {
  jest.useFakeTimers();
  jest.setSystemTime(at(opts.day ?? '2026-10-15', opts.time ?? '21:00', tz()));
  if (opts.goal) appStore.setState({ goals: [{ goal: opts.goal, round: null, seenThrough: null }] });
  const app = renderRouter(ROUTES, { initialUrl: path });
  await app;
  // Not `app` itself: render's result is awaitable, and returning it would unwrap it.
  return { pathname: () => app.getPathname() };
}

/** Answered Yes through 10-14, so 10-15's check-in is open at 21:00 on 10-15. */
const twoDays = () => yesDays(newGoal({ tz: tz() }), DAY0, 2, tz());

beforeAll(async () => {
  for (let i = 0; i < 50 && !appStore.getState().hydrated; i++) await new Promise((r) => setTimeout(r, 0));
});

beforeEach(async () => {
  mockPermission.value = 'granted';
  await AsyncStorage.clear();
  appStore.setState({ ...DEFAULT_PERSISTED, notices: {}, route: null, rejection: null, undo: null });
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe('Setup', () => {
  it('shows the rules, then the reminders step, then Home', async () => {
    const app = await open('/');
    expect(app.pathname()).toBe('/setup');
    expect(screen.getByText(/Not today costs one zero/)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Start my streak' })).toBeDisabled();

    await fireEvent.changeText(screen.getByLabelText('Your daily goal'), 'Read 20 minutes');
    await fireEvent.press(screen.getByRole('button', { name: 'Start my streak' }));
    expect(screen.getByRole('button', { name: 'Turn on reminders' })).toBeOnTheScreen();
    // 21:00, past the 20:00 check-in: the first question is about today, straight away.
    expect(screen.getByText(/It's already past .+, so today counts/)).toBeOnTheScreen();
    expect(screen.getByText(/Once more at .+ the next day if you haven't answered yet/)).toBeOnTheScreen();

    await fireEvent.press(screen.getByText('Not now'));
    expect(app.pathname()).toBe('/');
    expect(primaryGoal(appStore.getState())?.goal).toBe('Read 20 minutes');
    expect(await screen.findByText('Read 20 minutes')).toBeOnTheScreen();
    expect(screen.getByText('Today counts: your first check-in is open now.')).toBeOnTheScreen();
    expect(screen.getByText('Did you stick to “Read 20 minutes” today?')).toBeOnTheScreen();
  });

  it('before check-in time, says when the first check-in comes instead', async () => {
    await open('/', { time: '12:00' });
    await fireEvent.changeText(screen.getByLabelText('Your daily goal'), 'Exercise more');
    await fireEvent.press(screen.getByRole('button', { name: 'Start my streak' }));
    expect(screen.queryByText(/so today counts/)).not.toBeOnTheScreen();

    await fireEvent.press(screen.getByText('Not now'));
    expect(await screen.findByText("You're all set.")).toBeOnTheScreen();
    expect(screen.queryByText(/Today counts/)).not.toBeOnTheScreen();
  });
});

describe('Credits on Home', () => {
  const wallet = (game: number, weapon: number, claimed: string[] = []) => ({ balance: { game, weapon }, claimed });

  it('shows none yet, and how to earn them', async () => {
    await open('/', { goal: twoDays() });
    expect(screen.getByLabelText('0 Game credits')).toBeOnTheScreen();
    expect(screen.getByLabelText('0 Weapon credits')).toBeOnTheScreen();
    expect(screen.getByText('You earn a Game credit for setting your goal and for reaching 2 zeros.')).toBeOnTheScreen();
    expect(screen.getByText(/^You earn a Weapon credit for checking in again after a missed day, for 3 Yeses in a row/)).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Play a bonus round' })).not.toBeOnTheScreen();
  });

  it("doesn't offer credits already earned", async () => {
    appStore.setState({ credits: wallet(0, 0, ['goal-set', 'zeros-2']) });
    await open('/', { goal: twoDays() });
    expect(screen.queryByText(/You earn a Game credit/)).not.toBeOnTheScreen();
  });

  it('spends a Game credit on a bonus round of the size chosen, and opens it', async () => {
    appStore.setState({ credits: wallet(1, 0) });
    const app = await open('/', { goal: twoDays() });
    expect(screen.getByLabelText('1 Game credit')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Play a bonus round' }));
    await fireEvent.press(screen.getByRole('button', { name: '1,000' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Start' }));
    expect(app.pathname()).toBe('/play');
    expect(appStore.getState().bonus).toEqual({ n: 1000, borrowed: [], played: false });
    expect(appStore.getState().credits.balance.game).toBe(0);
  });

  it('takes a typed size, turns one down out of range, and keeps the credit on Cancel', async () => {
    appStore.setState({ credits: wallet(1, 0) });
    await open('/', { goal: twoDays() });
    await fireEvent.press(screen.getByRole('button', { name: 'Play a bonus round' }));
    await fireEvent.changeText(screen.getByLabelText('Zeros'), '0');
    expect(screen.getByText('A whole number from 1 to 100,000, please.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Start' })).toBeDisabled();
    await fireEvent.changeText(screen.getByLabelText('Zeros'), '4321');
    expect(screen.getByRole('button', { name: 'Start' })).toBeEnabled();
    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
    expect(appStore.getState().bonus).toBeNull();
    expect(appStore.getState().credits.balance.game).toBe(1);
  });

  it('offers the bonus round already paid for', async () => {
    appStore.setState({ bonus: { n: 250, borrowed: [], played: false } });
    const app = await open('/', { goal: twoDays() });
    expect(screen.getByText('Your bonus round of 250 zeros is ready.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Play bonus round' }));
    expect(app.pathname()).toBe('/play');
  });

  it('says when a Weapon credit comes up', async () => {
    appStore.setState({ credits: wallet(0, 1) });
    await open('/', { goal: twoDays() });
    expect(screen.getByText("You'll be asked before your next round whether to use one.")).toBeOnTheScreen();
  });

  it('keeps Weapon credits for new weapons once every one is unlocked', async () => {
    appStore.setState({ credits: wallet(0, 2) });
    await open('/', { goal: { ...twoDays(), bestStreak: 100 } });
    expect(screen.getByText('Every weapon is unlocked, so your Weapon credits wait here for new ones.')).toBeOnTheScreen();
  });
});

describe('Home', () => {
  it('asks about the open check-in', async () => {
    await open('/', { goal: twoDays() });
    expect(screen.getByText('Did you stick to “Stop drinking” today?')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Yes, I did' })).toBeOnTheScreen();
  });

  it('shows Yes days, this month, and the dates of the best run', async () => {
    await open('/', { goal: twoDays() }); // Yes on 10-13 and 10-14
    expect(screen.getByLabelText('Best run: 2 days, Oct 13 to Oct 14')).toBeOnTheScreen();
    expect(screen.getByText('Oct 13 – Oct 14')).toBeOnTheScreen();
    expect(screen.getByLabelText('Yes days: 2')).toBeOnTheScreen();
    expect(screen.getByLabelText('Yes days this month: 2')).toBeOnTheScreen();
  });

  it('takes Not today to its notice, and Undo back to the open check-in', async () => {
    const app = await open('/', { goal: twoDays() });
    await fireEvent.press(screen.getByRole('button', { name: 'Not today' }));
    expect(await screen.findByRole('button', { name: 'Undo Not today' })).toBeOnTheScreen();
    expect(app.pathname()).toBe('/notice');
    expect(primaryGoal(appStore.getState())?.streak).toBe(1);

    await fireEvent.press(screen.getByRole('button', { name: 'Undo Not today' }));
    expect(app.pathname()).toBe('/');
    expect(primaryGoal(appStore.getState())?.streak).toBe(2);
    expect(await screen.findByRole('button', { name: 'Not today' })).toBeOnTheScreen();
  });

  it('shows the reminders card while reminders are off, until Not now', async () => {
    mockPermission.value = 'undetermined';
    await open('/', { goal: twoDays() });
    expect(await screen.findByText('Reminders are off.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Turn on reminders' })).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Not now' }));
    expect(screen.queryByText('Reminders are off.')).not.toBeOnTheScreen();
    expect(appStore.getState().reminderCardHiddenUntil).not.toBeNull();
  });

  it('points to system settings when reminders were turned off there', async () => {
    mockPermission.value = 'denied';
    await open('/', { goal: twoDays() });
    expect(await screen.findByRole('button', { name: 'Open settings' })).toBeOnTheScreen();
  });

  it('shows no reminders card while reminders are on', async () => {
    await open('/', { goal: twoDays() });
    expect(screen.queryByText('Reminders are off.')).not.toBeOnTheScreen();
  });
});

describe('Notice', () => {
  it('offers the helpline when zeros slip, after a Not today or missed days', async () => {
    appStore.setState({ notices: { g1: { kind: 'slipping', cause: 'answer', lost: 1, streak: 1, days: 1, stopped: false } } });
    await open('/notice', { goal: twoDays() });
    expect(screen.getByText(/You've lost/)).toBeOnTheScreen();
    expect(screen.getByText(`Need support? ${SUPPORT_LINE.name}, ${SUPPORT_LINE.display}`)).toBeOnTheScreen();
  });

  it('leaves the helpline off a Not today that cost nothing', async () => {
    appStore.setState({ notices: { g1: { kind: 'noted' } } });
    await open('/notice', { goal: twoDays() });
    expect(screen.getByText(/Thanks for/)).toBeOnTheScreen();
    expect(screen.queryByText(/Need support\?/)).not.toBeOnTheScreen();
  });

  it('offers the helpline after a reset, and calls it', async () => {
    const call = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    appStore.setState({
      notices: { g1: { kind: 'reset', cause: 'answer', lostStreak: 9, bestStreak: 10, days: 1, stopped: false } },
    });
    await open('/notice', { goal: twoDays() });
    expect(screen.getByText(/A fresh start/i)).toBeOnTheScreen();
    await fireEvent.press(screen.getByText(`Need support? ${SUPPORT_LINE.name}, ${SUPPORT_LINE.display}`));
    expect(call).toHaveBeenCalledWith(SUPPORT_LINE.tel);
  });
});

describe('Settings', () => {
  it('has About with the support email, and leaves out pages whose URLs are unset', async () => {
    await open('/settings', { goal: twoDays() });
    expect(screen.getByRole('header', { name: 'About' })).toBeOnTheScreen();
    expect(screen.getByText(APP_LINKS.email)).toBeOnTheScreen();
    expect(screen.getByText(/© 2026 E7 Systems/)).toBeOnTheScreen();
    expect(APP_LINKS.privacy).toBeNull(); // no .env in tests
    expect(screen.queryByText('Privacy policy')).not.toBeOnTheScreen();
  });

  it('opens How it works', async () => {
    const app = await open('/settings', { goal: twoDays() });
    await fireEvent.press(screen.getByText('How it works'));
    expect(app.pathname()).toBe('/how-it-works');
    expect(await screen.findByRole('header', { name: 'The daily question' })).toBeOnTheScreen();
  });
});

describe('How it works', () => {
  it('has a heading for each rule', async () => {
    await open('/how-it-works');
    for (const name of [
      'The daily question',
      'Yes adds a zero',
      'Not today, and the slide',
      'Missed check-ins',
      'Shields, bombs and weapons',
    ]) {
      expect(screen.getByRole('header', { name })).toBeOnTheScreen();
    }
  });
});
