// Each app keeps its own Xcode project (scripts/ios-workspace.cjs, used by scripts/prebuild.mjs):
// both build in ios/, and the one not being built waits, untouched, in .ios-parked/.
import { describe, expect, it } from '@jest/globals';

import { planIosSwitch } from '../../../scripts/ios-workspace.cjs';

const none = { free: false, plus: false };

describe('planIosSwitch', () => {
  it('starts from nothing: prebuild makes the first project', () => {
    expect(planIosSwitch({ active: null, parked: none }, 'free')).toEqual({ moves: [], parked: null, restored: false });
    expect(planIosSwitch({ active: null, parked: none }, 'plus')).toEqual({ moves: [], parked: null, restored: false });
  });

  it('leaves the same app where it is', () => {
    expect(planIosSwitch({ active: 'plus', parked: none }, 'plus')).toEqual({ moves: [], parked: null, restored: false });
    expect(planIosSwitch({ active: 'free', parked: { free: false, plus: true } }, 'free')).toEqual({
      moves: [],
      parked: null,
      restored: false,
    });
  });

  it("parks the other app's project when this app has none yet", () => {
    // Today's layout before the first switch: Plus in ios/, nothing parked.
    expect(planIosSwitch({ active: 'plus', parked: none }, 'free')).toEqual({
      moves: [{ from: 'ios', to: '.ios-parked/plus' }],
      parked: 'plus',
      restored: false,
    });
  });

  it("parks the other app's project, then brings this app's back", () => {
    expect(planIosSwitch({ active: 'free', parked: { free: false, plus: true } }, 'plus')).toEqual({
      moves: [
        { from: 'ios', to: '.ios-parked/free' },
        { from: '.ios-parked/plus', to: 'ios' },
      ],
      parked: 'free',
      restored: true,
    });
  });

  it('brings a parked project back when ios/ is gone', () => {
    expect(planIosSwitch({ active: null, parked: { free: true, plus: false } }, 'free')).toEqual({
      moves: [{ from: '.ios-parked/free', to: 'ios' }],
      parked: null,
      restored: true,
    });
  });

  it('never renames over a project', () => {
    // ios/ is Win Zero, and an older Win Zero project is already parked.
    expect(() => planIosSwitch({ active: 'free', parked: { free: true, plus: true } }, 'plus')).toThrow(
      "ios/ holds Win Zero's Xcode project, and so does .ios-parked/free/",
    );
    // ios/ is already Plus, and so is .ios-parked/plus.
    expect(() => planIosSwitch({ active: 'plus', parked: { free: false, plus: true } }, 'plus')).toThrow(
      "Both ios/ and .ios-parked/plus/ hold Win Zero Plus's Xcode project",
    );
  });

  it('refuses a folder marked for neither app', () => {
    expect(() => planIosSwitch({ active: 'pro', parked: none }, 'free')).toThrow('ios/ is marked as "pro"');
    expect(() => planIosSwitch({ active: null, parked: none }, 'pro' as 'free')).toThrow('No app called "pro"');
  });
});
