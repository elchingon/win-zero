// The words for sharing a milestone round. A milestone is a Yes that earned something: a new
// weapon, a bomb or a shield (credits aren't shared). The goal's wording is never in the text: it may be private
// (someone working on sobriety shares a streak, not a reason). Shared by the app and the website.
import { DEFAULT_MODE, weaponById, type ModeId, type WeaponId } from '@/engine';
import { formatCount, joinAnd } from '@/lib/format';
import type { RoundRewards } from '@/store/types';
import { FREE_APP_NAME } from '@/ui/copy/app';
import { powerUp } from '@/ui/copy/modes';

/**
 * The new power-ups as the game played names them: "the Chain Zapper" where it's the weapon
 * itself (the Shooter, Orbit), else after its kind, "a new catcher, Twin Cups" (`aside`: set off
 * by commas).
 */
function unlocked(mode: ModeId, ids: readonly WeaponId[]): { words: string; aside: boolean } {
  const ups = ids.map((id) => powerUp(mode, weaponById(id)));
  const names = joinAnd(ups.map((p) => p.name));
  if (ups.every((p) => p.description !== null)) return { words: `the ${names}`, aside: false };
  const kind = ups[0]?.kind ?? '';
  return { words: ups.length > 1 ? `new ${kind}s, ${names}` : `a new ${kind}, ${names}`, aside: true };
}

/**
 * What to share for a Day `n` round, or null when it earned nothing to share. `appName`: the app
 * the player shared from (SPEC 9). `mode`: the game it was played in, which names the power-ups.
 */
export function milestoneShareText(
  n: number,
  rewards: RoundRewards,
  appName: string = FREE_APP_NAME,
  mode: ModeId = DEFAULT_MODE,
): string | null {
  const items = [...(rewards.bomb ? ['a bomb'] : []), ...(rewards.shield ? ['a shield'] : [])];
  const ups = rewards.weapons.length > 0 ? unlocked(mode, rewards.weapons) : null;
  const did = [
    ...(ups ? [`unlocked ${ups.words}${ups.aside && items.length > 0 ? ',' : ''}`] : []),
    ...(items.length > 0 ? [`earned ${joinAnd(items)}`] : []),
  ];
  if (did.length === 0) return null;
  return `Day ${formatCount(n)} on ${appName}: ${formatCount(n)} ${n === 1 ? 'zero' : 'zeros'} down. I ${did.join(' and ')}.`;
}
