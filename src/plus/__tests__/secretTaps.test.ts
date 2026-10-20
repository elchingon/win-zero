import { describe, expect, it } from '@jest/globals';

import { SECRET_TAP_GAP_MS, SECRET_TAPS, secretTaps } from '../home/secretTaps';

/** Tap at each time; the taps that opened the secret, by their place. */
function run(times: number[]): number[] {
  const tap = secretTaps();
  return times.flatMap((t, i) => (tap(t) ? [i] : []));
}

describe("Home's secret taps (Win Zero Plus)", () => {
  it('opens on the third quick tap, then starts over', () => {
    expect(SECRET_TAPS).toBe(3);
    expect(run([0, 100, 200])).toEqual([2]);
    expect(run([0, 100, 200, 300, 400, 500])).toEqual([2, 5]);
  });

  it('allows up to the gap between taps, and starts a new run after a slower one', () => {
    const g = SECRET_TAP_GAP_MS;
    expect(run([0, g, 2 * g])).toEqual([2]);
    expect(run([0, g + 1, 2 * g + 2])).toEqual([]);
    expect(run([0, 100, 100 + g + 1, 200 + g, 300 + g])).toEqual([4]);
  });
});
