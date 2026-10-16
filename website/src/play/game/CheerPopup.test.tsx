// @vitest-environment jsdom
// The encouragement over the filled screen: one line, Got it ready for the keyboard, and the
// ways to move on to the result sheet.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CHEERS } from '@/ui/copy/cheers';

import { CheerPopup } from './CheerPopup';

afterEach(cleanup);

function show() {
  const onDismiss = vi.fn();
  render(<CheerPopup onDismiss={onDismiss} />);
  return onDismiss;
}

describe('cheer popup', () => {
  it('shows one line of encouragement, with Got it focused', () => {
    show();
    const line = document.getElementById('cheer-text')?.textContent ?? '';
    expect(CHEERS).toContain(line);
    expect(screen.getByRole('dialog', { name: line })).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Got it' }));
  });

  it('is dismissed by Got it, Escape, or a click on the zeros around it', () => {
    let onDismiss = show();
    fireEvent.click(screen.getByRole('button', { name: 'Got it' }));
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

  it('stays up for a click on the card itself or another key', () => {
    const onDismiss = show();
    fireEvent.click(screen.getByRole('dialog'));
    fireEvent.click(document.getElementById('cheer-text')!);
    fireEvent.keyDown(window, { key: 'a' });
    expect(onDismiss).not.toHaveBeenCalled();
  });
});
