// @vitest-environment jsdom
// The question before a round: each weapon not yet unlocked to borrow, with the keyboard starting
// on Not this time, and the ways to go on without one.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { lockedWeapons, weaponById } from '@/engine';
import { WEAPON_PROMPT } from '@/ui/copy/credits';

import { WeaponCreditPrompt } from './WeaponCreditPrompt';

afterEach(cleanup);

function show(credits = 2) {
  const onPick = vi.fn();
  const onSkip = vi.fn();
  render(<WeaponCreditPrompt offer={lockedWeapons(13)} credits={credits} onPick={onPick} onSkip={onSkip} />);
  return { onPick, onSkip };
}

describe('weapon credit prompt', () => {
  it('asks, lists each weapon not yet unlocked, and starts the keyboard on Not this time', () => {
    show(2);
    expect(screen.getByRole('dialog', { name: 'Use a Weapon credit?' })).toBeTruthy();
    expect(screen.getByText(/^You have 2 Weapon credits\./)).toBeTruthy();
    for (const id of ['rocket', 'chain', 'laser', 'nuke'] as const) {
      expect(screen.getByRole('button', { name: WEAPON_PROMPT.option(weaponById(id)) })).toBeTruthy();
    }
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Not this time' }));
  });

  it('borrows the weapon picked', () => {
    const { onPick, onSkip } = show(1);
    fireEvent.click(screen.getByRole('button', { name: WEAPON_PROMPT.option(weaponById('chain')) }));
    expect(onPick).toHaveBeenCalledWith('chain');
    expect(onSkip).not.toHaveBeenCalled();
  });

  it('goes on without one on Not this time, Escape, or a click outside the card', () => {
    const ways = [
      () => fireEvent.click(screen.getByRole('button', { name: 'Not this time' })),
      () => fireEvent.keyDown(window, { key: 'Escape' }),
      () => fireEvent.click(screen.getByRole('dialog').parentElement!),
    ];
    for (const dismiss of ways) {
      const { onSkip, onPick } = show();
      dismiss();
      expect(onSkip).toHaveBeenCalledTimes(1);
      expect(onPick).not.toHaveBeenCalled();
      cleanup();
    }
  });
});
