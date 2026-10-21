// The round screen's way in: the day's round or a bonus round, with the Weapon credit question
// first when a credit could lend it something, and its way out: the cheer, then the popup for a
// Game credit its Yes earned. The canvas (Skia) is stood in for by a line naming its weapon and
// zeros, keeping each round it's handed and its colors, and able to end the round; the HUD is the
// real one.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { afterEach, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, renderRouter, fireEvent, screen } from 'expo-router/testing-library';

import PlayScreen from '@/app/play';
import { weaponById, type CreditGrant, type CreditWallet, type WeaponId } from '@/engine';
import { DAY0, newGoal, yesDays } from '@/engine/__tests__/fixtures';
import { appStore, primaryRound, type RoundRecord } from '@/store';
import { DEFAULT_PERSISTED } from '@/store/migrate';
import { THEME_LOOKS, type ThemeLook } from '@/theme/themes';
import { WEAPON_PROMPT } from '@/ui/copy/credits';

jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
const mockRounds: { n: number; mode?: string; autoFire?: boolean; look: ThemeLook; reduceMotion: boolean }[] = [];
/** Clears the round on the canvas: its last zero goes, and the fill lands. */
const mockCanvas: { clear: () => void } = { clear: () => {} };
jest.mock('@/game/GameCanvas', () => {
  const { createElement } = require('react');
  const { Text } = require('react-native');
  return {
    GameCanvas: (props: {
      weapon: { name: string };
      round: { n: number; mode?: string; autoFire?: boolean; seed: number };
      look: ThemeLook;
      reduceMotion: boolean;
      onReport: (r: object) => void;
    }) => {
      const { weapon, round, look, reduceMotion, onReport } = props;
      mockRounds.push({ ...round, look, reduceMotion });
      mockCanvas.clear = () => {
        const counts = { shots: 0, hits: 0, kills: 0, armoredKills: 0, blasts: 0, bombs: 0, bounces: 0, swishes: 0 };
        onReport({ seed: round.seed, dirty: true, valueLeft: 0, ...counts, final: true, showResult: false });
        onReport({ seed: round.seed, dirty: true, valueLeft: 0, ...counts, final: false, showResult: true });
      };
      return createElement(Text, null, `Canvas: ${weapon.name}, ${round.n} zeros`);
    },
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
const dayRound = (borrowed: WeaponId[] = [], played = false, credits: CreditGrant[] = []): RoundRecord => ({
  day: '2026-10-15',
  n: 3,
  rewards: { bomb: false, shield: false, shieldCapped: false, weapons: ['twin'], credits },
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
  mockRounds.length = 0;
  await AsyncStorage.clear();
  appStore.setState({ ...DEFAULT_PERSISTED, goals: [{ goal, round: null, seenThrough: null }] });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('the round, with a Weapon credit', () => {
  it("asks first, and plays the day's round with the weapon borrowed", async () => {
    appStore.setState({ goals: [{ goal, round: dayRound(), seenThrough: null }], credits: wallet(1) });
    await open('/play');
    expect(screen.queryByText(/^Canvas/)).not.toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', option('rocket')));

    expect(screen.getByText('Canvas: Rocket, 3 zeros')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Weapon: Rocket' })).toBeOnTheScreen();
    expect(appStore.getState().credits.balance.weapon).toBe(0);
    expect(primaryRound(appStore.getState())?.borrowed).toEqual(['rocket']);
    expect(appStore.getState().weapon).toBeNull(); // the saved pick isn't the borrowed weapon
  });

  it('plays with the usual weapon on Not this time, keeping the credit', async () => {
    appStore.setState({ goals: [{ goal, round: dayRound(), seenThrough: null }], credits: wallet(1) });
    await open('/play');
    await fireEvent.press(screen.getByRole('button', { name: 'Not this time' }));
    expect(screen.getByText('Canvas: Twin Barrel, 3 zeros')).toBeOnTheScreen();
    expect(appStore.getState().credits.balance.weapon).toBe(1);
  });

  it("doesn't ask without a credit", async () => {
    appStore.setState({ goals: [{ goal, round: dayRound(), seenThrough: null }], credits: wallet(0) });
    await open('/play');
    expect(screen.getByText('Canvas: Twin Barrel, 3 zeros')).toBeOnTheScreen();
  });

  it('comes back to a round that borrowed one with it equipped, without asking again', async () => {
    appStore.setState({ goals: [{ goal, round: dayRound(['rocket']), seenThrough: null }], credits: wallet(1) });
    await open('/play');
    expect(screen.getByText('Canvas: Rocket, 3 zeros')).toBeOnTheScreen();
  });

  it("doesn't ask before a replay", async () => {
    appStore.setState({ goals: [{ goal, round: dayRound([], true), seenThrough: null }], credits: wallet(1) });
    await open('/play');
    expect(screen.getByText('Canvas: Twin Barrel, 3 zeros')).toBeOnTheScreen();
  });
});

describe('the end of the round', () => {
  const zeros3: CreditGrant = { kind: 'game', amount: 1, key: 'zeros-3' };
  const comeback: CreditGrant = { kind: 'weapon', amount: 1, key: 'comeback' };
  const clear = () => act(() => mockCanvas.clear());

  it('cheers, then reveals the Game credit its Yes earned, then lets the sheet up', async () => {
    appStore.setState({
      goals: [{ goal, round: dayRound([], false, [zeros3, comeback]), seenThrough: null }],
      credits: { balance: { game: 2, weapon: 0 }, claimed: ['goal-set', 'zeros-3', 'comeback'] },
    });
    await open('/play');
    await clear();
    expect(primaryRound(appStore.getState())?.played).toBe(true);
    expect(screen.queryByText(/Game credit earned!/)).not.toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Got it' }));

    expect(screen.getByRole('header', { name: /Game credit earned!/ })).toBeOnTheScreen();
    expect(screen.getByText('Earned for reaching 3 zeros.')).toBeOnTheScreen();
    expect(screen.getByText(/^You now have 2 Game credits\./)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Nice!' }));
    expect(screen.queryByText(/Game credit earned!/)).not.toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Got it' })).not.toBeOnTheScreen();
  });

  it('reveals nothing when the Yes earned only a Weapon credit, or on a replay', async () => {
    appStore.setState({ goals: [{ goal, round: dayRound([], false, [comeback]), seenThrough: null }] });
    await open('/play');
    await clear();
    await fireEvent.press(screen.getByRole('button', { name: 'Got it' }));
    expect(screen.queryByRole('button', { name: 'Nice!' })).not.toBeOnTheScreen();

    appStore.setState({ goals: [{ goal, round: dayRound([], true, [zeros3]), seenThrough: null }] });
    await open('/play');
    await clear();
    await fireEvent.press(screen.getByRole('button', { name: 'Got it' }));
    expect(screen.queryByRole('button', { name: 'Nice!' })).not.toBeOnTheScreen();
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
    expect(primaryRound(appStore.getState())).toBeNull();
  });

  it('goes back to base when there is none', async () => {
    const app = await open('/play?round=bonus');
    expect(app.pathname()).toBe('/');
  });
});

describe('accessibility switches', () => {
  it('calms the round with Reduce effects on, as with the phone\'s Reduce Motion', async () => {
    appStore.setState({ goals: [{ goal, round: dayRound(), seenThrough: null }], credits: wallet(0) });
    await open('/play');
    expect(mockRounds.at(-1)?.reduceMotion).toBe(false);
    await act(async () => appStore.getState().setPref('reduceEffects', true));
    expect(mockRounds.at(-1)?.reduceMotion).toBe(true);
  });

  it('offers Finish round with the switch on, and no screen reader', async () => {
    appStore.setState({ goals: [{ goal, round: dayRound(), seenThrough: null }], credits: wallet(0) });
    await open('/play');
    expect(screen.queryByRole('button', { name: 'Finish round' })).not.toBeOnTheScreen();
    await act(async () => appStore.getState().setPref('finishButton', true));
    expect(screen.getByRole('button', { name: 'Finish round' })).toBeOnTheScreen();
  });

  it('plays with auto-fire on, and its hint says touches aim', async () => {
    appStore.setState({ goals: [{ goal, round: dayRound(), seenThrough: null }], credits: wallet(0) });
    appStore.getState().setPref('autoFire', true);
    await open('/play');
    expect(mockRounds.at(-1)).toMatchObject({ autoFire: true });
    expect(screen.getByText('Tap to aim · firing keeps going', { includeHiddenElements: true })).toBeOnTheScreen();
  });
});

describe('the game mode (SPEC 9)', () => {
  it('plays the Shooter in Win Zero, with its hint and weapons, and never asks which game', async () => {
    appStore.setState({ goals: [{ goal, round: dayRound(), seenThrough: null }], credits: wallet(0) });
    await open('/play');
    expect(screen.queryByRole('header', { name: 'Pick your game' })).not.toBeOnTheScreen();
    expect(mockRounds.at(-1)?.mode).toBe('shooter');
    expect(screen.getByText('Tap to shoot · hold to keep firing', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Weapon: Twin Barrel' })).toBeOnTheScreen();
    expect(screen.getByText('WEAPON · TAP TO SWITCH')).toBeOnTheScreen();
  });

  it('keeps Win Zero on the Shooter whatever was saved', async () => {
    appStore.setState({ goals: [{ goal, round: dayRound(), seenThrough: null }], credits: wallet(0), gameMode: 'catch' });
    await open('/play');
    expect(mockRounds.length).toBeGreaterThan(0);
    expect(mockRounds.every((r) => r.mode === 'shooter')).toBe(true);
  });

  it("ignores a practice link's mode in Win Zero", async () => {
    await open('/play?practice=60&mode=catch');
    expect(mockRounds.at(-1)?.n).toBe(60);
    expect(mockRounds.every((r) => r.mode === 'shooter')).toBe(true);
  });
});

describe('the theme (SPEC 9)', () => {
  it('keeps Win Zero in Classic whatever was saved', async () => {
    appStore.setState({
      goals: [{ goal, round: dayRound(), seenThrough: null }],
      credits: wallet(0),
      theme: 'neon',
      arsenalBest: 400,
    });
    await open('/play');
    expect(mockRounds.length).toBeGreaterThan(0);
    expect(mockRounds.every((r) => r.look === THEME_LOOKS.classic)).toBe(true);
  });

  it("ignores a practice link's theme in Win Zero", async () => {
    await open('/play?practice=60&theme=neon');
    expect(mockRounds.at(-1)?.n).toBe(60);
    expect(mockRounds.every((r) => r.look === THEME_LOOKS.classic)).toBe(true);
  });
});

describe('whose round (SPEC 9)', () => {
  const other = { ...yesDays(newGoal(), DAY0, 7), goalId: 'g2' }; // best 7: the Scatter Gun too
  const sevenRound: RoundRecord = { ...dayRound(), n: 7, rewards: { ...dayRound().rewards, weapons: [] } };

  it("plays the goal the link names, with the shared arsenal's weapons", async () => {
    appStore.setState({
      goals: [
        { goal, round: dayRound(), seenThrough: null },
        { goal: other, round: sevenRound, seenThrough: null },
      ],
      credits: wallet(0),
    });
    await open('/play?goal=g2');
    expect(screen.getByText('Canvas: Scatter Gun, 7 zeros')).toBeOnTheScreen();
  });

  it('without a goal in the link, plays the first round still waiting', async () => {
    appStore.setState({
      goals: [
        { goal, round: dayRound([], true), seenThrough: null },
        { goal: other, round: sevenRound, seenThrough: null },
      ],
      credits: wallet(0),
    });
    await open('/play');
    expect(screen.getByText('Canvas: Scatter Gun, 7 zeros')).toBeOnTheScreen();
  });

  it('goes back to Home for a goal that has no round', async () => {
    appStore.setState({ goals: [{ goal, round: null, seenThrough: null }], credits: wallet(0) });
    const app = await open('/play?goal=g9');
    expect(app.pathname()).toBe('/');
  });
});
