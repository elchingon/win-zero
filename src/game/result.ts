// What the result sheet says under "N zeros down": what the Yes earned and the next unlock.
// Rewards were applied when Yes was answered; this only reveals them. A replay or a practice
// round changes nothing, and says so. Shared by the app and the website.
import { nextUnlock, SHIELD_CAP, weaponById, type GoalState } from '@/engine';
import { plural } from '@/lib/format';
import type { RoundRecord } from '@/store/types';

export type ResultMode = 'real' | 'replay' | 'practice';

export interface ResultLine {
  text: string;
  /** Something new: a weapon, a bomb or a shield. */
  news?: boolean;
}

/** The sheet's lines for a Day `n` round. `record` is absent for practice. */
export function resultLines(n: number, mode: ResultMode, record: RoundRecord | null, goal: GoalState | null): ResultLine[] {
  const lines: ResultLine[] = [];
  if (mode === 'practice') {
    lines.push({ text: 'Practice round: nothing about your streak changes.' });
  } else if (mode === 'replay') {
    lines.push({ text: "Replay: your streak and rewards don't change." });
  } else if (record && goal) {
    for (const id of record.rewards.weapons) {
      const w = weaponById(id);
      lines.push({ text: `New weapon unlocked: ${w.name}. ${w.description}`, news: true });
    }
    if (record.rewards.bomb) lines.push({ text: `Bomb earned. You have ${goal.bombs}.`, news: true });
    if (record.rewards.shield) lines.push({ text: `Shield earned. You have ${goal.shields} of ${SHIELD_CAP}.`, news: true });
    if (record.rewards.shieldCapped) lines.push({ text: `Shields full. You're holding all ${SHIELD_CAP}.` });
  }
  if (mode !== 'practice' && goal) {
    const next = nextUnlock(goal.bestStreak, n);
    lines.push({
      text: next
        ? `Hold the line ${plural(next.daysToGo, 'more day')} for the ${next.weapon.name}.`
        : `Tomorrow: ${plural(n + 1, 'zero')}.`,
    });
  }
  return lines;
}
