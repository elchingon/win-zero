// Win Zero's side of Win Zero Plus (SPEC 9), with Plus's store page set: Home's Plus card, the rows
// in Settings, the Move screen and what each send leads to, and Home once moved or still waiting.
// The handover itself is mocked here (src/transfer tests it).
import './env/plusOnStore';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { afterEach, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Stack } from 'expo-router';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { Linking } from 'react-native';

import HomeScreen from '@/app/index';
import ImportScreen from '@/app/import';
import MoveScreen from '@/app/move';
import SettingsScreen from '@/app/settings';
import type { GoalState } from '@/engine';
import { at, DAY0, newGoal, yesDays } from '@/engine/__tests__/fixtures';
import { appStore, isMovedOut, type MoveOut } from '@/store';
import { DEFAULT_PERSISTED } from '@/store/migrate';
import { decodeMove } from '@/transfer/codec';
import { transport } from '@/transfer/transport';
import { MOVE_CHECK_AFTER_MS } from '@/ui/home/moved';

jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
jest.mock('@/notifications/permissions', () => ({
  getReminderPermission: jest.fn(async () => 'granted'),
  requestReminderPermission: jest.fn(async () => 'granted'),
  ensureReminderChannel: jest.fn(async () => {}),
}));
jest.mock('@/notifications', () => ({ requestSync: jest.fn(async () => {}), onSynced: () => () => {} }));
jest.mock('@/dev/DebugSection', () => ({ DebugSection: () => null, DemoControls: () => null }));
jest.mock('@/transfer/transport', () => ({
  transport: {
    send: jest.fn(async () => 'opened'),
    receive: jest.fn(() => null),
    handedOver: jest.fn(() => true),
    discard: jest.fn(),
    acknowledge: jest.fn(async () => {}),
  },
}));
const send = jest.mocked(transport.send);

const STORE_URL = 'https://apps.apple.com/app/id1234567890';
const ROUTES = {
  _layout: () => <Stack screenOptions={{ headerShown: false }} />,
  index: HomeScreen,
  settings: SettingsScreen,
  move: MoveScreen,
  import: ImportScreen,
  setup: () => null,
  play: () => null,
  notice: () => null,
};

const tz = () => appStore.getState().timeZone();
const twoDays = () => yesDays(newGoal({ tz: tz() }), DAY0, 2, tz());

async function open(path: string, opts: { goal?: GoalState; moveOut?: MoveOut } = {}) {
  jest.useFakeTimers();
  jest.setSystemTime(at('2026-10-15', '21:00', tz()));
  appStore.setState({
    goals: [{ goal: opts.goal ?? twoDays(), round: null, seenThrough: null }],
    moveOut: opts.moveOut ?? null,
  });
  const app = renderRouter(ROUTES, { initialUrl: path });
  await app;
  return { pathname: () => app.getPathname() };
}

/** A move sent `minutes` ago. */
const sentAgo = (minutes: number): MoveOut => ({
  id: 'move-1',
  status: 'sent',
  sentAt: new Date(at('2026-10-15', '21:00', tz()).getTime() - minutes * 60_000).toISOString(),
});

beforeAll(async () => {
  for (let i = 0; i < 50 && !appStore.getState().hydrated; i++) await new Promise((r) => setTimeout(r, 0));
});

beforeEach(async () => {
  await AsyncStorage.clear();
  appStore.setState({ ...DEFAULT_PERSISTED, notices: {}, route: null, rejection: null, undo: null });
  send.mockReset().mockResolvedValue('opened');
  jest.mocked(transport.discard).mockClear();
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe('Home’s Plus card', () => {
  const toggle = () => screen.getByRole('button', { name: 'What Win Zero Plus adds' });

  it('stays closed until the "+" opens it, and the "+" closes it again', async () => {
    await open('/');
    expect(screen.queryByText('Get more with Win Zero Plus')).not.toBeOnTheScreen();
    await fireEvent.press(toggle());
    expect(screen.getByText('Get more with Win Zero Plus')).toBeOnTheScreen();
    expect(screen.getByText('Play as many bonus rounds as you want')).toBeOnTheScreen();
    expect(screen.getByText('Track up to 3 goals, on the days you choose')).toBeOnTheScreen();
    expect(screen.getByText('Play 5 kinds of games')).toBeOnTheScreen();
    await fireEvent.press(toggle());
    expect(screen.queryByText('Get more with Win Zero Plus')).not.toBeOnTheScreen();
  });

  it('leads to Plus’s store page, and to the move for someone who has it', async () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const app = await open('/');
    await fireEvent.press(toggle());
    await fireEvent.press(screen.getByRole('button', { name: 'See Win Zero Plus' }));
    expect(openURL).toHaveBeenCalledWith(STORE_URL);
    await fireEvent.press(screen.getByRole('button', { name: 'Already have it? Move your progress' }));
    expect(app.pathname()).toBe('/move');
    expect(send).not.toHaveBeenCalled();
  });
});

describe('Settings › Win Zero Plus', () => {
  it('links to Plus’s store page', async () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    await open('/settings');
    expect(screen.getByRole('header', { name: 'Win Zero Plus' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: /Get Win Zero Plus/ }));
    expect(openURL).toHaveBeenCalledWith(STORE_URL);
  });

  it('offers the move, and explains it before anything happens', async () => {
    const app = await open('/settings');
    await fireEvent.press(screen.getByRole('button', { name: /Move to Win Zero Plus/ }));
    expect(app.pathname()).toBe('/move');
    expect(screen.getByText('What moves')).toBeOnTheScreen();
    expect(screen.getByText('It happens on this phone. Nothing is sent to us, or to anyone else.')).toBeOnTheScreen();
    expect(send).not.toHaveBeenCalled();
  });

  it('doesn’t offer Plus or the move again once moved', async () => {
    await open('/settings', { moveOut: { ...sentAgo(1), status: 'moved' } });
    expect(screen.queryByText('Get Win Zero Plus')).not.toBeOnTheScreen();
    expect(screen.queryByText('Move to Win Zero Plus')).not.toBeOnTheScreen();
  });
});

describe('the Move screen', () => {
  it('sends the move with its id, and says Plus takes it from there', async () => {
    await open('/move');
    await fireEvent.press(screen.getByRole('button', { name: 'Move to Win Zero Plus' }));
    expect(send).toHaveBeenCalledTimes(1);
    const [id, payload] = send.mock.calls[0]!;
    expect(appStore.getState().moveOut).toMatchObject({ id, status: 'sent' });
    expect(JSON.parse(decodeMove(payload))).toMatchObject({ kind: 'winzero.move', id, state: { goals: [{}] } });
    expect(await screen.findByText(/Win Zero Plus is open/)).toBeOnTheScreen();
  });

  it('opens Plus’s store page when Plus isn’t installed, and leaves nothing waiting', async () => {
    send.mockResolvedValue('not-installed');
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    await open('/move');
    await fireEvent.press(screen.getByRole('button', { name: 'Move to Win Zero Plus' }));
    expect(await screen.findByText(/isn't on this phone yet/)).toBeOnTheScreen();
    expect(openURL).toHaveBeenCalledWith(STORE_URL);
    expect(appStore.getState().moveOut).toBeNull();
  });

  it('says nothing changed when the handover fails', async () => {
    send.mockResolvedValue('failed');
    await open('/move');
    await fireEvent.press(screen.getByRole('button', { name: 'Move to Win Zero Plus' }));
    expect(await screen.findByText(/That didn't work this time. Nothing has changed here./)).toBeOnTheScreen();
    expect(appStore.getState().moveOut).toBeNull();
  });

  it('keeps an earlier try waiting when a later one fails, and can cancel it', async () => {
    send.mockResolvedValue('failed');
    await open('/move', { moveOut: sentAgo(2) });
    await fireEvent.press(screen.getByRole('button', { name: 'Move to Win Zero Plus' }));
    expect(send.mock.calls[0]?.[0]).toBe('move-1');
    expect(appStore.getState().moveOut?.id).toBe('move-1');
    await fireEvent.press(screen.getByRole('button', { name: 'Cancel move' }));
    expect(appStore.getState().moveOut).toBeNull();
    expect(transport.discard).toHaveBeenCalledWith('move-1');
  });

  it('has no Import screen in Win Zero: that route leads Home', async () => {
    const app = await open('/import');
    expect(app.pathname()).toBe('/');
  });
});

describe('Home after a move', () => {
  it('says where the goals went, and nothing else', async () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    await open('/', { moveOut: { ...sentAgo(30), status: 'moved' } });
    expect(screen.getByText('Your goals now live in Win Zero Plus.')).toBeOnTheScreen();
    expect(screen.queryByText(/Did you stick to/)).not.toBeOnTheScreen();
    expect(screen.queryByText('Game credits')).not.toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Open Win Zero Plus' }));
    expect(openURL).toHaveBeenCalledWith('winzeroplus://');
  });

  it('keeps using Win Zero here: the move is undone and Home comes back', async () => {
    await open('/', { moveOut: { ...sentAgo(30), status: 'moved' } });
    await fireEvent.press(screen.getByRole('button', { name: 'Keep using Win Zero here' }));
    expect(appStore.getState().moveOut).toBeNull();
    expect(await screen.findByText(/Did you stick to/)).toBeOnTheScreen();
  });
});

describe('Home while a move waits', () => {
  it('asks after 10 minutes whether it finished', async () => {
    await open('/', { moveOut: sentAgo(9) });
    expect(screen.queryByText('Did your move finish?')).not.toBeOnTheScreen();
    await act(() => jest.advanceTimersByTimeAsync(MOVE_CHECK_AFTER_MS));
    expect(await screen.findByText('Did your move finish?')).toBeOnTheScreen();
  });

  it('stops reminders here when told it did', async () => {
    await open('/', { moveOut: sentAgo(11) });
    await fireEvent.press(screen.getByRole('button', { name: 'Yes, stop reminders here' }));
    expect(isMovedOut(appStore.getState())).toBe(true);
    expect(transport.discard).toHaveBeenCalledWith('move-1');
    expect(await screen.findByText('Your goals now live in Win Zero Plus.')).toBeOnTheScreen();
  });

  it('tries again with the same move, and waits again before asking', async () => {
    await open('/', { moveOut: sentAgo(11) });
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(send.mock.calls[0]?.[0]).toBe('move-1');
    expect(appStore.getState().moveOut).toMatchObject({ id: 'move-1', status: 'sent' });
    expect(screen.queryByText('Did your move finish?')).not.toBeOnTheScreen();
  });

  it('cancels the move, leaving Win Zero as it was', async () => {
    await open('/', { moveOut: sentAgo(11) });
    await fireEvent.press(screen.getByRole('button', { name: 'Cancel move' }));
    expect(appStore.getState().moveOut).toBeNull();
    expect(transport.discard).toHaveBeenCalledWith('move-1');
    expect(screen.queryByText('Did your move finish?')).not.toBeOnTheScreen();
  });
});
