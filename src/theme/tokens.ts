// Visual identity from SPEC section 7, measured off docs/prototype/win-zero.html.
// Plain data only: shared by React Native styles and the Skia game canvas.
import type { HighlightKind } from '@/engine';

export const colors = {
  ink: '#0D1130',
  ink2: '#151A44',
  panel: '#1B2150',
  panel2: '#252C68',
  line: '#353D80', // dividers and containers
  edge: '#7078BC', // edges of controls, and marks that carry meaning: 3:1 or more on every surface
  fg: '#F5F0E6',
  muted: '#AAB0D8',
  amber: '#FFB52E', // primary
  amberDeep: '#B9770A',
  flare: '#FF4F6D', // danger, bombs
  teal: '#3FDCCB', // weapons, success
  card: '#2B2F54', // check-in card: color-mix(fg 10%, ink-2)
} as const;

/** A palette color at `opacity`, as rgba(). */
export function withAlpha(hex: string, opacity: number): string {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${opacity})`;
}

/** Celebration panels' icons (SPEC 6): an SVG path each, on a CELEBRATION_MARK_BOX square. */
export const CELEBRATION_MARK_BOX = 24;
export const CELEBRATION_MARKS: Record<HighlightKind, string> = {
  shield: 'M12 2 L20 5 V11 C20 16.5 16.6 20.4 12 22 C7.4 20.4 4 16.5 4 11 V5 Z',
  weapon: 'M13.5 2 L5 13.5 H11 L9.5 22 L19 9.5 H12.5 Z',
  theme: 'M12 2 L14.4 9.6 L22 12 L14.4 14.4 L12 22 L9.6 14.4 L2 12 L9.6 9.6 Z',
  bomb: 'M11 6.5 A7.5 7.5 0 1 0 11 21.5 A7.5 7.5 0 1 0 11 6.5 Z M15 6 L18 3 L20 5 L17 8 Z',
};

/** Rotating ring colors for zeros, in prototype order. */
export const zeroPalette = [colors.amber, colors.flare, colors.teal, colors.fg] as const;

/** Font family names as registered by useFonts (see fonts.ts). */
export const fonts = {
  display: 'Bungee_400Regular',
  body: 'Barlow_400Regular',
  bodyMedium: 'Barlow_500Medium',
  bodySemiBold: 'Barlow_600SemiBold',
  bodyBold: 'Barlow_700Bold',
  mono: 'JetBrainsMono_500Medium',
  monoSemiBold: 'JetBrainsMono_600SemiBold',
} as const;

export type FontFamily = (typeof fonts)[keyof typeof fonts];

export const radii = {
  sm: 10, // small buttons
  md: 12, // inputs, HUD buttons
  lg: 14, // buttons, stat tiles
  xl: 18, // waiting card
  xxl: 22, // check-in card
  pill: 999,
} as const;

export const space = {
  xxs: 4,
  xs: 6,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20, // screen gutter
  xxl: 22, // gap between screen sections
  xxxl: 40,
} as const;

/** CSS letter-spacing is in em; React Native wants points. */
const em = (size: number, value: number) => Math.round(size * value * 100) / 100;

/** Text presets ported from the prototype's CSS classes. */
export const type = {
  h1: { fontFamily: fonts.display, fontSize: 36, lineHeight: 38, color: colors.fg },
  h2: { fontFamily: fonts.display, fontSize: 30, lineHeight: 32, color: colors.fg },
  body: { fontFamily: fonts.body, fontSize: 16, lineHeight: 23, color: colors.fg },
  lede: { fontFamily: fonts.body, fontSize: 16, lineHeight: 23, color: colors.muted },
  goal: { fontFamily: fonts.bodyBold, fontSize: 26, lineHeight: 30, color: colors.fg },
  question: { fontFamily: fonts.bodyBold, fontSize: 19, lineHeight: 24, color: colors.fg },
  eyebrow: {
    fontFamily: fonts.monoSemiBold,
    fontSize: 11,
    letterSpacing: em(11, 0.14),
    textTransform: 'uppercase',
    color: colors.muted,
  },
  fine: { fontFamily: fonts.mono, fontSize: 12, lineHeight: 18, color: colors.muted },
  statValue: { fontFamily: fonts.display, fontSize: 32, lineHeight: 34, color: colors.fg },
  statLabel: {
    fontFamily: fonts.monoSemiBold,
    fontSize: 10,
    letterSpacing: em(10, 0.12),
    textTransform: 'uppercase',
    color: colors.muted,
  },
  button: { fontFamily: fonts.display, fontSize: 16, letterSpacing: em(16, 0.03) },
  hudCount: { fontFamily: fonts.display, fontSize: 34, color: colors.amber },
  hudLabel: { fontFamily: fonts.monoSemiBold, fontSize: 12, letterSpacing: em(12, 0.08), color: colors.muted },
} as const;

/**
 * Dynamic type: text follows the OS text size, except where a fixed layout can't grow with it.
 * These are maxFontSizeMultiplier values.
 */
export const fontScale = {
  /** The HUD, which sits in bands the round keeps clear, and the result sheet's title. */
  overlay: 1.3,
  /** Calendar dates, in a seven-column grid. */
  calendarDate: 1.5,
  /** Above this OS text size, a pair of buttons stacks rather than shrinking its labels. */
  stackButtons: 1.3,
} as const;
