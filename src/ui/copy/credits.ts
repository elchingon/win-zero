// Credits in plain words: their names, the result sheet's line for one a Yes earned, and what
// each is for. Why a credit was earned comes from the engine's rewards, so the words can't drift
// from the rules. Shared by the app and the website.
import { BONUS_MAX_N, CREDIT_REWARDS, creditRewardById, type CreditGrant, type CreditKind } from '@/engine';
import { formatCount, joinAnd, plural } from '@/lib/format';

const NAMES: Record<CreditKind, string> = { game: 'Game credit', weapon: 'Weapon credit' };

/** '1 Game credit', '3 Weapon credits'. */
export function creditCount(kind: CreditKind, n: number): string {
  return plural(n, NAMES[kind]);
}

/** A credit a Yes earned: 'Weapon credit earned for 3 Yeses in a row.' */
export function creditEarned(grant: CreditGrant): string {
  const what = grant.amount === 1 ? NAMES[grant.kind] : creditCount(grant.kind, grant.amount);
  const reason = creditRewardById(grant.key)?.reason;
  return reason ? `${what} earned ${reason}.` : `${what} earned.`;
}

/** What each credit is for. */
export const CREDIT_USES: Record<CreditKind, string> = {
  game: `A Game credit plays a bonus round with as many zeros as you like, up to ${formatCount(BONUS_MAX_N)}. Bonus rounds never change your streak or rewards.`,
  weapon:
    "A Weapon credit lends you a weapon you haven't unlocked yet, for one round. When you have one, you're asked before your daily round or a bonus round starts.",
};

/** How credits are earned, from the rewards themselves: 'You earn a Game credit for … and for ….' */
export function creditsEarnedBy(kind: CreditKind): string {
  const reasons = CREDIT_REWARDS.filter((r) => r.kind === kind).map((r) => r.reason);
  return `You earn a ${NAMES[kind]} ${joinAnd(reasons)}.`;
}
