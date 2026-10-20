// Win Zero Plus's Notice and How it works with goals on chosen days, or several goals (SPEC 9).
import './env/plus';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { afterEach, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Stack } from 'expo-router';
import { renderRouter, screen } from 'expo-router/testing-library';

import HowItWorksScreen from '@/app/how-it-works';
import NoticeScreen from '@/app/notice';
import type { GoalState } from '@/engine';
import { at, DAY0, newGoal, yesDays } from '@/engine/__tests__/fixtures';
import { appStore } from '@/store';
import { DEFAULT_PERSISTED } from '@/store/migrate';

jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
jest.mock('@/notifications', () => ({ requestSync: jest.fn(async () => {}), onSynced: () => () => {} }));

const ROUTES = {
  _layout: () => <Stack screenOptions={{ headerShown: false }} />,
  index: () => null,
  notice: NoticeScreen,
  'how-it-works': HowItWorksScreen,
};

const tz = () => appStore.getState().timeZone();
const slot = (goal: GoalState) => ({ goal, round: null, seenThrough: null });

async function open(path: string, goals: GoalState[]) {
  jest.useFakeTimers();
  jest.setSystemTime(at('2026-10-15', '21:00', tz()));
  appStore.setState({ goals: goals.map(slot) });
  await renderRouter(ROUTES, { initialUrl: path });
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

const away = { kind: 'slipping', cause: 'missed', lost: 1, streak: 2, days: 8, stopped: false } as const;

describe('the Notice in Win Zero Plus', () => {
  it('counts free misses in check-ins for a goal on chosen days', async () => {
    appStore.setState({ notices: { g1: away } });
    await open('/notice', [newGoal({ tz: tz(), days: [1, 3, 5] })]);
    expect(screen.getByText(/The first 7 missed check-ins in a row are free/)).toBeOnTheScreen();
    expect(screen.getByText('While you were away')).toBeOnTheScreen();
  });

  it('names the goal its news is about once there are several', async () => {
    const one = yesDays(newGoal({ tz: tz() }), DAY0, 2, tz());
    const two = { ...one, goalId: 'g2', goal: 'Run' };
    appStore.setState({ notices: { g2: away } });
    await open('/notice?goal=g2', [one, two]);
    expect(screen.getByText('While you were away · Run')).toBeOnTheScreen();
    expect(screen.getByText(/Missed days are free for a week/)).toBeOnTheScreen();
  });
});

describe('How it works in Win Zero Plus', () => {
  it('follows chosen check-in days', async () => {
    await open('/how-it-works', [newGoal({ tz: tz() }), { ...newGoal({ tz: tz(), days: [1, 3, 5] }), goalId: 'g2' }]);
    expect(screen.getByRole('header', { name: 'The check-in question' })).toBeOnTheScreen();
    expect(screen.getByText(/Rest days have no check-in/)).toBeOnTheScreen();
  });

  it('reads as Win Zero does while every goal checks in every day', async () => {
    await open('/how-it-works', [newGoal({ tz: tz() })]);
    expect(screen.getByRole('header', { name: 'The daily question' })).toBeOnTheScreen();
    expect(screen.queryByText(/Rest days/)).not.toBeOnTheScreen();
  });
});
