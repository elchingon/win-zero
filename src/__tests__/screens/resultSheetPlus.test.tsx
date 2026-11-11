// Win Zero Plus's result sheet (SPEC 9): an earned theme announced like a weapon, with its icon,
// power-ups named by the round's game mode, and a milestone shared as a picture of the round's
// zeros, or as words when the picture can't be made. Nothing on it is for sale.
import './env/plus';

import { beforeAll, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Share } from 'react-native';

import { DAY0, newGoal, yesDays } from '@/engine/__tests__/fixtures';
import { ResultSheet } from '@/game/ResultSheet';
import { appStore, type RoundRecord } from '@/store';

jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
/** Whether the card's fonts have loaded: until they have, the card can't be drawn. */
const mockFonts = { loaded: false };
jest.mock('@shopify/react-native-skia', () => ({
  Canvas: () => null,
  LinearGradient: () => null,
  Rect: () => null,
  vec: () => ({ x: 0, y: 0 }),
  useFont: () => (mockFonts.loaded ? {} : null),
}));
/** The card, as drawn: some bytes, or nothing when Skia can't make it. */
const mockCard: { png: Uint8Array | null; words: unknown[] } = { png: null, words: [] };
jest.mock('@/plus/share/render', () => ({
  renderCard: (_n: number, _look: unknown, _fonts: unknown, words: unknown) => {
    mockCard.words.push(words);
    return mockCard.png;
  },
}));
/** What reached the cache folder. */
const mockFiles: { name: string; bytes: Uint8Array }[] = [];
jest.mock('expo-file-system', () => ({
  Paths: { cache: { uri: 'file:///cache/' } },
  File: class {
    name: string;
    uri: string;
    contentUri: string;
    constructor(_dir: unknown, name: string) {
      this.name = name;
      this.uri = `file:///cache/${name}`;
      this.contentUri = `content://cache/${name}`;
    }
    create() {}
    write(bytes: Uint8Array) {
      mockFiles.push({ name: this.name, bytes });
    }
  },
}));

/** Day 30, the Yes that opened the Chain Zapper and Ember. */
const day30: RoundRecord = {
  day: DAY0,
  n: 30,
  rewards: { bomb: true, shield: false, shieldCapped: false, weapons: ['chain'], credits: [] },
  borrowed: [],
  played: false,
  unlocks: ['ember'],
};

beforeAll(async () => {
  for (let i = 0; i < 50 && !appStore.getState().hydrated; i++) await new Promise((r) => setTimeout(r, 0));
  appStore.setState({ goals: [{ goal: yesDays(newGoal(), DAY0, 1), round: null, seenThrough: null }], arsenalBest: 30 });
});

describe('the result sheet in Win Zero Plus', () => {
  it('announces an earned theme like a weapon, and that its icon opened too', async () => {
    await render(<ResultSheet n={30} mode="real" goalId="g1" record={day30} onBack={() => {}} onReplay={() => {}} />);
    expect(screen.getByText('New weapon unlocked: Chain Zapper. Lightning jumps to 4 more zeros.')).toBeOnTheScreen();
    expect(screen.getByText('New theme unlocked: Ember. Its app icon is unlocked too.')).toBeOnTheScreen();
    expect(screen.queryByText(/\$|buy|price|purchase|store/i)).not.toBeOnTheScreen();
  });

  it('names power-ups by the game the round was played in', async () => {
    await render(
      <ResultSheet n={30} mode="real" goalId="g1" record={day30} gameMode="catch" onBack={() => {}} onReplay={() => {}} />,
    );
    expect(screen.getByText('New catcher unlocked: Chain Catch.')).toBeOnTheScreen();
    expect(screen.getByText(/^Hold the line \d+ more days for your next catcher: Vacuum Beam\.$/)).toBeOnTheScreen();
  });

  it('shares the milestone in the words of the game it was played in', async () => {
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' });
    await render(
      <ResultSheet n={30} mode="real" goalId="g1" record={day30} gameMode="catch" onBack={() => {}} onReplay={() => {}} />,
    );
    await fireEvent.press(screen.getByRole('button', { name: /Share/ }));
    expect(share).toHaveBeenCalledWith({
      message: 'Day 30 on Win Zero Plus: 30 zeros down. I beat the boss, unlocked a new catcher, Chain Catch, and earned a bomb.',
    });
  });

  it('shares a picture of the round’s zeros on iPhone, with its words drawn on it', async () => {
    mockFonts.loaded = true;
    mockCard.png = new Uint8Array([137, 80, 78, 71]);
    mockCard.words.length = 0;
    mockFiles.length = 0;
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' });
    try {
      await render(<ResultSheet n={30} mode="real" goalId="g1" record={day30} gameMode="catch" onBack={() => {}} onReplay={() => {}} />);
      await fireEvent.press(screen.getByRole('button', { name: 'Share this milestone' }));
      expect(mockCard.words).toEqual([
        { day: 'DAY 30', zeros: '30 zeros down', did: 'Beat the boss, unlocked a new catcher, Chain Catch, and earned a bomb.', footer: 'WIN ZERO PLUS · winzero.app' },
      ]);
      expect(mockFiles).toEqual([{ name: 'win-zero-milestone.png', bytes: mockCard.png }]);
      expect(share).toHaveBeenCalledWith({ url: 'file:///cache/win-zero-milestone.png' });
    } finally {
      mockFonts.loaded = false;
      mockCard.png = null;
    }
  });

  it('shares the words instead when the picture can’t be made', async () => {
    mockFonts.loaded = true;
    mockCard.png = null;
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' });
    try {
      await render(<ResultSheet n={30} mode="real" goalId="g1" record={day30} onBack={() => {}} onReplay={() => {}} />);
      await fireEvent.press(screen.getByRole('button', { name: 'Share this milestone' }));
      expect(share).toHaveBeenCalledWith({ message: 'Day 30 on Win Zero Plus: 30 zeros down. I beat the boss, unlocked the Chain Zapper and earned a bomb.' });
    } finally {
      mockFonts.loaded = false;
    }
  });
});
