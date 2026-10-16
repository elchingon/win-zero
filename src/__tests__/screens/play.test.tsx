// The round screen's way in: the day's round or a bonus round, with the Weapon credit question
// first when a credit could lend it something. The canvas (Skia) is stood in for by a line
// naming its weapon and zeros; the HUD is the real one.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { afterEach, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { renderRouter, fireEvent, screen } from 'expo-router/testing-library';

import PlayScreen from '@/app/play';
import { weaponById, type CreditWallet, type WeaponId } from '@/engine';
import { DAY0, newGoal, yesDays } from '@/engine/__tests__/fixtures';
import { appStore, type RoundRecord } from '@/store';
import { DEFAULT_PERSISTED } from '@/store/migrate';
import { WEAPON_PROMPT } from '@/ui/copy/credits';

jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('@/game/GameCanvas', () => {
  const { createElement } = require('react');
  const { Text } = require('react-native');
  return {
    GameCanvas: ({ weapon, round }: { weapon: { name: string }; round: { n: number } }) =>
      createElement(Text, null, `Canvas: ${weapon.name}, ${round.n} zeros`),
  };
});
jest.mock('@/game/ResultSheet', () => ({ ResultSheet: () => null }));
jest.mock('@/game/sfx', () => ({ useSfx: () => () => {} }));

const ROUTES = {
  index: () => null,
  play: PlayScreen,
};

const goal = yesDays(newGoal(), DAY0, 3); // best 3: Pea Shooter and Twin Barrel unlocked
const wallet = (weapon: number): CreditWallet => ({ balance: { game: 0, weapon }, claimed: [] });
const dayRound = (borrowed: WeaponId[] = [], played = false): RoundRecord => ({
  day: '2026-10-15',
  n: 3,
  rewards: { bomb: false, shield: false, shieldCapped: false, weapons: ['twin'], credits: [] },
  borrowed,
  played,
});
const option = (id: WeaponId) => ({ name: WEAPON_PROMPT.option(weaponById(id)) });

async function open(path: string) {
  const app = renderRouter(ROUTES, { initialUrl: path });
  await app;
  return { pathname: () => app.getPathname() };
}

beforeAll(async () => {
  for (let i = 0; i < 50 && !appStore.getState().hydrated; i++) await new Promise((r) => setTimeout(r, 0));
});

beforeEach(async () => {
  await AsyncStorage.clear();
  appStore.setState({ ...DEFAULT_PERSISTED, goal });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('the round, with a Weapon credit', () => {
  it("asks first, and plays the day's round with the weapon borrowed", async () => {
    appStore.setState({ round: dayRound(), credits: wallet(1) });
    await open('/play');
    expect(screen.queryByText(/^Canvas/)).not.toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', option('rocket')));

    expect(screen.getByText('Canvas: Rocket, 3 zeros')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Weapon: Rocket' })).toBeOnTheScreen();
    expect(appStore.getState().credits.balance.weapon).toBe(0);
    expect(appStore.getState().round?.borrowed).toEqual(['rocket']);
    expect(appStore.getState().weapon).toBeNull(); // the saved pick isn't the borrowed weapon
  });

  it('plays with the usual weapon on Not this time, keeping the credit', async () => {
    appStore.setState({ round: dayRound(), credits: wallet(1) });
    await open('/play');
    await fireEvent.press(screen.getByRole('button', { name: 'Not this time' }));
    expect(screen.getByText('Canvas: Twin Barrel, 3 zeros')).toBeOnTheScreen();
    expect(appStore.getState().credits.balance.weapon).toBe(1);
  });

  it("doesn't ask without a credit", async () => {
    appStore.setState({ round: dayRound(), credits: wallet(0) });
    await open('/play');
    expect(screen.getByText('Canvas: Twin Barrel, 3 zeros')).toBeOnTheScreen();
  });

  it('comes back to a round that borrowed one with it equipped, without asking again', async () => {
    appStore.setState({ round: dayRound(['rocket']), credits: wallet(1) });
    await open('/play');
    expect(screen.getByText('Canvas: Rocket, 3 zeros')).toBeOnTheScreen();
  });

  it("doesn't ask before a replay", async () => {
    appStore.setState({ round: dayRound([], true), credits: wallet(1) });
    await open('/play');
    expect(screen.getByText('Canvas: Twin Barrel, 3 zeros')).toBeOnTheScreen();
  });
});

describe('a bonus round', () => {
  it('asks first too, and plays the zeros it was bought for', async () => {
    appStore.setState({ bonus: { n: 250, borrowed: [], played: false }, credits: wallet(1) });
    await open('/play?round=bonus');
    await fireEvent.press(screen.getByRole('button', option('nuke')));
    expect(screen.getByText('Canvas: Zero Nuke, 250 zeros')).toBeOnTheScreen();
    expect(screen.getByText('BONUS')).toBeOnTheScreen();
    expect(appStore.getState().bonus?.borrowed).toEqual(['nuke']);
    expect(appStore.getState().round).toBeNull();
  });

  it('goes back to base when there is none', async () => {
    const app = await open('/play?round=bonus');
    expect(app.pathname()).toBe('/');
  });
});
