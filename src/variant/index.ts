// Which app this build is: Win Zero, or Win Zero Plus (SPEC 9), from EXPO_PUBLIC_APP_VARIANT,
// the same variable app.config.ts reads. App code only: the website and the files it shares never
// read the variant (there's no process.env in its bundle). They take names and limits as
// parameters, and the app passes these.
//
// Release builds inline the variable, so a literal comparison folds away per file. To leave
// Plus-only code out of the free bundle, gate it where it's required:
//   const X = process.env.EXPO_PUBLIC_APP_VARIANT === 'plus' ? require('@/plus/x') : null;
// IS_PLUS works the same at runtime, but whatever it guards stays in the bundle.
import { Platform } from 'react-native';

import { FREE_LIMITS, PLUS_LIMITS, type Limits } from '@/store/limits';
import { FREE_APP_NAME } from '@/ui/copy/app';
import { linkFrom } from '@/ui/support';

export type Variant = 'free' | 'plus';

export const PLUS_APP_NAME = 'Win Zero Plus';

export const VARIANT: Variant = process.env.EXPO_PUBLIC_APP_VARIANT === 'plus' ? 'plus' : 'free';
export const IS_PLUS = VARIANT === 'plus';

/** The app's name in copy: Settings, setup, sharing, support email. */
export const APP_NAME = IS_PLUS ? PLUS_APP_NAME : FREE_APP_NAME;
/** The name as the top bar and check-in card set it. */
export const APP_WORDMARK = APP_NAME.toUpperCase();

/** What this app allows: Plus keeps up to three goals, on chosen weekdays, in any game mode, theme and icon (SPEC 9). */
export const LIMITS: Limits = IS_PLUS ? PLUS_LIMITS : FREE_LIMITS;

/** What each app offers (SPEC 9): Win Zero sends the move and Plus takes it in; Plus has game modes, themes and icons. */
export const FEATURES = {
  moveOut: !IS_PLUS,
  importIn: IS_PLUS,
  /** Goals check in on chosen weekdays, with rest days between (LIMITS). */
  schedules: LIMITS.weekdaySchedules,
  /** Settings › Games: the modes beyond the Shooter, as the store allows them (LIMITS). */
  extraModes: LIMITS.modesEnabled,
  /** Settings › Themes, and a practice round's theme link, as the store allows them (LIMITS). */
  themes: LIMITS.themesEnabled,
  /** Settings › App icon, and the debug section's icon chips, as the store allows them (LIMITS). */
  altIcons: LIMITS.iconsEnabled,
} as const;

/** On iPhone, the folder only the two apps share (an App Group, in app.json): a move waits there. */
export const APP_GROUP = 'group.com.e7systems.winzero';

export interface Peer {
  /** Its URL scheme. */
  scheme: string;
  /** On Android, its package and the activity a move is handed to. */
  package: string;
  activity: string;
}

const FREE_PEER: Peer = {
  scheme: 'winzero',
  package: 'com.e7systems.winzero',
  activity: 'com.e7systems.winzero.MainActivity',
};
const PLUS_PEER: Peer = {
  scheme: 'winzeroplus',
  package: 'com.e7systems.winzeroplus',
  activity: 'com.e7systems.winzeroplus.MainActivity',
};

/** The other app: Win Zero Plus for Win Zero, and Win Zero for Plus. */
export const PEER: Peer = IS_PLUS ? FREE_PEER : PLUS_PEER;

/**
 * Win Zero Plus's store page on this platform, once Plus is on the store: until then Win Zero
 * doesn't offer the move. Set like the privacy page (.env locally, each profile's env in eas.json).
 */
export const PLUS_STORE_URL: string | null =
  Platform.select({
    // Written out in full: Expo inlines only literal `process.env.EXPO_PUBLIC_*` reads.
    ios: linkFrom(process.env.EXPO_PUBLIC_PLUS_STORE_URL_IOS),
    android: linkFrom(process.env.EXPO_PUBLIC_PLUS_STORE_URL_ANDROID),
  }) ?? null;
