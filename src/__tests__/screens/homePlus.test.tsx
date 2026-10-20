// Win Zero Plus's Home (SPEC 9): with one goal, Win Zero's Home; with several, ready rounds, then
// open check-ins, then the rest, a goal picker for the numbers and history, and the shared arsenal
// and credits.
import './env/plus';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { afterEach, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Stack } from 'expo-router';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { AccessibilityInfo } from 'react-native';

import HomeScreen from '@/app/index';
import { addDays, resolve, type GoalState } from '@/engine';
import { at, DAY0, newGoal, yesDays } from '@/engine/__tests__/fixtures';
import { SECRET_TAP_GAP_MS } from '@/plus/home/secretTaps';
import { appStore, slotById, type GoalSlot, type RoundRecord } from '@/store';
import { DEFAULT_PERSISTED } from '@/store/migrate';

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
  play: () => null,
  notice: () => null,
  settings: () => null,
  setup: () => null,
};

const tz = () => appStore.getState().timeZone();
const slot = (goal: GoalState): GoalSlot => ({ goal, round: null, seenThrough: goal.lastSettledDay });

/** Open Home with `goals` saved, at 10-15 21:00 on the phone's clock unless told otherwise. */
async function open(goals: GoalSlot[], opts: { day?: string; time?: string } = {}) {
  jest.useFakeTimers();
  jest.setSystemTime(at(opts.day ?? '2026-10-15', opts.time ?? '21:00', tz()));
  appStore.setState({ goals });
  const app = renderRouter(ROUTES, { initialUrl: '/' });
  await app;
  return { pathname: () => app.getPathname() };
}

/** Answered Yes on 10-13 and 10-14, so 10-15's check-in is open at 21:00 on 10-15. */
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

describe("Home's secret (SPEC 9)", () => {
  const tapCount = (label: string) => fireEvent.press(screen.getByLabelText(label));

  it('gives a free Game credit for three quick taps on the Game credits count, with a popup', async () => {
    appStore.setState({ credits: { balance: { game: 1, weapon: 0 }, claimed: ['goal-set'] } });
    await open([slot(twoDays())]);
    for (let i = 0; i < 3; i++) await tapCount('1 Game credit');
    expect(screen.getByRole('header', { name: /Free Game credit!/ })).toBeOnTheScreen();
    expect(screen.getByText('You found the secret stash.')).toBeOnTheScreen();
    expect(screen.getByText(/^You now have 2 Game credits\./)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Sweet!' }));
    expect(screen.queryByText('You found the secret stash.')).not.toBeOnTheScreen();
    expect(screen.getByLabelText('2 Game credits')).toBeOnTheScreen();
    expect(appStore.getState().credits).toEqual({ balance: { game: 2, weapon: 0 }, claimed: ['goal-set'] });

    // As often as it's found.
    for (let i = 0; i < 3; i++) await tapCount('2 Game credits');
    expect(appStore.getState().credits.balance.game).toBe(3);
  });

  it('needs the taps quick, and leaves the hint on the "i"', async () => {
    await open([slot(twoDays())]);
    for (let i = 0; i < 3; i++) {
      await tapCount('0 Game credits');
      jest.advanceTimersByTime(SECRET_TAP_GAP_MS + 1);
    }
    expect(appStore.getState().credits.balance.game).toBe(0);
    expect(screen.queryByText('You found the secret stash.')).not.toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'About Game credits' }));
    expect(screen.getByRole('header', { name: 'Game credits' })).toBeOnTheScreen();
  });
});

describe('the shared arsenal on Home', () => {
  it('reaches as far as the best streak any goal reached, archived ones too', async () => {
    const old = { ...yesDays(newGoal({ tz: tz() }), DAY0, 2, tz()), goalId: 'old', bestStreak: 30 };
    appStore.setState({ archived: [{ goal: old, archivedAt: at(DAY0, '12:00', tz()).toISOString() }], arsenalBest: 30 });
    await open([slot(twoDays())]);
    expect(screen.getByLabelText(/^Chain Zapper\. .* Equipped\.$/)).toBeOnTheScreen();
    // The next one counts from the goal's streak, 2.
    expect(screen.getByLabelText(/^Rail Laser\. .* Unlocks in 58 days\.$/)).toBeOnTheScreen();
  });
});

/** A goal of its own, answered Yes on the `yes` days up to 10-14, so 10-15's check-in is next. */
const another = (goalId: string, goal: string, yes: number, opts: { checkInTime?: string; days?: number[] } = {}) => {
  const from = addDays('2026-10-15', -yes);
  return { ...yesDays(newGoal({ tz: tz(), day: from, ...opts }), from, yes, tz()), goalId, goal };
};
const readyRound = (day: string, n: number): RoundRecord => ({
  day,
  n,
  rewards: { bomb: false, shield: false, shieldCapped: false, weapons: [], credits: [] },
  borrowed: [],
  played: false,
});
/** The cards' headlines, top to bottom. */
const headlines = () => screen.getAllByText(/round is ready\.$|^Did you stick to|^You're all caught up\.$|^Up next$/).map((t) => {
  const kids = ([] as unknown[]).concat(t.props.children);
  return kids.join('');
});

describe('Home with one goal in Win Zero Plus', () => {
  it('names the arsenal by the game picked', async () => {
    appStore.setState({ gameMode: 'catch' });
    await open([slot(twoDays())]);
    // Best streak 2: the Pea Shooter's tier, with the Twin Barrel's next.
    expect(screen.getByLabelText('Cup. Equipped.')).toBeOnTheScreen();
    expect(screen.getByLabelText('Next catcher: Twin Cups')).toBeOnTheScreen();
    expect(screen.queryByText('Twin Barrel')).not.toBeOnTheScreen();
  });

  it("is Win Zero's Home: no goal picker, and no list of goals", async () => {
    await open([slot(twoDays())]);
    expect(screen.getByRole('header', { name: 'Daily goal' })).toBeOnTheScreen();
    expect(screen.getByText('Did you stick to “Stop drinking” today?')).toBeOnTheScreen();
    expect(screen.queryByRole('header', { name: 'Your goals' })).not.toBeOnTheScreen();
    expect(screen.queryByRole('radio')).not.toBeOnTheScreen();
    expect(screen.queryByText(/caught up|Up next/)).not.toBeOnTheScreen();
  });

  it('names the days of a goal that skips some, and asks about reminders without "each day"', async () => {
    mockPermission.value = 'undetermined';
    await open([slot({ ...newGoal({ tz: tz(), days: [1, 3, 5] }) })]);
    expect(screen.getByRole('header', { name: 'Goal · Mon, Wed, Fri' })).toBeOnTheScreen();
    expect(await screen.findByText('Win Zero Plus asks at each check-in time. A reminder makes sure it finds you.')).toBeOnTheScreen();
  });
});

describe('Home with several goals', () => {
  /** Stop drinking: open since 20:00, with yesterday's round unplayed. Run: open since 19:00. */
  const two = (): GoalSlot[] => [
    { goal: twoDays(), round: readyRound('2026-10-14', 2), seenThrough: '2026-10-14' },
    slot(another('g2', 'Run', 5, { checkInTime: '19:00' })),
  ];

  it('shows ready rounds first, then open check-ins, the one that opened first, first', async () => {
    await open(two());
    expect(headlines()).toEqual([
      'Your Day 2 round is ready.',
      'Did you stick to “Run” today?',
      'Did you stick to “Stop drinking” today?',
    ]);
    expect(screen.getByRole('button', { name: 'Play now' }).props.accessibilityHint).toBe(
      'Plays your Day 2 round for “Stop drinking”',
    );
  });

  it('answers each check-in for its own goal', async () => {
    const app = await open(two());
    const [run] = screen.getAllByRole('button', { name: 'Yes, I did' });
    await fireEvent.press(run!);
    expect(app.pathname()).toBe('/play');
    expect(slotById(appStore.getState(), 'g2')?.round).toMatchObject({ n: 6, played: false });
    expect(slotById(appStore.getState(), 'g1')?.goal.streak).toBe(2);
  });

  it("switches the numbers and history between goals, the first goal's to begin with", async () => {
    await open(two());
    expect(screen.getByRole('header', { name: 'Your goals' })).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: 'Stop drinking' }).props.accessibilityState).toMatchObject({ checked: true });
    expect(screen.getByLabelText('Current streak: 2 zeros')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('radio', { name: 'Run' }));
    expect(screen.getByRole('radio', { name: 'Run' }).props.accessibilityState).toMatchObject({ checked: true });
    expect(screen.getByLabelText('Current streak: 5 zeros')).toBeOnTheScreen();
    expect(screen.getByLabelText('Oct 15, today: Waiting for your answer')).toBeOnTheScreen();
  });

  it('says which goals have paused reminders', async () => {
    const later = at('2026-11-30', '12:00', tz());
    const read = { ...another('g3', 'Read', 2) };
    const paused = resolve(read, later, tz()).state;
    expect(paused.paused).toBe(true);
    await open([slot(resolve(twoDays(), later, tz()).state), slot(paused)], { day: '2026-11-30', time: '12:00' });
    expect(screen.getByText(/^Reminders for “Read” are paused after a long break\./)).toBeOnTheScreen();
    expect(screen.getByText(/^Reminders for “Stop drinking” are paused/)).toBeOnTheScreen();
  });

  it('names the goal an answer from a notification was turned down for', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    appStore.setState({ rejection: { reason: 'not-open', goalId: 'g2' } });
    await open(two());
    expect(screen.getByText("That check-in isn't open yet.")).toBeOnTheScreen();
    expect(announce).toHaveBeenCalledWith("Run: That check-in isn't open yet.");
  });

  it('with nothing open, says when each goal checks in next', async () => {
    const three = [slot(twoDays()), slot(another('g2', 'Run', 2, { checkInTime: '19:00' })), slot(another('g3', 'Read', 2))];
    await open(three, { time: '12:00' });
    expect(headlines()).toEqual(["You're all caught up."]);
    // The test phone keeps a 24-hour clock.
    for (const line of ['Stop drinking: today at 20:00', 'Run: today at 19:00', 'Read: today at 20:00']) {
      expect(screen.getByText(line)).toBeOnTheScreen();
    }
    expect(screen.queryByRole('button', { name: 'Yes, I did' })).not.toBeOnTheScreen();
  });
});
