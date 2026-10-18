// The round's result sheet: what the round earned, Back to base and Replay, and Share for a
// milestone round only. The Skia scrim behind it is stood in for.
import { afterEach, beforeAll, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Share } from 'react-native';

import { DAY0, newGoal, yesDays } from '@/engine/__tests__/fixtures';
import { ResultSheet, type ResultMode } from '@/game/ResultSheet';
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

const round = (n: number, rewards: Partial<RoundRecord['rewards']>, played = false): RoundRecord => ({
  day: '2026-10-17',
  n,
  rewards: { bomb: false, shield: false, shieldCapped: false, weapons: [], credits: [], ...rewards },
  borrowed: [],
  played,
});

const show = (n: number, mode: ResultMode, record: RoundRecord | null) =>
  render(<ResultSheet n={n} mode={mode} record={record} onBack={() => {}} onReplay={() => {}} />);

beforeAll(async () => {
  for (let i = 0; i < 50 && !appStore.getState().hydrated; i++) await new Promise((r) => setTimeout(r, 0));
  appStore.setState({ goals: [{ goal: yesDays(newGoal(), DAY0, 5), round: null, seenThrough: null }], credits: { balance: { game: 1, weapon: 2 }, claimed: [] } });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('result sheet', () => {
  it('shares a milestone round, without the goal', async () => {
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction });
    await show(5, 'real', round(5, { bomb: true }));
    expect(screen.getByText('Bomb earned. You have 1.')).toBeOnTheScreen(); // day 5's bomb is in the goal
    await fireEvent.press(screen.getByRole('button', { name: 'Share this milestone' }));
    expect(share).toHaveBeenCalledWith({ message: 'Day 5 on Win Zero: 5 zeros down. I earned a bomb.' });
    expect(JSON.stringify(share.mock.calls)).not.toContain('Stop drinking');
  });

  it('shares a replay of a milestone round too', async () => {
    await show(7, 'replay', round(7, { shield: true, weapons: ['scatter'] }, true));
    expect(screen.getByRole('button', { name: 'Share this milestone' })).toBeOnTheScreen();
  });

  it('has nothing to share for an ordinary round or practice', async () => {
    await show(4, 'real', round(4, {}));
    expect(screen.getByRole('button', { name: 'Back to base' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Share this milestone' })).not.toBeOnTheScreen();

    await show(40, 'practice', null);
    expect(screen.queryByRole('button', { name: 'Share this milestone' })).not.toBeOnTheScreen();
  });

  it('shows the credits a Yes earned, but has nothing to share for them', async () => {
    await show(3, 'real', round(3, { credits: [{ kind: 'weapon', amount: 1, key: 'yes-run-3' }] }));
    expect(screen.getByText('Weapon credit earned for 3 Yeses in a row. You have 2.')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Share this milestone' })).not.toBeOnTheScreen();
  });

  it('names a bonus round and says it changes nothing', async () => {
    await show(250, 'bonus', null);
    expect(screen.getByText('Bonus round')).toBeOnTheScreen();
    expect(screen.getByText("Bonus round: your streak and rewards don't change.")).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Replay' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Share this milestone' })).not.toBeOnTheScreen();
  });
});
