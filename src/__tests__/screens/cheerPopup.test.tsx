// The encouragement over the filled screen: one of the lines, and Got it to move on.
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { CheerPopup } from '@/game/CheerPopup';
import { CHEERS } from '@/ui/copy/cheers';

jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

const shown = () => CHEERS.filter((line) => screen.queryByText(line));

describe('cheer popup', () => {
  it('shows one line of encouragement, and Got it dismisses it', async () => {
    const onDismiss = jest.fn();
    await render(<CheerPopup onDismiss={onDismiss} />);
    expect(shown()).toHaveLength(1);
    await fireEvent.press(screen.getByRole('button', { name: 'Got it' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('shows a different line next time', async () => {
    const first = await render(<CheerPopup onDismiss={() => {}} />);
    const before = shown();
    await first.unmount();
    await render(<CheerPopup onDismiss={() => {}} />);
    expect(shown()).toHaveLength(1);
    expect(shown()).not.toEqual(before);
  });
});
