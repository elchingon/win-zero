// The website's one Yes celebration (src/game/yes.ts), as in the app: Home runs a Yes click's
// answer inside `armed`, its routing asks `begin()` how long to hold the round back, and the
// overlay in the Layout (ui/YesCelebration) draws the show.
import { createYesCelebration } from '@/game/yes';

export const yesCelebration = createYesCelebration();
