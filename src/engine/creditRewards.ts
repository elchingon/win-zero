// What earns a credit (SPEC 5). Each reward pays once, its id being its claim key, so a rule only
// tests whether its mark has been reached: a player already past it collects the next time it's
// checked. A new way to earn is a new entry in CREDIT_REWARDS.
import { grantCredits, yesInRow, type CreditGrant, type CreditKind, type CreditWallet } from './credits';
import type { GoalState } from './types';

/** The Yes that first makes this many zeros earns a Game credit. */
export const GAME_CREDIT_ZEROS = 2;
/** The first time each of these many Yeses come in a row earns a Weapon credit. */
export const WEAPON_CREDIT_YES_RUNS: readonly number[] = [3, 14, 30];

/** When credits are checked: a goal was set up, or a Yes was just answered (`goal` is after it). */
export type CreditMoment = { type: 'goal'; goal: GoalState } | { type: 'yes'; goal: GoalState };

export interface CreditReward {
  /** Also its claim key. */
  id: string;
  kind: CreditKind;
  amount: number;
  /** Why, in plain words, to follow "Game credit earned": "for setting your goal". */
  reason: string;
  earned: (m: CreditMoment) => boolean;
}

/** The Yes just answered follows a day that went unanswered (a Not today doesn't count). */
function afterMissedDay(goal: GoalState): boolean {
  return goal.history.at(-1)?.result === 'yes' && goal.history.at(-2)?.missedInRow !== undefined;
}

export const CREDIT_REWARDS: readonly CreditReward[] = [
  {
    id: 'goal-set',
    kind: 'game',
    amount: 1,
    reason: 'for setting your goal',
    earned: (m) => m.type === 'goal',
  },
  {
    id: `zeros-${GAME_CREDIT_ZEROS}`,
    kind: 'game',
    amount: 1,
    reason: `for reaching ${GAME_CREDIT_ZEROS} zeros`,
    earned: (m) => m.type === 'yes' && m.goal.streak >= GAME_CREDIT_ZEROS,
  },
  {
    id: 'comeback',
    kind: 'weapon',
    amount: 1,
    reason: 'for checking in again after a missed day',
    earned: (m) => m.type === 'yes' && afterMissedDay(m.goal),
  },
  ...WEAPON_CREDIT_YES_RUNS.map(
    (n): CreditReward => ({
      id: `yes-run-${n}`,
      kind: 'weapon',
      amount: 1,
      reason: `for ${n} Yeses in a row`,
      earned: (m) => m.type === 'yes' && yesInRow(m.goal) >= n,
    }),
  ),
];

export function creditRewardById(id: string): CreditReward | undefined {
  return CREDIT_REWARDS.find((r) => r.id === id);
}

/** The rewards `moment` earns that haven't been claimed yet, as grants. */
export function creditsEarned(
  moment: CreditMoment,
  claimed: readonly string[],
  rewards: readonly CreditReward[] = CREDIT_REWARDS,
): CreditGrant[] {
  return rewards
    .filter((r) => !claimed.includes(r.id) && r.earned(moment))
    .map((r) => ({ kind: r.kind, amount: r.amount, key: r.id }));
}

/** Pay whatever `moment` has earned into the wallet. */
export function claimCredits(
  wallet: CreditWallet,
  moment: CreditMoment,
): { wallet: CreditWallet; granted: CreditGrant[] } {
  return grantCredits(wallet, creditsEarned(moment, wallet.claimed));
}
