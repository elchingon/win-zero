// What Home shows first with several goals (SPEC 9): rounds ready to play, in goal order, then the
// open check-ins, the one that opened first, first; the other goals wait for their next check-in.
// Pure: it takes the clock.
import { nextWindow, pendingWindow, type CheckInWindow } from '@/engine';
import type { GoalSlot } from '@/store';

export interface HomeCards {
  /** Goals whose round a Yes earned and hasn't been played, in goal order. */
  ready: GoalSlot[];
  /** Goals with a check-in open now, the earliest opened first; goal order breaks a tie. */
  open: { slot: GoalSlot; window: CheckInWindow }[];
  /** Goals with nothing open, and their next check-in. */
  later: { slot: GoalSlot; next: CheckInWindow }[];
  /** When something changes next (a window closes, or one opens), in epoch ms. */
  boundary: number;
}

export function homeCards(slots: readonly GoalSlot[], now: Date): HomeCards {
  const ready = slots.filter((slot) => slot.round !== null && !slot.round.played);
  const open: HomeCards['open'] = [];
  const later: HomeCards['later'] = [];
  for (const slot of slots) {
    const window = pendingWindow(slot.goal, now);
    if (window) open.push({ slot, window });
    else later.push({ slot, next: nextWindow(slot.goal) });
  }
  // Array sort is stable, so goals that opened together keep their order.
  open.sort((a, b) => a.window.opensAt.getTime() - b.window.opensAt.getTime());
  const edges = [...open.map((o) => o.window.closesAt.getTime()), ...later.map((l) => l.next.opensAt.getTime())];
  return { ready, open, later, boundary: Math.min(...edges) };
}
