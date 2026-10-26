// Home settles its check-ins the moment a window opens or closes: a timer to the next boundary,
// kept short in case the device clock jumps, that refreshes the store and renders again.
import { useCallback, useEffect, useState } from 'react';

import { appStore, useApp } from '@/store';

/** Re-check at least this often, in case the device clock jumps. */
export const MAX_TIMER_MS = 60 * 60 * 1000;
/** Fire just after a window boundary, not on it. */
export const BOUNDARY_SLACK_MS = 500;

/**
 * Refresh just after `boundary` (epoch ms on the app clock), and again whenever the debug clock
 * moves. Returns the render count it drives, and `bump` to render again for another timer.
 */
export function useBoundaryRefresh(boundary: number): { tick: number; clockOffset: number; bump: () => void } {
  const clockOffset = useApp((s) => s.devClockOffsetMs); // re-render when the debug clock moves
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const wait = Math.max(0, boundary - appStore.getState().now().getTime()) + BOUNDARY_SLACK_MS;
    const id = setTimeout(() => {
      appStore.getState().refresh();
      setTick((t) => t + 1);
    }, Math.min(MAX_TIMER_MS, wait));
    return () => clearTimeout(id);
  }, [boundary, tick, clockOffset]);
  const bump = useCallback(() => setTick((t) => t + 1), []);
  return { tick, clockOffset, bump };
}
