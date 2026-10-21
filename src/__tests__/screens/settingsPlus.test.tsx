// Win Zero Plus's Settings (SPEC 9): Games, Themes and App icon, between the toggles and About.
import './env/plus';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { afterEach, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Stack } from 'expo-router';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { Platform } from 'react-native';

import SettingsScreen from '@/app/settings';
import { THEME_UNLOCK_EMBER, type GoalState } from '@/engine';
import { at, DAY0, newGoal, yesDays } from '@/engine/__tests__/fixtures';
import { appStore, gameModeOf, themeOf } from '@/store';
import { DEFAULT_PERSISTED } from '@/store/migrate';

import AppIcons from '../../../modules/app-icons';

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
  settings: SettingsScreen,
};

const tz = () => appStore.getState().timeZone();

async function open(goal: GoalState = yesDays(newGoal({ tz: tz() }), DAY0, 2, tz())) {
  jest.useFakeTimers();
  jest.setSystemTime(at('2026-10-15', '21:00', tz()));
  appStore.setState({ goals: [{ goal, round: null, seenThrough: null }] });
  await renderRouter(ROUTES, { initialUrl: '/settings' });
  // The icon showing is read from the phone.
  await act(async () => {});
}

const radio = (name: string | RegExp) => screen.getByRole('radio', { name });
const checked = (name: string | RegExp) => radio(name).props.accessibilityState?.checked;

beforeAll(async () => {
  for (let i = 0; i < 50 && !appStore.getState().hydrated; i++) await new Promise((r) => setTimeout(r, 0));
});

beforeEach(async () => {
  await AsyncStorage.clear();
  await AppIcons.setIconAsync(null);
  appStore.setState({ ...DEFAULT_PERSISTED, notices: {}, route: null, rejection: null, undo: null });
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe('Settings in Win Zero Plus', () => {
  it('puts Goals under the goal, and Games, Themes and App icon between the toggles and About', async () => {
    await open();
    // The top bar's name first, then the screen's own headings.
    const headers = screen.getAllByRole('header').map((h) => h.props.accessibilityLabel ?? h.props.children);
    expect(headers).toEqual(['Win Zero Plus', 'Settings', 'Goals', 'Accessibility', 'Games', 'Themes', 'App icon', 'About']);
  });

  it('plays every round in the game picked, and names its power-up now', async () => {
    await open();
    for (const name of ['Shooter', 'Catch', 'Orbit', 'Slice', 'Breaker']) {
      expect(radio(new RegExp(`^${name}\\.`))).toBeOnTheScreen();
    }
    expect(checked(/^Shooter\./)).toBe(true);
    // Best streak 2: the Pea Shooter's tier.
    expect(screen.getByText('Slide anywhere to catch the zeros. Catcher: Cup')).toBeOnTheScreen();
    await fireEvent.press(radio(/^Catch\./));
    expect(gameModeOf(appStore.getState())).toBe('catch');
    expect(checked(/^Catch\./)).toBe(true);
    expect(checked(/^Shooter\./)).toBe(false);
  });

  it("drops a hint at Home's secret under the games, without giving it away", async () => {
    await open();
    expect(screen.getByText(/^Psst\. Somewhere on Home, a little box hands out free games/)).toBeOnTheScreen();
  });

  it('offers the included themes, and an earned one only from its best streak, never for sale', async () => {
    await open();
    expect(checked('Classic')).toBe(true);
    await fireEvent.press(radio('Neon Arcade'));
    expect(themeOf(appStore.getState())).toBe('neon');

    const ember = radio('Ember. Opens at a best streak of 30');
    expect(ember.props.accessibilityState).toMatchObject({ checked: false, disabled: true });
    await fireEvent.press(ember);
    expect(themeOf(appStore.getState())).toBe('neon');
    expect(screen.queryByText(/\$|buy|price|purchase|unlock now/i)).not.toBeOnTheScreen();
  });

  it('opens Ember once the shared best reaches 30', async () => {
    appStore.setState({ arsenalBest: THEME_UNLOCK_EMBER });
    await open();
    await fireEvent.press(radio('Ember. Earned at a best streak of 30'));
    expect(themeOf(appStore.getState())).toBe('ember');
  });

  it('lists the Plus icon and one per theme, with the one showing checked', async () => {
    await open();
    expect(checked('Win Zero Plus icon')).toBe(true);
    for (const name of ['Classic', 'Neon Arcade', 'Mono CRT', 'Pastel']) expect(checked(`${name} icon`)).toBe(false);
    expect(radio('Ember icon. Opens with Ember, at a best streak of 30.').props.accessibilityState).toMatchObject({
      disabled: true,
    });
    expect(radio('Gold Year icon. Opens with Gold Year, at a best streak of 365.')).toBeOnTheScreen();
  });

  it('switches the icon at once on iPhone, which says so itself', async () => {
    await open();
    await fireEvent.press(radio('Neon Arcade icon'));
    await act(async () => {});
    expect(await AppIcons.getIconAsync()).toBe('neon');
    expect(screen.queryByText(/may close/)).not.toBeOnTheScreen();
    // The theme pick is its own.
    expect(themeOf(appStore.getState())).toBe('classic');
  });

  it('asks first on Android, which may close the app to switch', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    await open();
    await fireEvent.press(radio('Pastel icon'));
    expect(screen.getByText('Switch to the Pastel icon?')).toBeOnTheScreen();
    expect(screen.getByText('Win Zero Plus may close to make the change. Open it again from the new icon.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Not now' }));
    expect(await AppIcons.getIconAsync()).toBeNull();
    expect(screen.queryByText('Switch to the Pastel icon?')).not.toBeOnTheScreen();

    await fireEvent.press(radio('Pastel icon'));
    await fireEvent.press(screen.getByRole('button', { name: 'Switch icon' }));
    await act(async () => {});
    expect(await AppIcons.getIconAsync()).toBe('pastel');
  });

  it("doesn't switch to an icon not opened yet", async () => {
    await open();
    await fireEvent.press(radio('Aurora icon. Opens with Aurora, at a best streak of 180.'));
    await act(async () => {});
    expect(await AppIcons.getIconAsync()).toBeNull();
  });
});
