// Win Zero Plus's side of a move (SPEC 9): what /import shows for each kind of arrival, and what
// bringing it over does. The link's delivery goes through the real inbox; the handover itself
// is mocked (src/transfer tests it).
import './env/plus';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { afterEach, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Stack } from 'expo-router';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { Linking } from 'react-native';

import HomeScreen from '@/app/index';
import ImportScreen from '@/app/import';
import MoveScreen from '@/app/move';
import SettingsScreen from '@/app/settings';
import { resolve, type GoalState } from '@/engine';
import { at, DAY0, newGoal, yesDays } from '@/engine/__tests__/fixtures';
import { requestReminderPermission } from '@/notifications/permissions';
import { appStore, primaryGoal } from '@/store';
import { DEFAULT_PERSISTED } from '@/store/migrate';
import { STORE_VERSION, type PersistedState } from '@/store/types';
import { encodeMove } from '@/transfer/codec';
import { makeMove } from '@/transfer/envelope';
import { clearImport, deliver } from '@/transfer/inbox';
import { transport } from '@/transfer/transport';
import { IS_PLUS } from '@/variant';

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
const receive = jest.mocked(transport.receive);

const ID = 'aaaa-1111-bbbb';
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
const NOW = () => at('2026-10-21', '12:00', tz());

function stateOf(goals: GoalState[], patch: Partial<PersistedState> = {}): PersistedState {
  return { ...DEFAULT_PERSISTED, goals: goals.map((goal) => ({ goal, round: null, seenThrough: null })), ...patch };
}

/** Win Zero's move of `state`, as its link would deliver it. */
function arriving(state: PersistedState) {
  receive.mockReturnValue(makeMove({ id: ID, now: NOW(), appVersion: '1.2.0', state }));
  deliver({ kind: 'import', t: ID, d: null });
}

async function open(here: PersistedState = DEFAULT_PERSISTED) {
  jest.useFakeTimers();
  jest.setSystemTime(NOW());
  appStore.setState({ ...here });
  const app = renderRouter(ROUTES, { initialUrl: '/import' });
  await app;
  return { pathname: () => app.getPathname() };
}

const fromFree = () =>
  stateOf([yesDays(newGoal({ tz: tz() }), DAY0, 3, tz())], {
    credits: { balance: { game: 2, weapon: 1 }, claimed: ['goal-set', 'zeros-2', 'yes-run-3'] },
  });

beforeAll(async () => {
  for (let i = 0; i < 50 && !appStore.getState().hydrated; i++) await new Promise((r) => setTimeout(r, 0));
});

beforeEach(async () => {
  await AsyncStorage.clear();
  appStore.setState({ ...DEFAULT_PERSISTED, notices: {}, route: null, rejection: null, undo: null });
  clearImport();
  receive.mockReset().mockReturnValue(null);
  jest.mocked(transport.acknowledge).mockClear();
  jest.mocked(transport.discard).mockClear();
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

it('runs as Win Zero Plus, with its limits', () => {
  expect(IS_PLUS).toBe(true);
  expect(appStore.getState().limits.maxGoals).toBe(3);
});

describe('a move arriving', () => {
  it('shows what would arrive, and changes nothing until asked', async () => {
    arriving(fromFree());
    await open();
    expect(screen.getByText('Bring your progress over')).toBeOnTheScreen();
    expect(screen.getByText('Stop drinking')).toBeOnTheScreen();
    expect(screen.getByText(/^Streak 3 · best run 3 · 3 Yes days · last check-in Oct 15$/)).toBeOnTheScreen();
    expect(screen.getByText('Credits: 2 Game credits and 1 Weapon credit.')).toBeOnTheScreen();
    expect(screen.getByText('Your sound, haptics and reminder settings come too.')).toBeOnTheScreen();
    expect(appStore.getState().goals).toEqual([]);
    expect(transport.acknowledge).not.toHaveBeenCalled();
  });

  it('brings it over: asks about reminders, saves it once, and tells Win Zero', async () => {
    arriving(fromFree());
    const app = await open();
    await fireEvent.press(screen.getByRole('button', { name: 'Bring it over' }));
    expect(requestReminderPermission).toHaveBeenCalled();
    const s = appStore.getState();
    expect(primaryGoal(s)?.goal).toBe('Stop drinking');
    expect(s.credits.balance).toEqual({ game: 2, weapon: 1 });
    expect(Object.keys(s.imports)).toEqual([ID]);
    expect(transport.discard).toHaveBeenCalledWith(ID);
    expect(transport.acknowledge).toHaveBeenCalledWith(ID);
    expect(app.pathname()).toBe('/');
  });

  it('leaves everything as it was on Not now', async () => {
    arriving(fromFree());
    const app = await open();
    await fireEvent.press(screen.getByRole('button', { name: 'Not now' }));
    expect(appStore.getState().goals).toEqual([]);
    expect(transport.acknowledge).not.toHaveBeenCalled();
    expect(app.pathname()).toBe('/setup'); // Home, which has no goal yet
  });

  it('lets the user pick which copy of a goal both apps have to keep', async () => {
    const base = yesDays(newGoal({ tz: tz() }), DAY0, 3, tz());
    const usedThere = yesDays(base, '2026-10-16', 4, tz());
    const leftHere = resolve(base, NOW(), tz()).state;
    arriving(stateOf([usedThere]));
    await open(stateOf([leftHere]));
    expect(screen.getByText('Win Zero Plus already has this goal. Which one should it keep?')).toBeOnTheScreen();
    const fromWinZero = screen.getByRole('button', { name: /^From Win Zero: Streak 7/ });
    const alreadyHere = screen.getByRole('button', { name: /^Already here: Streak 3/ });
    expect(fromWinZero).toBeSelected(); // answered more recently
    await fireEvent.press(alreadyHere);
    expect(alreadyHere).toBeSelected();
    await fireEvent.press(screen.getByRole('button', { name: 'Bring it over' }));
    expect(primaryGoal(appStore.getState())?.streak).toBe(leftHere.streak);
  });
});

describe('a move that can’t come in yet', () => {
  it('asks for room when Plus’s goals are full', async () => {
    const goal = (goalId: string) => ({ ...newGoal({ tz: tz() }), goalId, goal: goalId });
    arriving(fromFree());
    const app = await open(stateOf([goal('Walk'), goal('Read'), goal('Sleep')]));
    expect(screen.getByText('Make room first.')).toBeOnTheScreen();
    expect(screen.getByText(/room for 3 goals, and all 3 are in use/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Manage goals' }));
    expect(app.pathname()).toBe('/settings');
    expect(appStore.getState().goals).toHaveLength(3);
  });

  it('asks for an update when the move comes from a newer Win Zero', async () => {
    const newer = { kind: 'winzero.move', v: 1, id: ID, createdAt: NOW().toISOString(), from: { appVersion: '9.0.0', storeVersion: STORE_VERSION + 1 }, state: fromFree() };
    receive.mockReturnValue(encodeMove(JSON.stringify(newer)));
    deliver({ kind: 'import', t: ID, d: null });
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    await open();
    expect(screen.getByText('Update Win Zero Plus first.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Update Win Zero Plus' }));
    expect(openURL).toHaveBeenCalledWith('https://apps.apple.com/app/id1234567890');
  });

  it('says so when the move can’t be read or found', async () => {
    receive.mockReturnValue('wz1.garbage');
    deliver({ kind: 'import', t: ID, d: null });
    await open();
    expect(screen.getByText("This move couldn't be read.")).toBeOnTheScreen();
  });

  it('says there’s nothing to move when no link brought one', async () => {
    await open();
    expect(screen.getByText('Nothing to move yet.')).toBeOnTheScreen();
  });
});

describe('the same move again', () => {
  it('adds nothing twice, and tells Win Zero again', async () => {
    arriving(fromFree());
    const imports = { [ID]: { at: NOW().toISOString(), createdAt: NOW().toISOString(), game: 2, weapon: 1 } };
    await open(stateOf([yesDays(newGoal({ tz: tz() }), DAY0, 3, tz())], { imports }));
    expect(screen.getByText('Your progress is already here.')).toBeOnTheScreen();
    expect(transport.discard).toHaveBeenCalledWith(ID);
    expect(transport.acknowledge).toHaveBeenCalledWith(ID);
    expect(appStore.getState().credits.balance).toEqual({ game: 0, weapon: 0 });
  });
});

it('has no Move screen in Win Zero Plus: that route leads Home', async () => {
  appStore.setState(stateOf([newGoal({ tz: tz() })]));
  jest.useFakeTimers();
  jest.setSystemTime(NOW());
  const app = renderRouter(ROUTES, { initialUrl: '/move' });
  await app;
  expect(app.getPathname()).toBe('/');
});
