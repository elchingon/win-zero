// Home's secret in Win Zero Plus: three quick taps on the Game credits count give a free Game
// credit. This counts the taps; nothing else about it lives here.

/** Taps in a row that open the secret. */
export const SECRET_TAPS = 3;
/** The longest wait between two taps of one run, in milliseconds. */
export const SECRET_TAP_GAP_MS = 450;

/**
 * A tap counter: call it with each tap's time. True on the tap that completes a quick run of
 * SECRET_TAPS, which then starts the count over; a slow tap starts a new run.
 */
export function secretTaps(): (at: number) => boolean {
  let run = 0;
  let last = -Infinity;
  return (at) => {
    run = at - last <= SECRET_TAP_GAP_MS ? run + 1 : 1;
    last = at;
    if (run < SECRET_TAPS) return false;
    run = 0;
    return true;
  };
}
