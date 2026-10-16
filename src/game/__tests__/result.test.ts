import { describe, expect, it } from '@jest/globals';

import { roundOverlay } from '../result';

describe('roundOverlay', () => {
  it('keeps the HUD up until the fill lands', () => {
    for (const mode of ['real', 'replay', 'practice'] as const) {
      expect(roundOverlay(false, mode, false)).toBe('hud');
    }
  });

  it('cheers a real round or a replay, then shows the sheet once dismissed', () => {
    for (const mode of ['real', 'replay'] as const) {
      expect(roundOverlay(true, mode, false)).toBe('cheer');
      expect(roundOverlay(true, mode, true)).toBe('sheet');
    }
  });

  it('goes straight to the sheet after practice', () => {
    expect(roundOverlay(true, 'practice', false)).toBe('sheet');
  });
});
