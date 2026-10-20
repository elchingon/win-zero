// What each app allows (SPEC 9). The store takes these as a parameter: shared code never asks which
// app it's in. The free app and the website keep one goal that checks in every day, play the
// Shooter in Classic colors, and keep their own icon.
export interface Limits {
  /** Goals at once; archived goals don't count. */
  maxGoals: number;
  /** Goals can check in on chosen weekdays instead of every day. */
  weekdaySchedules: boolean;
  /** Game modes beyond the Shooter can be picked (engine/modes.ts). */
  modesEnabled: boolean;
  /** Themes beyond Classic can be picked (engine/themes.ts). */
  themesEnabled: boolean;
  /** Home-screen icons beyond the app's own can be picked (engine/icons.ts). */
  iconsEnabled: boolean;
}

export const FREE_LIMITS: Limits = {
  maxGoals: 1,
  weekdaySchedules: false,
  modesEnabled: false,
  themesEnabled: false,
  iconsEnabled: false,
};
export const PLUS_LIMITS: Limits = {
  maxGoals: 3,
  weekdaySchedules: true,
  modesEnabled: true,
  themesEnabled: true,
  iconsEnabled: true,
};
