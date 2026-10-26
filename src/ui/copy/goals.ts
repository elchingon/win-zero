// How a goal is named by its check-in days (SPEC 9). A goal that checks in every day, as every
// Win Zero goal does, is a daily goal; Win Zero Plus names the days of any other.
import { checkInDays, isEveryDay, type GoalState } from '@/engine';
import { formatDays } from '@/lib/format';

/** Above the goal's wording: 'Daily goal', or 'Goal · Mon, Wed, Fri'. `firstWeekday` as in formatDays. */
export function goalEyebrow(goal: GoalState, firstWeekday: number): string {
  return isEveryDay(goal) ? 'Daily goal' : `Goal · ${formatDays(checkInDays(goal), firstWeekday)}`;
}

/** The goal's wording field: 'Daily goal', or 'Goal'. */
export function goalFieldLabel(goal: GoalState): string {
  return isEveryDay(goal) ? 'Daily goal' : 'Goal';
}
