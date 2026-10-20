// What the bake draws a theme in. Classic must be exactly what the bake drew before themes, so
// Win Zero's round is unchanged; every theme keeps the sprite sheet's layout.
import { describe, expect, it } from '@jest/globals';

import { THEME_LOOKS } from '@/theme/themes';
import { colors, withAlpha, zeroPalette } from '@/theme/tokens';

import { BULLET_LOOKS, FILL_GLOW_ALPHA } from '../../look';
import { bakeColors } from '../colors';

describe('bake colors', () => {
  it('bakes Classic in exactly the colors the round had before themes', () => {
    expect(bakeColors(THEME_LOOKS.classic)).toEqual({
      palette: zeroPalette,
      bullets: BULLET_LOOKS,
      fillGlow: [withAlpha(colors.amber, FILL_GLOW_ALPHA), withAlpha(colors.flare, 0)],
      overlay: colors.amber,
      shot: colors.amber,
      chain: colors.teal,
    });
    expect(bakeColors(THEME_LOOKS.classic).fillGlow).toEqual(['rgba(255, 181, 46, 0.22)', 'rgba(255, 79, 109, 0)']);
  });

  it('keeps the sheet the same shape in every theme: four rings, and the same three shots', () => {
    const shape = BULLET_LOOKS.map(({ tail, width, head }) => ({ tail, width, head }));
    for (const [id, look] of Object.entries(THEME_LOOKS)) {
      const c = bakeColors(look);
      expect({ id, rings: c.palette.length }).toEqual({ id, rings: zeroPalette.length });
      expect(c.bullets.map(({ tail, width, head }) => ({ tail, width, head }))).toEqual(shape);
      expect(c.bullets.map((b) => b.color)).toEqual(look.shots);
      expect([c.shot, c.chain, c.overlay]).toEqual([look.shots[0], look.shots[1], look.palette[0]]);
    }
  });
});
