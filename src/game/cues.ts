// What a frame's report sounds and feels like: which sounds to play and which haptics to fire.
// Pure (the clock comes in as `nowMs`), so the throttling can be tested.
import type { Report } from './sim/types';

/** Pops closer together than this blur into one, as in the prototype. */
export const POP_MIN_MS = 35;
/** Kill haptics closer together than this feel like one long buzz. */
export const KILL_HAPTIC_MIN_MS = 60;

export interface Cues {
  shoot: boolean;
  pop: boolean;
  boom: boolean;
  killHaptic: boolean;
  bombHaptic: boolean;
  boomHaptic: boolean;
}

/** A gate that opens at most once per `minMs`. */
export function makeGate(minMs: number): (nowMs: number) => boolean {
  let last = -Infinity;
  return (nowMs) => {
    if (nowMs - last < minMs) return false;
    last = nowMs;
    return true;
  };
}

/** A cue sheet for one round: call it with each report and the time it arrived. */
export function makeCues(): (report: Report, nowMs: number) => Cues {
  const popGate = makeGate(POP_MIN_MS);
  const killGate = makeGate(KILL_HAPTIC_MIN_MS);
  return (r, nowMs) => {
    // The last zero and bombs get the boom; their kills don't pop on top of it.
    const big = r.final || r.bombs > 0;
    return {
      shoot: r.shots > 0,
      boom: big,
      pop: !big && (r.kills > 0 || r.blasts > 0) && popGate(nowMs),
      killHaptic: !big && r.kills > 0 && killGate(nowMs),
      bombHaptic: r.bombs > 0 && !r.final,
      boomHaptic: r.final,
    };
  };
}
