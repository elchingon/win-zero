// The round's HUD on its own: the mode's hint, and how it fades.
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import * as Reanimated from 'react-native-reanimated';

import { Hud } from '@/game/Hud';

jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);

const show = (props: Partial<Parameters<typeof Hud>[0]> = {}) =>
  render(
    <Hud
      left={5}
      total={5}
      label="DAY 5"
      mode="shooter"
      tierName="Pea Shooter"
      canSwitch={false}
      onSwitchWeapon={() => {}}
      bombs={1}
      bombEnabled
      onBomb={() => {}}
      sound
      onToggleSound={() => {}}
      onQuit={() => {}}
      controls
      hintKey={1}
      {...props}
    />,
  );

afterEach(() => {
  jest.restoreAllMocks();
});

describe('the hint', () => {
  it('fades after its delay even under reduce motion, which would skip the delay', async () => {
    const withDelay = jest.spyOn(Reanimated, 'withDelay');
    await show();
    expect(withDelay).toHaveBeenCalledWith(expect.any(Number), expect.anything(), Reanimated.ReduceMotion.Never);
  });

  it("shows the mode's hint", async () => {
    await show({ mode: 'catch' });
    expect(screen.getByText('Slide anywhere to catch the zeros', { includeHiddenElements: true })).toBeOnTheScreen();
  });
});
