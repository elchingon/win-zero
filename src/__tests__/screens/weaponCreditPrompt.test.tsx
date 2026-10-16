// The question before a round: the weapons a Weapon credit could lend, each a button, and Not
// this time.
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { lockedWeapons, weaponById } from '@/engine';
import { WeaponCreditPrompt } from '@/game/WeaponCreditPrompt';
import { WEAPON_PROMPT } from '@/ui/copy/credits';

jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

function show(credits = 2) {
  const onPick = jest.fn();
  const onSkip = jest.fn();
  const r = render(<WeaponCreditPrompt offer={lockedWeapons(13)} credits={credits} onPick={onPick} onSkip={onSkip} />);
  return { r, onPick, onSkip };
}

describe('weapon credit prompt', () => {
  it('asks, with how many credits there are, and lists each weapon not yet unlocked', async () => {
    await show(2).r;
    expect(screen.getByRole('header', { name: 'Use a Weapon credit?' })).toBeOnTheScreen();
    expect(screen.getByText(/^You have 2 Weapon credits\./)).toBeOnTheScreen();
    for (const id of ['rocket', 'chain', 'laser', 'nuke'] as const) {
      expect(screen.getByRole('button', { name: WEAPON_PROMPT.option(weaponById(id)) })).toBeOnTheScreen();
    }
    expect(screen.queryByText('Scatter Gun')).not.toBeOnTheScreen();
  });

  it('borrows the weapon picked', async () => {
    const { r, onPick, onSkip } = show(1);
    await r;
    expect(screen.getByText(/^You have 1 Weapon credit\./)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: WEAPON_PROMPT.option(weaponById('chain')) }));
    expect(onPick).toHaveBeenCalledWith('chain');
    expect(onSkip).not.toHaveBeenCalled();
  });

  it('lets the player go on without one', async () => {
    const { r, onPick, onSkip } = show();
    await r;
    await fireEvent.press(screen.getByRole('button', { name: 'Not this time' }));
    expect(onSkip).toHaveBeenCalledTimes(1);
    expect(onPick).not.toHaveBeenCalled();
  });
});
