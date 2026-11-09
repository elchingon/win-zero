// Win Zero Plus's part of the round screen (SPEC 9): the game picker before a round, a comeback's
// own encouragement, and the win-back round's name.
import { cheerDeck } from '@/ui/copy/cheers';

import { COMEBACK_CHEERS } from '../copy';

export { WIN_BACK_WORDS } from '../copy';
export { ModeGate } from './ModeGate';

/** One deck for the session, as the usual cheers have. */
export const nextComebackCheer = cheerDeck(Math.random, COMEBACK_CHEERS);
