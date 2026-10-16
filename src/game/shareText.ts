// The words for sharing a milestone round. A milestone is a Yes that earned something: a new
// weapon, a bomb or a shield (credits aren't shared). The goal's wording is never in the text: it may be private
// (someone working on sobriety shares a streak, not a reason). Shared by the app and the website.
import { weaponById } from '@/engine';
import { formatCount, joinAnd } from '@/lib/format';
import type { RoundRewards } from '@/store/types';

/** What to share for a Day `n` round, or null when it earned nothing to share. */
export function milestoneShareText(n: number, rewards: RoundRewards): string | null {
  const weapons = rewards.weapons.map((id) => weaponById(id).name);
  const items = [...(rewards.bomb ? ['a bomb'] : []), ...(rewards.shield ? ['a shield'] : [])];
  const did = [
    ...(weapons.length > 0 ? [`unlocked the ${joinAnd(weapons)}`] : []),
    ...(items.length > 0 ? [`earned ${joinAnd(items)}`] : []),
  ];
  if (did.length === 0) return null;
  return `Day ${formatCount(n)} on Win Zero: ${formatCount(n)} ${n === 1 ? 'zero' : 'zeros'} down. I ${did.join(' and ')}.`;
}
