import { describe, expect, it } from '@jest/globals';

import { MISSED_GRACE_DAYS } from '@/engine';
import type { Notice } from '@/store/types';

import { copyFor } from '../notice';

const NOTICES: Notice[] = [
  { kind: 'slipping', cause: 'answer', lost: 1, streak: 4, days: 1, stopped: false },
  { kind: 'slipping', cause: 'missed', lost: 2, streak: 3, days: 9, stopped: false },
  { kind: 'slipping', cause: 'missed', lost: 1, streak: 5, days: 8, stopped: true },
  { kind: 'shielded', cause: 'missed', lost: 6, streak: 4, shieldsLeft: 1, days: 14 },
  { kind: 'reset', cause: 'missed', lostStreak: 6, bestStreak: 20, days: 14, stopped: false },
  { kind: 'noted' },
];

describe('copyFor', () => {
  const away: Notice = { kind: 'slipping', cause: 'missed', lost: 2, streak: 3, days: 9, stopped: false };

  it('says the free missed days last a week for a goal that checks in every day', () => {
    expect(copyFor(away).body).toContain('Missed days are free for a week; after that, each one takes a zero.');
    for (const n of NOTICES) expect(copyFor(n, { everyDay: true })).toEqual(copyFor(n));
  });

  it('counts them in check-ins for a goal on chosen days (SPEC 9)', () => {
    const body = copyFor(away, { everyDay: false }).body;
    expect(body).toContain(
      `The first ${MISSED_GRACE_DAYS} missed check-ins in a row are free; after that, each one takes a zero.`,
    );
    expect(body.join(' ')).not.toMatch(/week/);
  });

  it('changes nothing else', () => {
    const missedSlips = (n: Notice) => n.kind === 'slipping' && n.cause === 'missed';
    for (const n of NOTICES.filter((x) => !missedSlips(x))) {
      expect(copyFor(n, { everyDay: false })).toEqual(copyFor(n));
    }
  });
});
