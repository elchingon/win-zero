// @vitest-environment jsdom
// The popup revealing a Game credit after the round: what came in and why, the button ready for
// the keyboard, and the ways to move on to the result sheet.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { creditReveal } from '@/ui/copy/credits';

import { CreditPopup } from './CreditPopup';

afterEach(cleanup);

function show() {
  const onDismiss = vi.fn();
  render(<CreditPopup news={creditReveal([{ kind: 'game', amount: 1, key: 'zeros-3' }], 2)} onDismiss={onDismiss} />);
  return onDismiss;
}

describe('credit popup', () => {
  it('says what came in and why, with Nice! focused', () => {
    show();
    expect(screen.getByRole('dialog', { name: '+1 Game credit earned!' })).toBeTruthy();
    expect(screen.getByText('Earned for reaching 3 zeros.')).toBeTruthy();
    expect(screen.getByText(/^You now have 2 Game credits\./)).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Nice!' }));
  });

  it('is dismissed by its button, Escape, or a click on the zeros around it', () => {
    let onDismiss = show();
    fireEvent.click(screen.getByRole('button', { name: 'Nice!' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
    cleanup();

    onDismiss = show();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onDismiss).toHaveBeenCalledTimes(1);
    cleanup();

    onDismiss = show();
    fireEvent.click(screen.getByRole('dialog').parentElement!);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
