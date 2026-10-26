// Game and Weapon credits (SPEC 5): banked, and spent only when the player chooses. A Game
// credit plays a bonus round of any size; a Weapon credit lends one weapon not yet earned for one
// round. The wallet sits apart from GoalState so credits outlive a goal, and every grant carries a
// claim key so it pays once: a reward's (creditRewards.ts), or a purchase's id later. A gift (Win
// Zero Plus's secret tap) is the one exception: nothing delivers it twice, so it has no key.
import type { GoalState } from './types';
import { lockedWeapons, type WeaponDef, type WeaponId } from './weapons';

export type CreditKind = 'game' | 'weapon';

export const CREDIT_KINDS: readonly CreditKind[] = ['game', 'weapon'];

/** The most zeros a bonus round can have: the same ceiling as a practice round. */
export const BONUS_MAX_N = 100_000;
/** Weapon credits one round can spend. */
export const WEAPON_CREDITS_PER_ROUND = 1;
/** Game credits Win Zero Plus's secret triple tap on Home gives each time. */
export const SECRET_GAME_CREDITS = 1;

export interface CreditWallet {
  balance: Record<CreditKind, number>;
  /** Keys of the grants already paid. It only grows, so no grant pays twice. */
  claimed: string[];
}

export const EMPTY_WALLET: CreditWallet = { balance: { game: 0, weapon: 0 }, claimed: [] };

export interface CreditGrant {
  kind: CreditKind;
  amount: number;
  /** Pays once per key: a reward's id, or a purchase's transaction id. */
  key: string;
}

/** Pay the grants whose keys haven't been claimed. `granted` lists the ones that paid. */
export function grantCredits(
  wallet: CreditWallet,
  grants: readonly CreditGrant[],
): { wallet: CreditWallet; granted: CreditGrant[] } {
  const claimed = new Set(wallet.claimed);
  const granted: CreditGrant[] = [];
  for (const g of grants) {
    if (!Number.isInteger(g.amount) || g.amount < 1) throw new RangeError(`Bad credit amount: ${g.amount}`);
    if (claimed.has(g.key)) continue;
    claimed.add(g.key);
    granted.push(g);
  }
  if (granted.length === 0) return { wallet, granted };
  const balance = { ...wallet.balance };
  for (const g of granted) balance[g.kind] += g.amount;
  return { wallet: { balance, claimed: [...wallet.claimed, ...granted.map((g) => g.key)] }, granted };
}

/** Add `amount` credits of `kind` with no claim key: a gift, which nothing delivers twice. */
export function giftCredits(wallet: CreditWallet, kind: CreditKind, amount: number): CreditWallet {
  if (!Number.isInteger(amount) || amount < 1) throw new RangeError(`Bad credit amount: ${amount}`);
  return { ...wallet, balance: { ...wallet.balance, [kind]: wallet.balance[kind] + amount } };
}

/** Spend one credit of `kind`. */
export function spendCredit(wallet: CreditWallet, kind: CreditKind): CreditWallet {
  if (wallet.balance[kind] < 1) throw new RangeError(`No ${kind} credits to spend`);
  return { ...wallet, balance: { ...wallet.balance, [kind]: wallet.balance[kind] - 1 } };
}

/**
 * What a Weapon credit could lend a round about to start: the weapons not yet unlocked, while a
 * credit is held and the round hasn't borrowed its share. Empty means there's nothing to ask.
 */
export function weaponCreditOffer(wallet: CreditWallet, bestStreak: number, borrowed: readonly WeaponId[]): WeaponDef[] {
  if (wallet.balance.weapon < 1 || borrowed.length >= WEAPON_CREDITS_PER_ROUND) return [];
  return lockedWeapons(bestStreak).filter((w) => !borrowed.includes(w.id));
}

/** A bonus round can have this many zeros. */
export function isBonusSize(n: number): boolean {
  return Number.isInteger(n) && n >= 1 && n <= BONUS_MAX_N;
}

/**
 * Check-ins answered Yes in a row, through the latest settled day. Any other day (a Not today, a
 * shielded day, a missed day) starts it over. Unlike the streak, it never slides.
 */
export function yesInRow(state: GoalState): number {
  let n = 0;
  for (let i = state.history.length - 1; i >= 0 && state.history[i]?.result === 'yes'; i--) n++;
  return n;
}
