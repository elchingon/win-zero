// The share card's words (SPEC 9): the day, "N zeros down", what the round did, as the share text
// says it, and the app. Never the goal's wording.
import type { ModeId } from '@/engine';
import { milestoneShareParts, zerosDown } from '@/game/shareText';
import { formatCount, joinAnd } from '@/lib/format';
import type { RoundRewards } from '@/store/types';

import { SHARE_CARD_COPY } from '../copy';

export interface CardWords {
  /** 'DAY 30'. */
  day: string;
  /** '30 zeros down'. */
  zeros: string;
  /** 'Beat the boss, unlocked the Chain Zapper and earned a bomb.', or null for none. */
  did: string | null;
  /** 'WIN ZERO PLUS · winzero.app'. */
  footer: string;
}

export function cardWords(n: number, rewards: RoundRewards, mode: ModeId, appName: string): CardWords {
  const parts = milestoneShareParts(n, rewards, mode);
  const did = parts.length > 0 ? joinAnd(parts) : null;
  return {
    day: `DAY ${formatCount(n)}`,
    zeros: zerosDown(n),
    did: did ? `${did.charAt(0).toUpperCase()}${did.slice(1)}.` : null,
    footer: `${appName.toUpperCase()} · ${SHARE_CARD_COPY.site}`,
  };
}
