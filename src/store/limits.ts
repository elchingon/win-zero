// What each app allows (SPEC 9). The store takes these as a parameter: shared code never asks which
// app it's in. The free app and the website keep one goal that checks in every day, play the
// Shooter in Classic colors, and keep their own icon.
// Relative, as the website's build plugins read this file without the app's path aliases.
import { HEAD_START_MAX } from '../engine/headStart';

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
  /** Home's Game credits count gives a free credit to three quick taps (Win Zero Plus's secret). */
  secretCredits: boolean;
  /** The most days a new goal can count as already done (engine/headStart.ts); 0 for none. */
  headStartMax: number;
  /** A comeback (engine/comeback.ts) is welcomed back, with a win-back round and the Phoenix theme. */
  comebacks: boolean;
}

export const FREE_LIMITS: Limits = {
  maxGoals: 1,
  weekdaySchedules: false,
  modesEnabled: false,
  themesEnabled: false,
  iconsEnabled: false,
  secretCredits: false,
  headStartMax: 0,
  comebacks: false,
};
export const PLUS_LIMITS: Limits = {
  maxGoals: 3,
  weekdaySchedules: true,
  modesEnabled: true,
  themesEnabled: true,
  iconsEnabled: true,
  secretCredits: true,
  headStartMax: HEAD_START_MAX,
  comebacks: true,
};
