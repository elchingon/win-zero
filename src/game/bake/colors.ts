// The colors a theme bakes the round in: the ring rows, the shots and the fill's glow. Plain
// data, so a test can hold Classic to the exact colors the bake drew before themes. The rest of
// the sheet (badges, highlights, bullet heads) and the backdrop keep the section 7 palette.
import { withAlpha } from '@/theme/tokens';
import type { ThemeLook } from '@/theme/themes';

import { BULLET_LOOKS, FILL_GLOW_ALPHA, type BulletLook } from '../look';

export interface BakeColors {
  /** A ring per palette slot; particles, shockwaves and fill glyphs are tinted from it too. */
  palette: readonly string[];
  /** BULLET_LOOKS in the theme's shot colors. */
  bullets: readonly BulletLook[];
  /** The fill's glow, middle to edge, with its alpha. */
  fillGlow: readonly [string, string];
  /** The big number over a fill too large to draw. */
  overlay: string;
  /** The usual shot: the turret, its muzzle flash and the laser. */
  shot: string;
  /** The chain shot's bolts. */
  chain: string;
}

export function bakeColors(look: ThemeLook): BakeColors {
  const [mid, edge] = look.fillGlow;
  return {
    palette: look.palette,
    bullets: BULLET_LOOKS.map((b, i) => ({ ...b, color: look.shots[i] ?? b.color })),
    fillGlow: [withAlpha(mid, FILL_GLOW_ALPHA), withAlpha(edge, 0)],
    overlay: look.palette[0],
    shot: look.shots[0],
    chain: look.shots[1],
  };
}
