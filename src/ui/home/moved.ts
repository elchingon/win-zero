// Home's word on a move to Win Zero Plus (SPEC 9): where the goals went, once Plus confirmed; or,
// when Plus never said, a question after a while.
import { MS_PER_MINUTE } from '@/engine';
import type { MoveOut } from '@/store';

/** How long Win Zero waits to hear from Plus before asking whether the move finished. */
export const MOVE_CHECK_AFTER_MS = 10 * MS_PER_MINUTE;

/** When the question is due, or null when no move is waiting. */
export function moveCheckAt(moveOut: MoveOut | null): number | null {
  return moveOut?.status === 'sent' ? Date.parse(moveOut.sentAt) + MOVE_CHECK_AFTER_MS : null;
}

export function moveCardFor(moveOut: MoveOut | null, now: Date): 'moved' | 'check' | null {
  if (moveOut?.status === 'moved') return 'moved';
  const due = moveCheckAt(moveOut);
  return due !== null && now.getTime() >= due ? 'check' : null;
}
