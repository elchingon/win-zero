// What the result sheet says under "N zeros down": what the Yes earned and the next unlock.
// Rewards were applied when Yes was answered; this only reveals them, after the popup for any Game
// credit the Yes earned. A replay, a bonus round or
// a practice round changes nothing, and says so. Also the round's labels, so the app and the
// website name each kind of round the same. Shared by both. In Win Zero Plus (SPEC 9), power-ups
// go by the game mode's names, and an earned theme is announced like a weapon.
import {
  addDays,
  DEFAULT_MODE,
  nextGoalDay,
  nextUnlock,
  SHIELD_CAP,
  themeById,
  weaponById,
  type CreditGrant,
  type CreditWallet,
  type GoalState,
  type ModeId,
} from '@/engine';
import { plural } from '@/lib/format';
import type { RoundRecord } from '@/store/types';
import { creditEarned } from '@/ui/copy/credits';
import { powerUp } from '@/ui/copy/modes';

/**
 * The round on screen. `real`: the round a Yes earned, played for the first time. `replay`: that
 * round again. `bonus`: a round paid for with a Game credit. `practice`: the demo tools' round.
 */
export type ResultMode = 'real' | 'replay' | 'bonus' | 'practice';

/** What Replay plays: a real round again is a replay; bonus and practice rounds stay what they are. */
export function replayMode(mode: ResultMode): ResultMode {
  return mode === 'real' ? 'replay' : mode;
}

/** The HUD's label: 'DAY 30', 'BONUS' or 'PRACTICE'. */
export function hudLabel(mode: ResultMode, n: number): string {
  if (mode === 'practice') return 'PRACTICE';
  if (mode === 'bonus') return 'BONUS';
  return `DAY ${n}`;
}

/** Above "N zeros down": 'Day 30 · Stop drinking', 'Bonus round' or 'Practice'. */
export function sheetEyebrow(mode: ResultMode, n: number, goal: GoalState | null): string {
  if (mode === 'practice') return 'Practice';
  if (mode === 'bonus') return 'Bonus round';
  return `Day ${n}${goal ? ` · ${goal.goal}` : ''}`;
}

export interface ResultLine {
  text: string;
  /** Something new: a weapon, a bomb, a shield or a credit. */
  news?: boolean;
}

/**
 * What covers the round: the HUD while it plays, then the encouragement popup, then the popup for
 * the Game credits the Yes earned, then the sheet.
 */
export type RoundOverlay = 'hud' | 'cheer' | 'credit' | 'sheet';

/**
 * Until the fill lands, the HUD. Then a line of encouragement until it's dismissed (`cheered`),
 * then, while `creditsDue` (Game credits to reveal, not yet dismissed), their popup, then the
 * result sheet. The encouragement is about the day's check-in, so practice and bonus rounds go
 * straight to the sheet.
 */
export function roundOverlay(landed: boolean, mode: ResultMode, cheered: boolean, creditsDue = false): RoundOverlay {
  if (!landed) return 'hud';
  if (mode === 'practice' || mode === 'bonus') return 'sheet';
  if (!cheered) return 'cheer';
  return creditsDue ? 'credit' : 'sheet';
}

/**
 * The Game credits a round reveals in a popup when it ends: those its Yes earned, the first time
 * it's played. They were banked at the Yes; a replay has nothing new to show.
 */
export function revealedCredits(mode: ResultMode, record: RoundRecord | null): CreditGrant[] {
  return mode === 'real' && record ? record.rewards.credits.filter((g) => g.kind === 'game') : [];
}

export interface ResultOptions {
  /** The game the round was played in: its power-ups are named by it. The Shooter by default. */
  gameMode?: ModeId;
  /** This app's icons open with its themes (Win Zero Plus), so a theme's line says so. */
  icons?: boolean;
}

/**
 * The sheet's lines for a round of `n` zeros. `record` is the day's round, absent for bonus and
 * practice rounds; `credits` is the wallet now, for "You have N". `best` is how far the arsenal
 * reaches: the goal's best streak, or with several goals the best of any (SPEC 9).
 */
export function resultLines(
  n: number,
  mode: ResultMode,
  record: RoundRecord | null,
  goal: GoalState | null,
  credits: CreditWallet,
  best: number = goal?.bestStreak ?? 0,
  { gameMode = DEFAULT_MODE, icons = false }: ResultOptions = {},
): ResultLine[] {
  const lines: ResultLine[] = [];
  if (mode === 'practice') {
    lines.push({ text: 'Practice round: nothing about your streak changes.' });
  } else if (mode === 'bonus') {
    lines.push({ text: "Bonus round: your streak and rewards don't change." });
  } else if (mode === 'replay') {
    lines.push({ text: "Replay: your streak and rewards don't change." });
  } else if (record && goal) {
    for (const id of record.rewards.weapons) {
      const p = powerUp(gameMode, weaponById(id));
      lines.push({ text: `New ${p.kind} unlocked: ${p.name}.${p.description ? ` ${p.description}` : ''}`, news: true });
    }
    for (const id of record.unlocks ?? []) {
      lines.push({ text: `New theme unlocked: ${themeById(id).name}.${icons ? ' Its app icon is unlocked too.' : ''}`, news: true });
    }
    if (record.rewards.bomb) lines.push({ text: `Bomb earned. You have ${goal.bombs}.`, news: true });
    if (record.rewards.shield) lines.push({ text: `Shield earned. You have ${goal.shields} of ${SHIELD_CAP}.`, news: true });
    if (record.rewards.shieldCapped) lines.push({ text: `Shields full. You're holding all ${SHIELD_CAP}.` });
    // "You have N" once per kind, on its last line.
    const earned = record.rewards.credits;
    earned.forEach((g, i) => {
      const last = !earned.slice(i + 1).some((o) => o.kind === g.kind);
      lines.push({ text: last ? `${creditEarned(g)} You have ${credits.balance[g.kind]}.` : creditEarned(g), news: true });
    });
  }
  // A bonus round's size isn't the streak, so there's no next unlock to count down to.
  if ((mode === 'real' || mode === 'replay') && goal) {
    const next = nextUnlock(best, n);
    const p = next ? powerUp(gameMode, next.weapon) : null;
    // A goal on chosen days (Win Zero Plus) may not check in tomorrow.
    const tomorrow = !record || nextGoalDay(goal, record.day) === addDays(record.day, 1);
    lines.push({
      text:
        next && p
          ? p.name === next.weapon.name
            ? `Hold the line ${plural(next.daysToGo, 'more day')} for the ${p.name}.`
            : `Hold the line ${plural(next.daysToGo, 'more day')} for your next ${p.kind}: ${p.name}.`
          : `${tomorrow ? 'Tomorrow' : 'Next check-in'}: ${plural(n + 1, 'zero')}.`,
    });
  }
  return lines;
}
