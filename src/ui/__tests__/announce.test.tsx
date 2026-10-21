// A field's error is said aloud when it appears or changes, without moving focus.
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import { Field, TextField } from '../bits';

function Count({ error }: { error: string | null }) {
  return (
    <Field label="Zeros" hint="From 1 to 100,000" error={error}>
      <TextField accessibilityLabel="Zeros" />
    </Field>
  );
}

/** React Native's jest setup already mocks it, so a spy keeps earlier tests' calls: start clean. */
function spy() {
  const say = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
  say.mockClear();
  return say;
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe('Field', () => {
  it('says a new error aloud, once, and each new one after it', async () => {
    const say = spy();
    await render(<Count error={null} />);
    expect(say).not.toHaveBeenCalled();

    await screen.rerender(<Count error="A whole number, please." />);
    expect(say).toHaveBeenCalledTimes(1);
    expect(say).toHaveBeenLastCalledWith('A whole number, please.');

    // Re-rendered with the same error: nothing new to say.
    await screen.rerender(<Count error="A whole number, please." />);
    expect(say).toHaveBeenCalledTimes(1);

    await screen.rerender(<Count error={null} />);
    await screen.rerender(<Count error="A whole number, please." />);
    expect(say).toHaveBeenCalledTimes(2);
  });

  it("doesn't speak over a screen that opens with an error showing", async () => {
    const say = spy();
    await render(<Count error="A whole number, please." />);
    expect(screen.getByText('A whole number, please.')).toBeOnTheScreen();
    expect(say).not.toHaveBeenCalled();
  });
});
