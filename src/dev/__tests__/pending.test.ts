// The debug tools' summary of scheduled notifications.
import { describe, expect, it } from '@jest/globals';

import { summarizePending } from '../pending';

const n = (data: unknown) => ({ content: { data } });

describe('summarizePending', () => {
  it('counts what is scheduled and names the next to arrive', () => {
    const scheduled = [
      n({ goalId: 'g1', day: '2026-10-14', kind: 'checkin' }), // 10-14 20:00
      n({ goalId: 'g1', day: '2026-10-13', kind: 'morning' }), // 10-14 09:00
      n({ goalId: 'g1', day: '2026-11-03', kind: 'reengage' }),
    ];
    expect(summarizePending(scheduled)).toEqual({ count: 3, next: 'morning 10-13', tests: 0 });
    expect(summarizePending(scheduled.slice(0, 1))).toEqual({ count: 1, next: 'check-in 10-14', tests: 0 });
    expect(summarizePending([scheduled[2]!])).toEqual({ count: 1, next: 'nudge 11-03', tests: 0 });
  });

  it('puts a test check-in first, and counts what it cannot read', () => {
    const scheduled = [
      n({ goalId: 'g1', day: '2026-10-14', kind: 'checkin' }),
      n({ goalId: 'g1', day: '2026-10-13', kind: 'checkin', test: true }),
      n({}),
    ];
    expect(summarizePending(scheduled)).toEqual({ count: 3, next: 'test check-in', tests: 1 });
    expect(summarizePending([])).toEqual({ count: 0, next: null, tests: 0 });
  });
});
