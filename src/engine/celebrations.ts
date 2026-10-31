// The milestones Home celebrates with a one-time popup, after the round is played (SPEC 6). A new
// celebration is a new entry in CELEBRATIONS, and its words in ui/copy/celebrations.ts: the store,
// the selector and both apps' popups read this table.
import { SHIELD_EVERY, type MilestoneRewards } from './rewards';

/** The second celebration's day. A multiple of BOMB_EVERY, since a new bomb is what shows it's earned. */
export const THIRTY_DAY_MARK = 30;

export type CelebrationId = 'day-7' | 'day-30';

/** What a celebration can feature, each shown only when this round earned it. */
export type HighlightKind = 'shield' | 'weapon' | 'theme' | 'bomb';

export interface Celebration {
  id: CelebrationId;
  /** The round's zeros: the streak after that Yes. */
  day: number;
  /**
   * The Yes reached a new high in its run, shown by a reward only a new high pays. Climbing back to
   * the same day within a run earns nothing new, so there's nothing to celebrate.
   */
  earned: (rewards: MilestoneRewards) => boolean;
  /** What the popup features, in order. */
  highlights: readonly HighlightKind[];
}

export const CELEBRATIONS: readonly Celebration[] = [
  { id: 'day-7', day: SHIELD_EVERY, earned: (r) => r.shield, highlights: ['shield'] },
  { id: 'day-30', day: THIRTY_DAY_MARK, earned: (r) => r.bomb, highlights: ['weapon', 'theme', 'bomb'] },
];

/** The celebration this round earned, if any. */
export function celebrationFor(round: { n: number; rewards: MilestoneRewards }): Celebration | null {
  return CELEBRATIONS.find((c) => c.day === round.n && c.earned(round.rewards)) ?? null;
}
