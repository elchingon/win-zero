// Win Zero Plus's Home (SPEC 9): the shared arsenal and credits, and with one goal, Win Zero's Home.
import './env/plus';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { afterEach, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Stack } from 'expo-router';
import { renderRouter, screen } from 'expo-router/testing-library';

import HomeScreen from '@/app/index';
import type { GoalState } from '@/engine';
import { at, DAY0, newGoal, yesDays } from '@/engine/__tests__/fixtures';
import { appStore, type GoalSlot } from '@/store';
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
  await AsyncStorage.clear();
  appStore.setState({ ...DEFAULT_PERSISTED, notices: {}, route: null, rejection: null, undo: null });
});

afterEach(() => {
  jest.useRealTimers();
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
