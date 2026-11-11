// What Win Zero Plus's Home shows first (SPEC 9): rounds ready to play, in goal order, then the
// open check-ins, the one that opened first, first; the other goals wait for their next check-in,
// or say they're on a break. Pure: it takes the clock.
import {
  breakStatus,
  dayKeyAt,
  endOfDay,
  latestScheduleEntry,
  nextWindow,
  pendingWindow,
  type BreakStatus,
  type CheckInWindow,
} from '@/engine';
import type { GoalSlot } from '@/store';

export interface HomeCards {
  /** Goals whose round a Yes earned and hasn't been played, in goal order. */
  ready: GoalSlot[];
  /** Goals with a check-in open now, the earliest opened first; goal order breaks a tie. */
  open: { slot: GoalSlot; window: CheckInWindow }[];
  /** Goals with nothing open, and their next check-in, or the break they're on or about to take. */
  later: { slot: GoalSlot; next: CheckInWindow; onBreak: BreakStatus | null }[];
  /** When something changes next (a window closes, or one opens, or a break's day ends), in epoch ms. */
  boundary: number;
}

export function homeCards(slots: readonly GoalSlot[], now: Date): HomeCards {
  const ready = slots.filter((slot) => slot.round !== null && !slot.round.played);
  const open: HomeCards['open'] = [];
  const later: HomeCards['later'] = [];
  const midnights: number[] = [];
  for (const slot of slots) {
    const window = pendingWindow(slot.goal, now);
    if (window) {
      open.push({ slot, window });
      continue;
    }
    const status = breakStatus(slot.goal, now);
    const onBreak = status && status.when !== 'over' ? status : null;
    later.push({ slot, next: nextWindow(slot.goal), onBreak });
    // A break's words change with the day: it starts, or its last day ends.
    if (onBreak) {
      const tz = latestScheduleEntry(slot.goal).tz;
      midnights.push(endOfDay(dayKeyAt(now, tz), tz).getTime());
    }
  }
  // Array sort is stable, so goals that opened together keep their order.
  open.sort((a, b) => a.window.opensAt.getTime() - b.window.opensAt.getTime());
  const edges = [...open.map((o) => o.window.closesAt.getTime()), ...later.map((l) => l.next.opensAt.getTime()), ...midnights];
  return { ready, open, later, boundary: Math.min(...edges) };
}
