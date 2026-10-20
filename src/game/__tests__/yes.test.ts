// The Yes celebration's numbers and its controller.
import { describe, expect, it, jest } from '@jest/globals';

import { ZERO_ASPECT } from '../sim/sizing';
import {
  createYesCelebration,
  reachOf,
  YES_FLOOD_MS,
  YES_POP_MS,
  YES_RISE,
  YES_ROUTE_MS,
  YES_SPARK_MS,
  YES_SPARKS,
  YES_TOTAL_MS,
  YES_ZERO_RY,
  yesFrame,
  yesOrigin,
  yesSpark,
  type Point,
  type Size,
} from '../yes';

const SCREENS: Size[] = [
  { width: 390, height: 844 }, // a phone
  { width: 360, height: 640 }, // a small Android phone
  { width: 1024, height: 1366 }, // a tablet
];
/** Taps across the screen, corners too. */
const tapsOn = ({ width, height }: Size): Point[] => [
  { x: width / 2, y: height * 0.62 },
  { x: 0, y: 0 },
  { x: width, y: height },
  { x: width * 0.8, y: height * 0.4 },
];
const each = (fn: (size: Size, at: Point) => void) => {
  for (const size of SCREENS) for (const at of tapsOn(size)) fn(size, at);
};
const corners = ({ width, height }: Size): Point[] => [
  { x: 0, y: 0 },
  { x: width, y: 0 },
  { x: 0, y: height },
  { x: width, y: height },
];
/** Whether (p) lies inside a zero-shaped oval of vertical radius `ry` centered at (x, y). */
const inside = (p: Point, x: number, y: number, ry: number) =>
  ((p.x - x) / (ry * ZERO_ASPECT)) ** 2 + ((p.y - y) / ry) ** 2 <= 1;
const range = (from: number, to: number, step = 10) => {
  const out: number[] = [];
  for (let t = from; t <= to; t += step) out.push(t);
  return out;
};

describe('the Yes celebration', () => {
  it('pops the zero out of the tap, overshooting a little, and floats it up', () => {
    each((size, at) => {
      const start = yesFrame(0, at, size);
      expect(start).toMatchObject({ x: at.x, y: at.y, coverAlpha: 0 });
      expect(start.hole + start.ring).toBeCloseTo(0);
      const sizes = range(0, YES_POP_MS - 1).map((t) => {
        const f = yesFrame(t, at, size);
        return f.hole + f.ring;
      });
      expect(Math.max(...sizes)).toBeGreaterThan(YES_ZERO_RY);
      expect(Math.max(...sizes)).toBeLessThan(YES_ZERO_RY * 1.2);
      const popped = yesFrame(YES_POP_MS, at, size);
      expect(popped.hole + popped.ring).toBeCloseTo(YES_ZERO_RY);
      expect(popped.y).toBeCloseTo(at.y - YES_RISE);
    });
  });

  it('floods the dark out until it covers every corner, as the round opens', () => {
    each((size, at) => {
      const covers = range(YES_POP_MS, YES_ROUTE_MS - 1, 5).map((t) => yesFrame(t, at, size).cover);
      for (let i = 1; i < covers.length; i++) expect(covers[i]!).toBeGreaterThanOrEqual(covers[i - 1]!);
      const covered = yesFrame(YES_ROUTE_MS, at, size);
      for (const c of corners(size)) expect(inside(c, covered.x, covered.y, covered.cover)).toBe(true);
      // Nothing of the screen beneath shows but the small hole in the middle.
      expect(covered.hole).toBeLessThan(YES_ZERO_RY * 1.5);
      expect(covered.x).toBeCloseTo(size.width / 2);
      expect(covered.y).toBeCloseTo(size.height / 2);
    });
  });

  it('then opens the hole past every corner, onto the round', () => {
    each((size, at) => {
      const holes = range(YES_ROUTE_MS, YES_TOTAL_MS, 5).map((t) => yesFrame(t, at, size).hole);
      for (let i = 1; i < holes.length; i++) expect(holes[i]!).toBeGreaterThanOrEqual(holes[i - 1]!);
      const open = yesFrame(YES_TOTAL_MS, at, size);
      for (const c of corners(size)) expect(inside(c, open.x, open.y, open.hole)).toBe(true);
      // The dark stays outside the hole and its ring all the way.
      for (const t of range(YES_ROUTE_MS, YES_TOTAL_MS)) {
        const f = yesFrame(t, at, size);
        expect(f.cover).toBeGreaterThanOrEqual(f.hole + f.ring);
      }
    });
  });

  it('moves without a jump between the pop, the flood and the opening', () => {
    each((size, at) => {
      for (const edge of [YES_POP_MS, YES_ROUTE_MS]) {
        const before = yesFrame(edge - 0.01, at, size);
        const after = yesFrame(edge, at, size);
        expect(after.x).toBeCloseTo(before.x, 0);
        expect(after.y).toBeCloseTo(before.y, 0);
        expect(after.hole).toBeCloseTo(before.hole, 0);
        expect(after.ring).toBeCloseTo(before.ring, 0);
      }
      // The rim fades out as the dark's edge leaves the screen.
      expect(yesFrame(YES_POP_MS, at, size).rimAlpha).toBe(1);
      expect(yesFrame(YES_POP_MS + YES_FLOOD_MS * 0.99, at, size).rimAlpha).toBeLessThan(0.05);
    });
  });

  it('bursts a capped number of mini zeros, gone before the round opens', () => {
    expect(YES_SPARKS).toBeLessThanOrEqual(16);
    expect(YES_SPARK_MS).toBeLessThan(YES_ROUTE_MS);
    const at = { x: 200, y: 500 };
    for (let i = 0; i < YES_SPARKS; i++) {
      const start = yesSpark(i, 0, at);
      const later = yesSpark(i, YES_SPARK_MS / 2, at);
      expect(start.alpha).toBe(1);
      expect(Math.hypot(later.x - at.x, later.y - at.y)).toBeGreaterThan(Math.hypot(start.x - at.x, start.y - at.y));
      expect(yesSpark(i, YES_SPARK_MS, at).alpha).toBe(0);
    }
  });

  it('starts low in the middle when the tap has no point', () => {
    const size = { width: 400, height: 800 };
    expect(yesOrigin(null, size)).toEqual({ x: 200, y: 496 });
    expect(yesOrigin({ x: 10, y: 20 }, size)).toEqual({ x: 10, y: 20 });
  });

  it('measures how far a zero-shaped oval has to reach for the farthest corner', () => {
    expect(reachOf(0, 0, { width: ZERO_ASPECT * 3, height: 4 })).toBeCloseTo(5);
  });
});

describe('the celebration controller', () => {
  const stage = (motion = true) => ({ motion: () => motion, cue: jest.fn() });

  it('plays for a Yes tap that opens the round, and holds the round until the screen is covered', () => {
    const yes = createYesCelebration();
    const s = stage();
    yes.mount(s);
    const heard = jest.fn();
    yes.subscribe(heard);
    const hold = yes.armed({ x: 1, y: 2 }, () => yes.begin());
    expect(hold).toBe(YES_ROUTE_MS);
    expect(s.cue).toHaveBeenCalledTimes(1);
    expect(yes.current()).toEqual({ origin: { x: 1, y: 2 }, id: 1 });
    expect(heard).toHaveBeenCalledTimes(1);
    yes.end(1);
    expect(yes.current()).toBeNull();
  });

  it('chimes but opens the round at once under reduced motion', () => {
    const yes = createYesCelebration();
    const s = stage(false);
    yes.mount(s);
    expect(yes.armed(null, () => yes.begin())).toBe(0);
    expect(s.cue).toHaveBeenCalledTimes(1);
    expect(yes.current()).toBeNull();
  });

  it('plays just the cue on its own, with no show and nothing to hold back', () => {
    const yes = createYesCelebration();
    yes.cue(); // nothing mounted: nothing to play
    const s = stage();
    yes.mount(s);
    yes.cue();
    expect(s.cue).toHaveBeenCalledTimes(1);
    expect(yes.current()).toBeNull();
  });

  it('stays still with nothing to draw it, as in the screen tests', () => {
    const yes = createYesCelebration();
    expect(yes.armed(null, () => yes.begin())).toBe(0);
    const s = stage();
    const unmount = yes.mount(s);
    unmount();
    expect(yes.armed(null, () => yes.begin())).toBe(0);
    expect(s.cue).not.toHaveBeenCalled();
  });

  it('never plays for a round opened any other way: a notification’s Yes, Play now, a turned-down tap', () => {
    const yes = createYesCelebration();
    const s = stage();
    yes.mount(s);
    expect(yes.begin()).toBe(0);
    // A turned-down Yes never opens the round, and leaves nothing armed behind it.
    yes.armed({ x: 0, y: 0 }, () => null);
    expect(yes.begin()).toBe(0);
    // Nor does one answer play twice.
    yes.armed(null, () => {
      yes.begin();
      expect(yes.begin()).toBe(0);
    });
    expect(s.cue).toHaveBeenCalledTimes(1);
    // An answer that throws disarms too.
    expect(() =>
      yes.armed(null, () => {
        throw new Error('no');
      }),
    ).toThrow('no');
    expect(yes.begin()).toBe(0);
  });

  it('ends only the show that finished', () => {
    const yes = createYesCelebration();
    yes.mount(stage());
    yes.armed(null, () => yes.begin());
    yes.armed(null, () => yes.begin());
    yes.end(1);
    expect(yes.current()?.id).toBe(2);
  });
});
