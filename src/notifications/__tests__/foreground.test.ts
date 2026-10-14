// How a notification shows while the app is open.
import { describe, expect, it } from '@jest/globals';

import { foregroundBehavior } from '../foreground';

const checkIn = { goalId: 'g1', day: '2026-10-13', kind: 'checkin' };
const morning = { ...checkIn, kind: 'morning' };
const nudge = { ...checkIn, kind: 'reengage' };

const SHOWN = { shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false };
const QUIET = { shouldShowBanner: false, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false };
const NONE = { shouldShowBanner: false, shouldShowList: false, shouldPlaySound: false, shouldSetBadge: false };

describe('foregroundBehavior', () => {
  it('keeps quiet on Home, where the card asks the same question, and during a round', () => {
    expect(foregroundBehavior('/', checkIn)).toEqual(QUIET);
    expect(foregroundBehavior('/', morning)).toEqual(QUIET);
    expect(foregroundBehavior('/play', checkIn)).toEqual(QUIET);
  });

  it('shows a check-in as usual anywhere else', () => {
    for (const path of ['/settings', '/notice', '/setup', null]) {
      expect(foregroundBehavior(path, checkIn)).toEqual(SHOWN);
      expect(foregroundBehavior(path, morning)).toEqual(SHOWN);
    }
    expect(foregroundBehavior('/settings', { ...checkIn, test: true })).toEqual(SHOWN);
  });

  it("doesn't show the weekly nudge at all: the app is already open", () => {
    for (const path of ['/', '/play', '/settings', null]) expect(foregroundBehavior(path, nudge)).toEqual(NONE);
  });

  it("treats anything that isn't ours like a check-in", () => {
    expect(foregroundBehavior('/settings', {})).toEqual(SHOWN);
    expect(foregroundBehavior('/', undefined)).toEqual(QUIET);
  });
});
