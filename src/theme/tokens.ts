// Visual identity from SPEC section 7, measured off docs/prototype/win-zero.html.
// Plain data only: shared by React Native styles and the Skia game canvas.

export const colors = {
  ink: '#0D1130',
  ink2: '#151A44',
  panel: '#1B2150',
  panel2: '#252C68',
  line: '#353D80',
  fg: '#F5F0E6',
  muted: '#AAB0D8',
  amber: '#FFB52E', // primary
  amberDeep: '#B9770A',
  flare: '#FF4F6D', // danger, bombs
  teal: '#3FDCCB', // weapons, success
} as const;

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
