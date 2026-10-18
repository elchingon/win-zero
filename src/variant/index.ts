// Which app this build is: Win Zero, or Win Zero Plus (SPEC 9), from EXPO_PUBLIC_APP_VARIANT,
// the same variable app.config.ts reads. App code only: the website and the files it shares never
// read the variant (there's no process.env in its bundle). They take names and limits as
// parameters, and the app passes these.
//
// Release builds inline the variable, so a literal comparison folds away per file. To leave
// Plus-only code out of the free bundle, gate it where it's required:
//   const X = process.env.EXPO_PUBLIC_APP_VARIANT === 'plus' ? require('@/plus/x') : null;
// IS_PLUS works the same at runtime, but whatever it guards stays in the bundle.
import { FREE_LIMITS, PLUS_LIMITS, type Limits } from '@/store/limits';
import { FREE_APP_NAME } from '@/ui/copy/app';

export type Variant = 'free' | 'plus';

export const PLUS_APP_NAME = 'Win Zero Plus';

export const VARIANT: Variant = process.env.EXPO_PUBLIC_APP_VARIANT === 'plus' ? 'plus' : 'free';
export const IS_PLUS = VARIANT === 'plus';

/** The app's name in copy: Settings, setup, sharing, support email. */
export const APP_NAME = IS_PLUS ? PLUS_APP_NAME : FREE_APP_NAME;
/** The name as the top bar and check-in card set it. */
export const APP_WORDMARK = APP_NAME.toUpperCase();

/** What this app allows: Plus keeps up to three goals, on chosen weekdays (SPEC 9). */
export const LIMITS: Limits = IS_PLUS ? PLUS_LIMITS : FREE_LIMITS;
