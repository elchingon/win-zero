// Win Zero Plus's result sheet (SPEC 9): an earned theme announced like a weapon, with its icon,
// and power-ups named by the round's game mode. Nothing on it is for sale.
import './env/plus';

import { beforeAll, describe, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';

import { DAY0, newGoal, yesDays } from '@/engine/__tests__/fixtures';
import { ResultSheet } from '@/game/ResultSheet';
import { appStore, type RoundRecord } from '@/store';

jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('@shopify/react-native-skia', () => ({
  Canvas: () => null,
  LinearGradient: () => null,
  Rect: () => null,
  vec: () => ({ x: 0, y: 0 }),
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
});
