// Credits in plain words: their names, the result sheet's line for one a Yes earned, what each
// is for, Home's Credits section and bonus round sheet, and the question before a round. Why a credit was earned comes from the engine's rewards, so the words can't drift
// from the rules. Shared by the app and the website.
import {
  BONUS_MAX_N,
  CREDIT_REWARDS,
  creditRewardById,
  lockedWeapons,
  type CreditGrant,
  type CreditKind,
  type CreditWallet,
  type WeaponDef,
} from '@/engine';
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

/**
 * How a credit is earned, from the rewards themselves: 'You earn a Game credit for … and for ….'
 * Rewards in `claimed` are left out, as each pays once; null when none are left.
 */
export function creditsEarnedBy(kind: CreditKind, claimed: readonly string[] = []): string | null {
  const reasons = CREDIT_REWARDS.filter((r) => r.kind === kind && !claimed.includes(r.id)).map((r) => r.reason);
  return reasons.length > 0 ? `You earn a ${NAMES[kind]} ${joinAnd(reasons)}.` : null;
}

/** '250 zeros'. */
const zeros = (n: number) => `${formatCount(n)} ${n === 1 ? 'zero' : 'zeros'}`;

/** Home's Credits section. */
export const CREDITS_HOME = {
  title: 'Credits',
  playBonus: 'Play a bonus round',
  playBonusHint: 'Uses 1 Game credit. You choose how many zeros.',
  bonusAbout: 'As many zeros as you like. Your streak and rewards stay as they are.',
  bonusReady: (n: number) => `Your bonus round of ${zeros(n)} is ready.`,
  bonusReadyLede: "It's paid for. Play it whenever you like.",
  playBonusNow: 'Play bonus round',
  weaponWaiting: "You'll be asked before your next round whether to use one.",
  weaponAllUnlocked: 'Every weapon is unlocked, so your Weapon credits wait here for new ones.',
};

/**
 * Home's notes under the credit counts, in plain words: with none of a kind, how to earn one; with
 * some, what it's for, or when it comes up. `bonusWaiting`: a bonus round is already paid for.
 */
export function creditNotes(credits: CreditWallet, bestStreak: number, bonusWaiting: boolean): string[] {
  const { game, weapon } = credits.balance;
  const gameNote = game > 0 ? (bonusWaiting ? null : CREDITS_HOME.bonusAbout) : creditsEarnedBy('game', credits.claimed);
  const weaponNote =
    weapon > 0
      ? lockedWeapons(bestStreak).length > 0
        ? CREDITS_HOME.weaponWaiting
        : CREDITS_HOME.weaponAllUnlocked
      : creditsEarnedBy('weapon', credits.claimed);
  return [gameNote, weaponNote].filter((n): n is string => n !== null);
}

/** Ready-made sizes for a bonus round, and the one the sheet starts on. */
export const BONUS_PRESETS: readonly number[] = [10, 100, 1_000, 10_000];
export const BONUS_DEFAULT_N = 100;

/** Choosing a bonus round's size. */
export const BONUS_SHEET = {
  title: 'Bonus round',
  field: 'Zeros',
  hint: `Any number from 1 to ${formatCount(BONUS_MAX_N)}.`,
  invalid: `A whole number from 1 to ${formatCount(BONUS_MAX_N)}, please.`,
  start: 'Start',
  startHint: 'Uses 1 Game credit',
  cancel: 'Cancel',
};

/** Before a round, when a Weapon credit could lend it something. */
export const WEAPON_PROMPT = {
  title: 'Use a Weapon credit?',
  /** `kind`: what the game mode calls a power-up (Win Zero Plus, SPEC 9); a weapon in the Shooter. */
  body: (credits: number, kind = 'weapon') =>
    `You have ${creditCount('weapon', credits)}. Pick a ${kind} you haven't unlocked yet to use in this round and its replays.`,
  skip: 'Not this time',
  /** A screen reader's name for one weapon on offer, by the game mode's name for it and its description, if any. */
  option: (w: WeaponDef, name = w.name, about: string | null = w.description) =>
    `${name}.${about ? ` ${about}` : ''} Unlocks on day ${w.unlockAt}.`,
  optionHint: 'Uses 1 Weapon credit for this round',
};
