// Home's card after a move to Win Zero Plus: where the goals went once Plus confirmed, and the
// question about a move Plus never confirmed, only once it's had time to finish.
import { describe, expect, it } from '@jest/globals';

import { MOVE_CHECK_AFTER_MS, moveCardFor, moveCheckAt } from '../moved';

const sentAt = '2026-10-15T03:00:00.000Z';
const t = (ms: number) => new Date(Date.parse(sentAt) + ms);

describe('moveCardFor', () => {
  it('shows nothing without a move, and where the goals went once moved', () => {
    expect(moveCardFor(null, t(0))).toBeNull();
    expect(moveCardFor({ id: 'm1', status: 'moved', sentAt }, t(0))).toBe('moved');
  });

  it('asks about a move Plus never confirmed, after MOVE_CHECK_AFTER_MS', () => {
    const sent = { id: 'm1', status: 'sent' as const, sentAt };
    expect(moveCheckAt(sent)).toBe(t(MOVE_CHECK_AFTER_MS).getTime());
    expect(moveCardFor(sent, t(MOVE_CHECK_AFTER_MS - 1))).toBeNull();
    expect(moveCardFor(sent, t(MOVE_CHECK_AFTER_MS))).toBe('check');
    expect(moveCheckAt({ ...sent, status: 'moved' })).toBeNull();
  });
});
