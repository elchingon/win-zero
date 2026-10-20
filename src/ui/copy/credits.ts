// Credits in plain words: their names, the result sheet's line for one a Yes earned and the popup
// that reveals a Game credit after the round, what each is for, Home's Credits section with its
// hints and bonus round sheet, and the question before a round. Why a credit was earned comes from the engine's rewards, so the words can't drift from
// the rules. Shared by the app and the website.
import {
  BONUS_MAX_N,
  creditReason,
  CREDIT_REWARDS,
  creditRewardClaimed,
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
  const reason = creditReason(grant.key);
  return reason ? `${what} earned ${reason}.` : `${what} earned.`;
}

/** A popup announcing new credits: a big '+1', a title, a line or two, and its button. */
export interface CreditNews {
  badge: string;
  title: string;
  lines: string[];
  button: string;
}

/**
 * After the first play of a round whose Yes earned Game credits (`grants`): what came in and why,
 * and how many there are now (`balance`, the wallet's Game credits).
 */
export function creditReveal(grants: readonly CreditGrant[], balance: number): CreditNews {
  const total = grants.reduce((sum, g) => sum + g.amount, 0);
  const reasons = [...new Set(grants.map((g) => creditReason(g.key)).filter((r) => r !== undefined))];
  return {
    badge: `+${formatCount(total)}`,
    title: total === 1 ? 'Game credit earned!' : 'Game credits earned!',
    lines: [
      ...reasons.map((r) => `Earned ${r}.`),
      `You now have ${creditCount('game', balance)}. Spend one on a bonus round from Home, any size you like.`,
    ],
    button: 'Nice!',
  };
}

/** What each credit is for. */
export const CREDIT_USES: Record<CreditKind, string> = {
  game: `A Game credit plays a bonus round with as many zeros as you like, up to ${formatCount(BONUS_MAX_N)}. Bonus rounds never change your streak or rewards.`,
  weapon:
    "A Weapon credit lends you a weapon you haven't unlocked yet, for one round. When you have one, you're asked before your daily round or a bonus round starts.",
};

/**
 * How a credit is earned, from the rewards themselves: 'You earn a Game credit for … and for ….'
 * One-time rewards already in `claimed` are left out; repeating ones always stay. Null when none
 * are left.
 */
export function creditsEarnedBy(kind: CreditKind, claimed: readonly string[] = []): string | null {
  const reasons = CREDIT_REWARDS.filter((r) => r.kind === kind && !creditRewardClaimed(r, claimed)).map((r) => r.reason);
  return reasons.length > 0 ? `You earn a ${NAMES[kind]} ${joinAnd(reasons)}.` : null;
}

/** '250 zeros'. */
const zeros = (n: number) => `${formatCount(n)} ${n === 1 ? 'zero' : 'zeros'}`;

/** Home's Credits section. */
export const CREDITS_HOME = {
  title: 'Credits',
  playBonus: 'Play a bonus round',
  playBonusHint: 'Uses 1 Game credit. You choose how many zeros.',
  bonusReady: (n: number) => `Your bonus round of ${zeros(n)} is ready.`,
  bonusReadyLede: "It's paid for. Play it whenever you like.",
  playBonusNow: 'Play bonus round',
};

/** Each credit count's label, and the title of the popup its hint opens. */
const COUNT_TITLES: Record<CreditKind, string> = { game: 'Game credits', weapon: 'Weapon credits' };

/** The hint on each credit count, and the popup it opens. */
export const CREDITS_HELP = {
  title: COUNT_TITLES,
  /** The hint button, for screen readers: 'About Game credits'. */
  button: (kind: CreditKind) => `About ${COUNT_TITLES[kind]}`,
  gameSpend: 'To spend one, tap Play a bonus round and choose how many zeros. The round waits on Home until you play it.',
  bonusWaiting: 'Your bonus round is paid for and waiting on Home.',
  weaponAllUnlocked: 'Every weapon is unlocked, so your Weapon credits wait here for new ones.',
  earnTitle: 'How to earn one',
  earned: 'Earned',
  footer: 'The ways that start with Every keep paying. The rest are earned once, and credits stay banked until you use them.',
  close: 'Got it',
};

/**
 * One way to earn a credit, for the popup's list ("3 Yeses in a row"), and whether it's been
 * earned: a repeating way ("Every 7 Yeses in a row") never is, as it keeps paying.
 */
export interface CreditWay {
  label: string;
  earned: boolean;
}

export interface CreditHelp {
  title: string;
  /** What the credit does and how it's used. */
  lines: string[];
  /** Where things stand right now, when that's worth a line. */
  status: string | null;
  ways: CreditWay[];
}

/** A reward's reason as a list item: 'for setting your goal' is 'Setting your goal'. */
function wayLabel(reason: string): string {
  const what = reason.replace(/^for /, '');
  return what.charAt(0).toUpperCase() + what.slice(1);
}

/**
 * The popup behind a credit count's hint: what the credit is and how it's used, where things
 * stand, and every way to earn one, from the engine's rewards, the one-time ones already earned
 * marked as such. `best`: how far the arsenal reaches (whether a Weapon credit has anything left to lend).
 * `bonusWaiting`: a bonus round is already paid for.
 */
export function creditHelp(kind: CreditKind, credits: CreditWallet, best: number, bonusWaiting: boolean): CreditHelp {
  const ways = CREDIT_REWARDS.filter((r) => r.kind === kind).map((r) => ({
    label: wayLabel(r.reason),
    earned: creditRewardClaimed(r, credits.claimed),
  }));
  if (kind === 'game') {
    return {
      title: CREDITS_HELP.title.game,
      lines: [CREDIT_USES.game, CREDITS_HELP.gameSpend],
      status: bonusWaiting ? CREDITS_HELP.bonusWaiting : null,
      ways,
    };
  }
  return {
    title: CREDITS_HELP.title.weapon,
    lines: [CREDIT_USES.weapon],
    status: credits.balance.weapon > 0 && lockedWeapons(best).length === 0 ? CREDITS_HELP.weaponAllUnlocked : null,
    ways,
  };
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
