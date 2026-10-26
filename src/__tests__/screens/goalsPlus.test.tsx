// Win Zero Plus's goals (SPEC 9): adding one with its check-in days, Setup's days, changing a
// goal's days in Settings, each goal's own screen once there are several, and archiving one to
// Past goals, where it can be deleted for good.
import './env/plus';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { afterEach, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Stack } from 'expo-router';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { AccessibilityInfo } from 'react-native';

import AddGoalScreen from '@/app/add-goal';
import GoalScreen from '@/app/goal';
import PastGoalScreen from '@/app/past-goal';
import PastGoalsScreen from '@/app/past-goals';
import SettingsScreen from '@/app/settings';
import SetupScreen from '@/app/setup';
import { latestScheduleEntry, type GoalState } from '@/engine';
import { at, DAY0, newGoal, yesDays } from '@/engine/__tests__/fixtures';
import { appStore, primaryGoal } from '@/store';
import { DEFAULT_PERSISTED } from '@/store/migrate';

jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
jest.mock('@/notifications/permissions', () => ({
  getReminderPermission: jest.fn(async () => 'granted'),
  requestReminderPermission: jest.fn(async () => 'granted'),
  ensureReminderChannel: jest.fn(async () => {}),
}));
jest.mock('@/notifications', () => ({ requestSync: jest.fn(async () => {}), onSynced: () => () => {} }));
jest.mock('@/dev/DebugSection', () => ({ DebugSection: () => null, DemoControls: () => null }));

const ROUTES = {
  _layout: () => <Stack screenOptions={{ headerShown: false }} />,
  index: () => null,
  play: () => null,
  setup: SetupScreen,
  settings: SettingsScreen,
  'add-goal': AddGoalScreen,
  goal: GoalScreen,
  'past-goals': PastGoalsScreen,
  'past-goal': PastGoalScreen,
};

const tz = () => appStore.getState().timeZone();
const twoDays = () => yesDays(newGoal({ tz: tz() }), DAY0, 2, tz());

/** Open `path` with `goals` saved, at 10-15 (a Thursday) `time` on the phone's clock. */
async function open(path: string, goals: GoalState[] = [twoDays()], time = '21:00') {
  jest.useFakeTimers();
  jest.setSystemTime(at('2026-10-15', time, tz()));
  appStore.setState({ goals: goals.map((goal) => ({ goal, round: null, seenThrough: null })) });
  const app = renderRouter(ROUTES, { initialUrl: path });
  await app;
  return { pathname: () => app.getPathname() };
}

const day = (name: string) => screen.getByRole('checkbox', { name });
/** Turn these days off, from every day on. */
async function untick(...names: string[]) {
  for (const name of names) await fireEvent.press(day(name));
}

beforeAll(async () => {
  for (let i = 0; i < 50 && !appStore.getState().hydrated; i++) await new Promise((r) => setTimeout(r, 0));
});

beforeEach(async () => {
  await AsyncStorage.clear();
  appStore.setState({ ...DEFAULT_PERSISTED, notices: {}, route: null, rejection: null, undo: null });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('adding a goal', () => {
  it('adds one from Settings on the days chosen, then goes back', async () => {
    const app = await open('/settings');
    await fireEvent.press(screen.getByRole('button', { name: /^Add a goal/ }));
    expect(app.pathname()).toBe('/add-goal');
    expect(screen.getByRole('header', { name: 'Add a goal' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Add goal' })).toBeDisabled();

    await fireEvent.changeText(screen.getByLabelText('Your goal'), 'Run');
    expect(screen.getByText('Every day')).toBeOnTheScreen();
    await untick('Tuesday', 'Thursday', 'Saturday', 'Sunday');
    expect(screen.getByText('Mon, Wed, Fri')).toBeOnTheScreen();
    expect(day('Monday').props.accessibilityState).toMatchObject({ checked: true });
    expect(day('Tuesday').props.accessibilityState).toMatchObject({ checked: false });
    await fireEvent.press(screen.getByRole('button', { name: 'Add goal' }));

    expect(app.pathname()).toBe('/settings');
    const goals = appStore.getState().goals.map((s) => s.goal);
    expect(goals.map((g) => g.goal)).toEqual(['Stop drinking', 'Run']);
    expect(latestScheduleEntry(goals[1]!).days).toEqual([1, 3, 5]);
  });

  it('keeps every day as the free app does: no days saved', async () => {
    await open('/add-goal');
    await fireEvent.press(screen.getByRole('button', { name: 'Read 20 minutes' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Add goal' }));
    expect(appStore.getState().goals[1]?.goal.goal).toBe('Read 20 minutes');
    expect(appStore.getState().goals[1]?.goal.checkInSchedule[0]).not.toHaveProperty('days');
  });

  it('always keeps one day on', async () => {
    await open('/add-goal');
    await untick('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday');
    expect(screen.getByText('Sundays')).toBeOnTheScreen();
    expect(day('Sunday').props.accessibilityHint).toBe('At least one day stays on');
    await fireEvent.press(day('Sunday'));
    expect(day('Sunday').props.accessibilityState).toMatchObject({ checked: true });
  });

  const three = () => ['a', 'b', 'c'].map((goalId) => ({ ...twoDays(), goalId }));

  it('says plainly in Settings when the goals are full', async () => {
    await open('/settings', three());
    expect(screen.getByText('All 3 goals are in use. Archive one to add another.')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: /^Add a goal/ })).not.toBeOnTheScreen();
  });

  it('says so kindly, with nothing to fill in, if Add a goal opens anyway', async () => {
    await open('/add-goal', three());
    expect(screen.getByText('All 3 goals are in use. Archive one in Settings to make room for a new one.')).toBeOnTheScreen();
    expect(screen.queryByLabelText('Your goal')).not.toBeOnTheScreen();
  });
});

describe('Setup in Win Zero Plus', () => {
  it('saves the days chosen, and on a rest day, today doesn’t count', async () => {
    await open('/setup', []);
    await fireEvent.changeText(screen.getByLabelText('Your daily goal'), 'Run');
    await untick('Tuesday', 'Thursday', 'Saturday', 'Sunday'); // 10-15 is a Thursday
    await fireEvent.press(screen.getByRole('button', { name: 'Start my streak' }));
    expect(screen.queryByText(/so today counts/)).not.toBeOnTheScreen();
    await fireEvent.press(screen.getByText('Not now'));
    expect(latestScheduleEntry(primaryGoal(appStore.getState())!).days).toEqual([1, 3, 5]);
  });

  it('words the rules and the goal for the days picked', async () => {
    await open('/setup', []);
    expect(screen.getByText(/Nothing's lost for a week/)).toBeOnTheScreen();
    await untick('Saturday', 'Sunday');
    expect(screen.queryByText(/Nothing's lost for a week/)).not.toBeOnTheScreen();
    expect(screen.getByText(/Missed a check-in\? The first 7 in a row cost nothing/)).toBeOnTheScreen();
    expect(screen.getByText(/^On each check-in day, at your check-in time/)).toBeOnTheScreen();
    expect(screen.getByLabelText('Your goal')).toBeOnTheScreen();
  });

  it('still counts today on a check-in day after check-in time', async () => {
    await open('/setup', []);
    await fireEvent.changeText(screen.getByLabelText('Your daily goal'), 'Run');
    await untick('Monday', 'Wednesday', 'Friday');
    await fireEvent.press(screen.getByRole('button', { name: 'Start my streak' }));
    expect(screen.getByText(/so today counts/)).toBeOnTheScreen();
  });
});

describe("a goal's check-in days in Settings", () => {
  it('saves new days, and says when they start', async () => {
    await open('/settings');
    expect(screen.getByText('Every day')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Save days' })).not.toBeOnTheScreen();
    await untick('Saturday', 'Sunday');
    await fireEvent.press(screen.getByRole('button', { name: 'Save days' }));
    expect(latestScheduleEntry(primaryGoal(appStore.getState())!).days).toEqual([1, 2, 3, 4, 5]);
    // Tonight's check-in is open, so the new days start tomorrow.
    expect(screen.getByText('These days start tomorrow.')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Save days' })).not.toBeOnTheScreen();
  });

  it('starts them today when today’s check-in hasn’t opened yet', async () => {
    await open('/settings', [twoDays()], '12:00');
    await untick('Saturday', 'Sunday');
    await fireEvent.press(screen.getByRole('button', { name: 'Save days' }));
    expect(screen.getByText('These days start today.')).toBeOnTheScreen();
  });

  it('says nothing about days when only the time changed', async () => {
    const goal = twoDays();
    await open('/settings', [goal]);
    await act(async () => {
      appStore.getState().setCheckInTime(goal.goalId, '19:00');
    });
    expect(latestScheduleEntry(primaryGoal(appStore.getState())!).time).toBe('19:00');
    expect(screen.queryByText(/These days start/)).not.toBeOnTheScreen();
  });
});

describe('several goals in Settings', () => {
  const two = () => [twoDays(), { ...newGoal({ tz: tz(), days: [1, 3, 5], checkInTime: '07:00' }), goalId: 'g2', goal: 'Run' }];

  it('lists each goal with its days and check-in time, and opens its own screen', async () => {
    const app = await open('/settings', two());
    expect(screen.getByRole('header', { name: 'Goals' })).toBeOnTheScreen();
    expect(screen.queryByLabelText('Daily goal')).not.toBeOnTheScreen();
    // The test phone keeps a 24-hour clock.
    expect(screen.getByText('Every day · 20:00')).toBeOnTheScreen();
    expect(screen.getByText('Mon, Wed, Fri · 07:00')).toBeOnTheScreen();
    expect(screen.getByText('1 more fits.')).toBeOnTheScreen();
    expect(screen.getByText(/Reminders use a goal’s lock-screen name/)).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: /^Run/ }));
    expect(app.pathname()).toBe('/goal');
    expect(screen.getByRole('header', { name: 'Run' })).toBeOnTheScreen();
    expect(screen.getByText('Goal · Mon, Wed, Fri')).toBeOnTheScreen();
  });

  it("changes a goal's wording, days and lock-screen name on its screen", async () => {
    const say = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    say.mockClear();
    await open('/goal?id=g2', two());
    await fireEvent.changeText(screen.getByLabelText('Goal'), 'Run 5k');
    await fireEvent.press(screen.getByRole('button', { name: 'Save goal' }));
    expect(say).toHaveBeenCalledWith('Saved. Your streak and history stay the same.');
    await fireEvent.press(day('Saturday'));
    await fireEvent.press(screen.getByRole('button', { name: 'Save days' }));
    const run = () => appStore.getState().goals[1]!.goal;
    expect(run().goal).toBe('Run 5k');
    expect(latestScheduleEntry(run()).days).toEqual([1, 3, 5, 6]);

    const name = screen.getByLabelText('Lock-screen name');
    expect(name.props.placeholder).toBe('your second goal');
    await fireEvent.changeText(name, '  Legs  ');
    await fireEvent.press(screen.getByRole('button', { name: 'Save name' }));
    expect(run().alias).toBe('Legs');
    expect(screen.getByText(/^Saved\. With Goal in reminders off/)).toBeOnTheScreen();
    // Save name goes away once saved, so a screen reader hears it instead.
    expect(say).toHaveBeenLastCalledWith(expect.stringMatching(/^Saved\. With Goal in reminders off/));
    await fireEvent.changeText(name, '');
    await fireEvent.press(screen.getByRole('button', { name: 'Clear name' }));
    expect(run()).not.toHaveProperty('alias');
    // The first goal is as it was.
    expect(appStore.getState().goals[0]!.goal.goal).toBe('Stop drinking');
  });

  it('goes to Settings from a link to a goal that isn’t here', async () => {
    const app = await open('/goal?id=nobody', two());
    expect(app.pathname()).toBe('/settings');
  });
});

describe('archiving, and Past goals', () => {
  const run = () => ({ ...yesDays(newGoal({ tz: tz() }), DAY0, 2, tz()), goalId: 'g2', goal: 'Run' });

  it('archives a goal only after asking, and lists it under Past goals, read-only', async () => {
    const app = await open('/settings', [twoDays(), run()]);
    await fireEvent.press(screen.getByRole('button', { name: /^Run/ }));
    await fireEvent.press(screen.getByRole('button', { name: 'Archive this goal' }));
    expect(screen.getByText('Archive “Run”?')).toBeOnTheScreen();
    expect(appStore.getState().goals).toHaveLength(2);
    await fireEvent.press(screen.getByRole('button', { name: 'Keep it' }));
    expect(screen.queryByText('Archive “Run”?')).not.toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Archive this goal' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Archive goal' }));
    expect(app.pathname()).toBe('/settings');
    expect(appStore.getState().goals.map((s) => s.goal.goal)).toEqual(['Stop drinking']);
    expect(appStore.getState().archived.map((a) => a.goal.goal)).toEqual(['Run']);
    // One goal again: its fields are back in Settings, with the past one a row away.
    expect(screen.getByLabelText('Daily goal')).toBeOnTheScreen();
    // Erase says it takes the past goals too, and nothing goes without the second tap.
    await fireEvent.press(screen.getByRole('button', { name: 'Erase all data' }));
    expect(screen.getByText(/deletes your goals, past goals, streaks, history and rewards/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Keep my data' }));

    await fireEvent.press(screen.getByRole('button', { name: /^Past goals/ }));
    expect(app.pathname()).toBe('/past-goals');
    expect(screen.getByText('Archived Oct 15 · best run 2 days')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: /^Run/ }));
    expect(app.pathname()).toBe('/past-goal');
    expect(screen.getByRole('header', { name: 'Run' })).toBeOnTheScreen();
    expect(screen.getByLabelText('Best run: 2 days, Oct 13 to Oct 14')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: /Save/ })).not.toBeOnTheScreen();
    expect(screen.queryByLabelText('Goal')).not.toBeOnTheScreen();
  });

  it('deletes a past goal for good only after asking, keeping what it unlocked', async () => {
    const old = { ...run(), bestStreak: 30 };
    appStore.setState({ archived: [{ goal: old, archivedAt: at(DAY0, '12:00', tz()).toISOString() }] });
    const app = await open('/settings');
    expect(screen.getByText('1 goal')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: /^Past goals/ }));
    await fireEvent.press(screen.getByRole('button', { name: /^Run/ }));
    await fireEvent.press(screen.getByRole('button', { name: 'Delete for good' }));
    expect(screen.getByText('Delete “Run” for good?')).toBeOnTheScreen();
    expect(appStore.getState().archived).toHaveLength(1);
    await fireEvent.press(screen.getByRole('button', { name: 'Delete for good' }));
    expect(appStore.getState().archived).toHaveLength(0);
    expect(appStore.getState().arsenalBest).toBe(30);
    // The last one gone: back to Settings, with no Past goals row.
    expect(app.pathname()).toBe('/settings');
    expect(screen.queryByRole('button', { name: /^Past goals/ })).not.toBeOnTheScreen();
  });

  it('offers no Archive with a single goal, as in Win Zero', async () => {
    await open('/goal?id=g1');
    expect(screen.queryByRole('button', { name: 'Archive this goal' })).not.toBeOnTheScreen();
  });

  it('says so when there are no past goals', async () => {
    await open('/past-goals');
    expect(screen.getByText('No past goals.')).toBeOnTheScreen();
  });
});
