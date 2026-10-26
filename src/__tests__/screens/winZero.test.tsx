// Win Zero has none of Win Zero Plus's screens or Settings sections (SPEC 9): one goal, every day,
// the Shooter in Classic colors, its own icon. Their links lead Home.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { afterEach, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Stack } from 'expo-router';
import { renderRouter, screen } from 'expo-router/testing-library';

import AddGoalScreen from '@/app/add-goal';
import GoalScreen from '@/app/goal';
import PastGoalScreen from '@/app/past-goal';
import PastGoalsScreen from '@/app/past-goals';
import HomeScreen from '@/app/index';
import SettingsScreen from '@/app/settings';
import SetupScreen from '@/app/setup';
import type { GoalState } from '@/engine';
import { at, DAY0, newGoal, yesDays } from '@/engine/__tests__/fixtures';
import { appStore } from '@/store';
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
  index: HomeScreen,
  play: () => null,
  notice: () => null,
  settings: SettingsScreen,
  setup: SetupScreen,
  'add-goal': AddGoalScreen,
  goal: GoalScreen,
  'past-goals': PastGoalsScreen,
  'past-goal': PastGoalScreen,
};

const tz = () => appStore.getState().timeZone();

async function open(path: string, goal: GoalState | null = yesDays(newGoal({ tz: tz() }), DAY0, 2, tz())) {
  jest.useFakeTimers();
  jest.setSystemTime(at('2026-10-15', '21:00', tz()));
  appStore.setState({ goals: goal ? [{ goal, round: null, seenThrough: null }] : [] });
  const app = renderRouter(ROUTES, { initialUrl: path });
  await app;
  return { pathname: () => app.getPathname() };
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

describe('Win Zero', () => {
  it("has none of Win Zero Plus's Settings sections", async () => {
    await open('/settings');
    // The top bar's name first, then the screen's own headings.
    const headers = screen.getAllByRole('header').map((h) => h.props.accessibilityLabel ?? h.props.children);
    expect(headers).toEqual(['Win Zero', 'Settings', 'Accessibility', 'About']);
    expect(screen.queryByRole('radio')).not.toBeOnTheScreen();
    expect(screen.queryByText('Check-in days')).not.toBeOnTheScreen();
    expect(screen.queryByText(/Add a goal/)).not.toBeOnTheScreen();
    expect(screen.queryByText(/free games/)).not.toBeOnTheScreen();
  });

  it('sets up a goal for every day, with no days to choose', async () => {
    await open('/setup', null);
    expect(screen.queryByRole('checkbox')).not.toBeOnTheScreen();
    expect(screen.queryByText('Check-in days')).not.toBeOnTheScreen();
  });

  it.each(['/add-goal', '/goal?id=g1', '/past-goals', '/past-goal?id=g1'])("leads Win Zero Plus's link %s Home, with nothing changed", async (path) => {
    const app = await open(path);
    expect(app.pathname()).toBe('/');
    expect(appStore.getState().goals).toHaveLength(1);
  });
});
