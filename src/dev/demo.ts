// The demo controls' numbers and words: the jump-to-day milestones, practice rounds, and the
// debug clock readout. Pure, so the app's development tools and the website's demo mode behave
// the same. Practice rounds also run in the app's perf builds (src/app/play.tsx).
import {
  clockTimeAt,
  dayKeyAt,
  MS_PER_DAY,
  MS_PER_HOUR,
  nextWindow,
  pendingWindow,
  type GoalState,
  type TimeZone,
} from '@/engine';

// Typed counts read the same everywhere: bonus rounds take one too.
export { parseCount } from '@/lib/format';

/** One per milestone: twin, scatter + first shield, first standard round, rocket, chain, first armored, nuke, a big fill. */
export const JUMP_DAYS = [3, 7, 8, 14, 30, 61, 100, 250];

/** Practice rounds have every weapon. */
export const PRACTICE_BEST = 100;
/** Practice rounds can be far bigger than a seeded run: the round is built straight from N. */
export const PRACTICE_MAX_N = 100_000;
/** Practice rounds come with this many free bombs, to try them without a long run. */
export const PRACTICE_BOMBS = 9;

/** How far the debug clock runs ahead: 'real time', or '+2d 3h'. */
export function offsetLabel(ms: number): string {
  if (ms === 0) return 'real time';
  const days = Math.floor(ms / MS_PER_DAY);
  const hours = Math.round((ms - days * MS_PER_DAY) / MS_PER_HOUR);
  return `+${days}d ${hours}h`;
}

/** The debug clock's readout: the time, zone, streak state, and the open or next check-in. */
export function debugReadout(goal: GoalState | null, now: Date, tz: TimeZone, offsetMs: number): string[] {
  const at = (d: Date) => `${dayKeyAt(d, tz)} ${clockTimeAt(d, tz)}`;
  const pending = goal ? pendingWindow(goal, now) : null;
  const next = goal ? nextWindow(goal) : null;
  return [
    `Now ${at(now)} (${offsetLabel(offsetMs)})`,
    `Zone ${tz}`,
    goal
      ? `Streak ${goal.streak} · slide ${goal.slide} · missed in a row ${goal.consecutiveMissed}${goal.paused ? ' · paused' : ''}`
      : 'No goal',
    pending ? `Open: ${pending.day} until ${at(pending.closesAt)}` : next ? `Next opens ${at(next.opensAt)}` : '',
  ].filter(Boolean);
}
