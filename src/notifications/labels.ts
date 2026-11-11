// How reminders, and Win Zero Plus's widgets, name a goal (SPEC 9). Its wording only when the user
// turned "Goal in reminders" on; otherwise its lock-screen name or its place, which keep the goal off
// the lock screen. Pure.
import type { GoalState } from '@/engine';

const ORDINALS = ['first', 'second', 'third', 'fourth', 'fifth'];

/**
 * How a reminder names a goal: its wording when the user turned that on, and otherwise "your goal",
 * which keeps it off the lock screen. With more than one goal (SPEC 9), its lock-screen name, or
 * its place among them: "your second goal".
 */
export function goalLabel(goal: GoalState, place: number, count: number, showGoal: boolean): string {
  if (showGoal) return `“${goal.goal}”`;
  if (count <= 1) return 'your goal';
  if (goal.alias) return `“${goal.alias}”`;
  const ordinal = ORDINALS[place];
  return ordinal ? `your ${ordinal} goal` : 'your goal';
}

/** A widget's title for a goal: as a reminder names it, without the quotes, starting with a capital. */
export function widgetLabel(goal: GoalState, place: number, count: number, showGoal: boolean): string {
  const bare = goalLabel(goal, place, count, showGoal).replace(/^“|”$/g, '');
  return `${bare.charAt(0).toUpperCase()}${bare.slice(1)}`;
}
