// The UI palette (SPEC 7): control edges stand out from every surface they sit on.
import { describe, expect, it } from '@jest/globals';

import { colors } from '../tokens';
import { contrast } from './contrast';

/** WCAG 1.4.11: the edges of controls, and marks that carry meaning, need 3:1 against what's next to them. */
const MIN_NON_TEXT = 3;

/** Every surface a control sits on: screens, panels, the check-in card, sheets and picker rows. */
const SURFACES = { ink: colors.ink, ink2: colors.ink2, panel: colors.panel, panel2: colors.panel2, card: colors.card };

describe('the UI palette', () => {
  it.each(Object.entries(SURFACES))('gives control edges 3:1 or more on %s', (_name, surface) => {
    expect(contrast(colors.edge, surface)).toBeGreaterThanOrEqual(MIN_NON_TEXT);
  });

  it('keeps line for dividers only: it is too faint to be the edge of a control', () => {
    expect(contrast(colors.line, colors.ink)).toBeLessThan(MIN_NON_TEXT);
  });
});
