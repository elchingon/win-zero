// Win Zero Plus's question before a round: which game to play it in, each a button with its hint
// and power-up, the last pick marked. Tapping one picks it; Android's back button plays the last pick.
import './env/plus';

import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { BackHandler } from 'react-native';

import { availableModes, MODES } from '@/engine';
import { MODE_PICKER } from '@/plus/copy';
import { ModePicker } from '@/plus/play/ModePicker';

jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

function show() {
  const onPick = jest.fn();
  const r = render(<ModePicker modes={availableModes(3, { modesEnabled: true })} current="catch" weapon="twin" onPick={onPick} />);
  return { r, onPick };
}

describe('game picker (SPEC 9)', () => {
  it('asks, and lists every game with its hint and power-up, the last pick marked', async () => {
    await show().r;
    expect(screen.getByRole('header', { name: MODE_PICKER.title })).toBeOnTheScreen();
    expect(screen.getAllByRole('button')).toHaveLength(MODES.length);
    expect(
      screen.getByRole('button', { name: 'Catch, your last pick. Slide anywhere to catch the zeros. Catcher: Twin Cups.' }),
    ).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Shooter. Tap to shoot · hold to keep firing. Weapon: Twin Barrel.' })).toBeOnTheScreen();
    expect(screen.getByText('Last pick')).toBeOnTheScreen();
  });

  it('picks the game tapped', async () => {
    const { r, onPick } = show();
    await r;
    await fireEvent.press(screen.getByRole('button', { name: /^Breaker\./ }));
    expect(onPick).toHaveBeenCalledWith('breaker');
  });

  it("plays the last pick on Android's back button", async () => {
    let back: (() => boolean | null | undefined) | undefined;
    jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_event, handler) => {
      back = () => handler({} as Parameters<typeof handler>[0]);
      return { remove: () => {} };
    });
    const { r, onPick } = show();
    await r;
    expect(back?.()).toBe(true);
    expect(onPick).toHaveBeenCalledWith('catch');
  });
});
