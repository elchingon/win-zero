// What earns a credit (SPEC 5). A one-time reward pays once, its id being its claim key, so it only
// tests whether its mark has been reached: a player already past it collects the next time it's
// checked. A repeating reward pays again at every mark: its claim key is its id and the history
// entry that reached the mark, so each goal's runs pay their own. A new way to earn is a new entry
// in CREDIT_REWARDS.
import { grantCredits, yesInRow, type CreditGrant, type CreditKind, type CreditWallet } from './credits';
import type { GoalState } from './types';

/** The Yes that first makes this many zeros earns a Game credit. */
export const GAME_CREDIT_ZEROS = 3;
/** Every this many Yeses in a row earns a Game credit. */
export const GAME_CREDIT_YES_EVERY = 7;
/** The first time each of these many Yeses come in a row earns a Weapon credit. */
export const WEAPON_CREDIT_YES_RUNS: readonly number[] = [3, 14];
/** Every this many Yeses in a row earns a Weapon credit. */
export const WEAPON_CREDIT_YES_EVERY = 30;

/** When credits are checked: a goal was set up, or a Yes was just answered (`goal` is after it). */
export type CreditMoment = { type: 'goal'; goal: GoalState } | { type: 'yes'; goal: GoalState };

export interface CreditReward {
  /** A one-time reward's claim key; a repeating reward's keys start with it. */
  id: string;
  kind: CreditKind;
  amount: number;
  /** Why, in plain words, to follow "Game credit earned": "for setting your goal". */
  reason: string;
  /** Pays at every mark, not once (`earned` is then true only at the moment a mark is reached). */
  repeats?: true;
  /** The id of an earlier reward this one took over from: whoever was paid that isn't paid this. */
  supersedes?: string;
  earned: (m: CreditMoment) => boolean;
}

/** The Yes just answered follows a day that went unanswered (a Not today doesn't count). */
function afterMissedDay(goal: GoalState): boolean {
  return goal.history.at(-1)?.result === 'yes' && goal.history.at(-2)?.missedInRow !== undefined;
}

/** The Yes just answered makes a multiple of `every` Yeses in a row. */
function yesRunReaches(goal: GoalState, every: number): boolean {
  const n = yesInRow(goal);
  return n > 0 && n % every === 0;
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
    supersedes: 'zeros-2',
    earned: (m) => m.type === 'yes' && m.goal.streak >= GAME_CREDIT_ZEROS,
  },
  {
    id: `yes-every-${GAME_CREDIT_YES_EVERY}`,
    kind: 'game',
    amount: 1,
    reason: `for every ${GAME_CREDIT_YES_EVERY} Yeses in a row`,
    repeats: true,
    earned: (m) => m.type === 'yes' && yesRunReaches(m.goal, GAME_CREDIT_YES_EVERY),
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
  {
    id: `yes-every-${WEAPON_CREDIT_YES_EVERY}`,
    kind: 'weapon',
    amount: 1,
    reason: `for every ${WEAPON_CREDIT_YES_EVERY} Yeses in a row`,
    repeats: true,
    earned: (m) => m.type === 'yes' && yesRunReaches(m.goal, WEAPON_CREDIT_YES_EVERY),
  },
];

/** Rewards that have since changed, by id, so a round saved with one still says why it paid. */
export const RETIRED_CREDIT_REASONS: Readonly<Record<string, string>> = {
  'zeros-2': 'for reaching 2 zeros',
  'yes-run-30': 'for 30 Yeses in a row',
};

/** The reward a claim key belongs to: its id, or for a repeating reward, its id before the "@". */
export function creditRewardById(key: string): CreditReward | undefined {
  const id = key.split('@')[0];
  return CREDIT_REWARDS.find((r) => r.id === id);
}

/** Why a credit was paid, by its claim key, retired rewards included. */
export function creditReason(key: string): string | undefined {
  return creditRewardById(key)?.reason ?? RETIRED_CREDIT_REASONS[key];
}

/** The key `reward` pays under at `moment`: a repeating reward's names the entry that reached it. */
export function claimKey(reward: CreditReward, moment: CreditMoment): string {
  const entry = moment.goal.history.at(-1);
  return reward.repeats && entry ? `${reward.id}@${entry.id}` : reward.id;
}

/** `reward` has been paid, for a one-time reward (a repeating one is never done). */
export function creditRewardClaimed(reward: CreditReward, claimed: readonly string[]): boolean {
  if (reward.repeats) return false;
  return claimed.includes(reward.id) || (reward.supersedes !== undefined && claimed.includes(reward.supersedes));
}

/** The rewards `moment` earns that haven't been claimed yet, as grants. */
export function creditsEarned(
  moment: CreditMoment,
  claimed: readonly string[],
  rewards: readonly CreditReward[] = CREDIT_REWARDS,
): CreditGrant[] {
  return rewards
    .filter((r) => r.earned(moment))
    .map((r) => ({ reward: r, key: claimKey(r, moment) }))
    .filter(({ reward, key }) => !claimed.includes(key) && !creditRewardClaimed(reward, claimed))
    .map(({ reward, key }) => ({ kind: reward.kind, amount: reward.amount, key }));
}

/** Pay whatever `moment` has earned into the wallet. */
export function claimCredits(
  wallet: CreditWallet,
  moment: CreditMoment,
): { wallet: CreditWallet; granted: CreditGrant[] } {
  return grantCredits(wallet, creditsEarned(moment, wallet.claimed));
}
