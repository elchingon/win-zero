// Each theme's colors for the round and Home's drifting zeros (SPEC 9). Classic is the section 7
// palette; the rest of the app keeps it whatever the theme. Plain data only. Every color keeps
// readable contrast against the round's backdrop (ink to ink-2), which the tests check.
import type { ThemeId } from '@/engine';

import { colors, zeroPalette } from './tokens';

export interface ThemeLook {
  /**
   * Ring colors by palette slot, in tokens.zeroPalette's roles: primary, danger, weapon, light.
   * Particles, shockwaves and fill glyphs take them too. Slot 3 is also the hit flash, so it's
   * the lightest.
   */
  palette: readonly [string, string, string, string];
  /**
   * Shots in BULLET_LOOKS order: the usual one (also the turret, its muzzle flash and the laser),
   * the chain shot (and its bolts), and the big shot.
   */
  shots: readonly [string, string, string];
  /** The fill's glow: its middle color, drawn at FILL_GLOW_ALPHA, and the color it fades out to. */
  fillGlow: readonly [string, string];
}

export const THEME_LOOKS: Readonly<Record<ThemeId, ThemeLook>> = {
  classic: {
    palette: zeroPalette,
    shots: [colors.amber, colors.teal, colors.flare],
    fillGlow: [colors.amber, colors.flare],
  },
  neon: {
    palette: ['#FF3DCB', '#FFE45C', '#2EE6FF', '#F1EDFF'],
    shots: ['#FF3DCB', '#2EE6FF', '#FFE45C'],
    fillGlow: ['#FF3DCB', '#2EE6FF'],
  },
  mono: {
    palette: ['#39FF6E', '#1FB85A', '#8CFFAE', '#E0FFE8'],
    shots: ['#39FF6E', '#8CFFAE', '#1FB85A'],
    fillGlow: ['#39FF6E', '#1FB85A'],
  },
  pastel: {
    palette: ['#FFC7A6', '#FF9EBD', '#A6EBD6', '#FFF7EE'],
    shots: ['#FFC7A6', '#A6EBD6', '#FF9EBD'],
    fillGlow: ['#FFC7A6', '#FF9EBD'],
  },
  ember: {
    palette: ['#FF8A1F', '#FF3B30', '#FFD447', '#FFEBD6'],
    shots: ['#FF8A1F', '#FFD447', '#FF3B30'],
    fillGlow: ['#FF8A1F', '#FF3B30'],
  },
  aurora: {
    palette: ['#4DFFB4', '#FF5CCF', '#6AA9FF', '#E6F6FF'],
    shots: ['#4DFFB4', '#6AA9FF', '#FF5CCF'],
    fillGlow: ['#4DFFB4', '#8B5CFF'],
  },
  gold: {
    palette: ['#FFD24D', '#FF8F6B', '#F3E3B0', '#FFFDF4'],
    shots: ['#FFD24D', '#F3E3B0', '#FF8F6B'],
    fillGlow: ['#FFD24D', '#B9770A'],
  },
};
