// The round's theme and game mode in Win Zero Plus (SPEC 9): a day's round wears the saved theme
// once it's earned, and a practice link can try on any theme, and any mode whose round is built.
// The canvas is stood in for, keeping each round it's handed and its colors.
import './env/plus';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { router } from 'expo-router';
import { act, renderRouter, screen } from 'expo-router/testing-library';

import PlayScreen from '@/app/play';
import { PLAYABLE_MODES, THEME_UNLOCK_EMBER } from '@/engine';
import { DAY0, newGoal, yesDays } from '@/engine/__tests__/fixtures';
import { appStore, type RoundRecord } from '@/store';
import { DEFAULT_PERSISTED } from '@/store/migrate';
import { THEME_LOOKS, type ThemeLook } from '@/theme/themes';
import { MODE_COPY } from '@/ui/copy/modes';

jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
const mockRounds: { n: number; mode?: string; look: ThemeLook }[] = [];
jest.mock('@/game/GameCanvas', () => {
  const { createElement } = require('react');
  const { Text } = require('react-native');
  return {
    GameCanvas: (props: { round: { n: number; mode?: string }; look: ThemeLook }) => {
      mockRounds.push({ ...props.round, look: props.look });
      return createElement(Text, null, `Canvas: ${props.round.n} zeros`);
    },
  };
});
jest.mock('@/game/ResultSheet', () => ({ ResultSheet: () => null }));
jest.mock('@/game/sfx', () => ({ useSfx: () => () => {} }));

const ROUTES = {
  index: () => null,
  play: PlayScreen,
};

const goal = yesDays(newGoal(), DAY0, 3); // best 3: nothing earned yet
const dayRound: RoundRecord = {
  day: '2026-10-15',
  n: 3,
  rewards: { bomb: false, shield: false, shieldCapped: false, weapons: [], credits: [] },
  borrowed: [],
  played: false,
};
const looks = () => mockRounds.map((r) => r.look);

async function open(path: string) {
  await renderRouter(ROUTES, { initialUrl: path });
}

beforeAll(async () => {
  for (let i = 0; i < 50 && !appStore.getState().hydrated; i++) await new Promise((r) => setTimeout(r, 0));
});

beforeEach(async () => {
  mockRounds.length = 0;
  await AsyncStorage.clear();
  appStore.setState({ ...DEFAULT_PERSISTED, goals: [{ goal, round: dayRound, seenThrough: null }] });
});

describe('the theme in Win Zero Plus (SPEC 9)', () => {
  it("plays a day's round in the saved theme", async () => {
    appStore.setState({ theme: 'pastel' });
    await open('/play');
    expect(mockRounds.length).toBeGreaterThan(0);
    expect(looks().every((l) => l === THEME_LOOKS.pastel)).toBe(true);
  });

  it('plays a saved theme in Classic until it is earned', async () => {
    appStore.setState({ theme: 'ember' });
    await open('/play');
    expect(mockRounds.length).toBeGreaterThan(0);
    expect(looks().every((l) => l === THEME_LOOKS.classic)).toBe(true);
  });

  it('plays an earned theme by the shared best, whatever the streak now', async () => {
    appStore.setState({ theme: 'ember', arsenalBest: THEME_UNLOCK_EMBER });
    await open('/play');
    expect(mockRounds.length).toBeGreaterThan(0);
    expect(looks().every((l) => l === THEME_LOOKS.ember)).toBe(true);
  });

  it('tries on the theme a practice link names, earned or not', async () => {
    await open('/play?practice=60&theme=gold');
    expect(mockRounds.at(-1)?.n).toBe(60);
    expect(looks().every((l) => l === THEME_LOOKS.gold)).toBe(true);
  });

  it('wears the saved theme when a practice link names no theme it knows', async () => {
    appStore.setState({ theme: 'neon' });
    await open('/play?practice=60&theme=sepia');
    expect(mockRounds.at(-1)?.n).toBe(60);
    expect(looks().every((l) => l === THEME_LOOKS.neon)).toBe(true);
  });
});

describe('the game mode in Win Zero Plus (SPEC 9)', () => {
  it("plays a day's round in the saved mode, in its words", async () => {
    appStore.setState({ gameMode: 'catch' });
    await open('/play');
    expect(mockRounds.length).toBeGreaterThan(0);
    expect(mockRounds.every((r) => r.mode === 'catch')).toBe(true);
    expect(screen.getByText('Slide anywhere to catch the zeros', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Catcher: Twin Cups' })).toBeOnTheScreen();
  });

  it.each(PLAYABLE_MODES)('plays a practice round in the mode its link names, in its words: %s', async (mode) => {
    await open(`/play?practice=60&mode=${mode}`);
    expect(mockRounds.at(-1)?.n).toBe(60);
    expect(mockRounds.every((r) => r.mode === mode)).toBe(true);
    expect(screen.getByText(MODE_COPY[mode].hint, { includeHiddenElements: true })).toBeOnTheScreen();
  });

  it('leaves the saved pick alone when a practice link names a mode', async () => {
    await open('/play?practice=60&mode=catch');
    expect(mockRounds.at(-1)?.mode).toBe('catch');
    expect(appStore.getState().gameMode).toBeNull();
  });

  it('starts a new round when another practice link arrives mid-round', async () => {
    await open('/play?practice=60&mode=catch&theme=neon');
    await act(async () => router.navigate('/play?practice=60&mode=orbit&theme=gold'));
    expect(mockRounds.at(-1)?.mode).toBe('orbit');
    expect(mockRounds.at(-1)?.look).toBe(THEME_LOOKS.gold);
  });

  it('plays the saved mode when a practice link names a mode it doesn’t know', async () => {
    await open('/play?practice=60&mode=pong');
    expect(mockRounds.at(-1)?.n).toBe(60);
    expect(mockRounds.every((r) => r.mode === 'shooter')).toBe(true);
    expect(appStore.getState().gameMode).toBeNull();
  });
});

describe('a bonus round with several goals (SPEC 9)', () => {
  it('drops as many free bombs as every goal has banked', async () => {
    const run = { ...yesDays(newGoal(), DAY0, 3), goalId: 'g2', goal: 'Run', bombs: 3 };
    appStore.setState({
      goals: [
        { goal: { ...goal, bombs: 2 }, round: null, seenThrough: null },
        { goal: run, round: null, seenThrough: null },
      ],
      bonus: { n: 100, borrowed: [], played: false },
    });
    await open('/play?round=bonus');
    expect(screen.getByRole('button', { name: 'Bomb, 5 left' })).toBeOnTheScreen();
  });
});
