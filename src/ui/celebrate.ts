// The app's one Yes celebration (src/game/yes.ts). Home runs a Yes tap's answer inside `armed`,
// Home's routing asks `begin()` how long to hold the round back, and the overlay at the root
// (YesCelebration) draws the show. Kept apart from the overlay, so Home needn't load Skia.
import { createYesCelebration } from '@/game/yes';

export const yesCelebration = createYesCelebration();

/**
 * How the round's screen comes and goes: at once while the celebration's dark covers the change,
 * so its hole opens straight onto the round, and with the usual fade otherwise.
 */
export function playAnimation(): 'none' | 'fade' {
  return yesCelebration.current() ? 'none' : 'fade';
}
