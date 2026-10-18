// What each app allows (SPEC 9). The store takes these as a parameter: shared code never asks which
// app it's in. The free app and the website keep one goal that checks in every day.
export interface Limits {
  /** Goals at once; archived goals don't count. */
  maxGoals: number;
  /** Goals can check in on chosen weekdays instead of every day. */
  weekdaySchedules: boolean;
}

export const FREE_LIMITS: Limits = { maxGoals: 1, weekdaySchedules: false };
export const PLUS_LIMITS: Limits = { maxGoals: 3, weekdaySchedules: true };
