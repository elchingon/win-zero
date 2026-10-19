// A fixed way to play a round, for the golden fingerprints: the same touches, weapon switches,
// bomb, reduce-motion stretch, frame lengths and Finish round every time, whatever the round
// does. It builds its own config rather than using fixtures, so the goldens can't move with them.
// Changing anything here changes every fingerprint: don't.
import { composeRound, fillPlan, WEAPONS, type WeaponDef } from '@/engine';

import { dropBomb } from '../bomb';
import { finishAll } from '../finish';
import { setReduceMotion, setWeapon } from '../input';
import { resetReport } from '../report';
import { createGame } from '../spawn';
import { step } from '../step';
import type { GameConfig, GameState, Phase } from '../types';

/** The frames every scripted round runs for: long enough to reach the result sheet. */
export const SCRIPT_FRAMES = 1200;

/** How the script's finger reaches the round: the calls a canvas makes on touch down, move and up. */
export interface Hands {
  down: (s: GameState, x: number, y: number) => void;
  move: (s: GameState, x: number, y: number) => void;
  up: (s: GameState) => void;
}

/** What a round adds up to, frame by frame, the way the screen reads its reports. */
export interface Tally {
  shots: number;
  hits: number;
  kills: number;
  armoredKills: number;
  blasts: number;
  bombs: number;
  finals: number;
  results: number;
}

export interface ScriptRun {
  state: GameState;
  tally: Tally;
  /** The bomb and Finish round went off (they do nothing once the round is won). */
  bombed: boolean;
  finished: boolean;
  phases: Phase[];
  /** Weapons that fired at least once. */
  fired: string[];
}

const WEAPON_EVERY = 60;
const RELEASE_EVERY = 150;
const RELEASE_FOR = 10;
/** Lift, press, lift, press, a frame apart: one of the two presses comes too soon to fire. */
const QUICK_TAP = 401;
const REDUCE_MOTION_FROM = 300;
const REDUCE_MOTION_TO = 420;
const BOMB_AT = 480;
const FINISH_AT = 900;
const LONG_FRAME_EVERY = 97;
const SLOW_FRAME_EVERY = 53;

export function scriptConfig(n: number): GameConfig {
  return {
    n,
    groups: composeRound(n).groups,
    fill: fillPlan(n),
    width: 390,
    height: 844,
    insetTop: 47,
    insetBottom: 34,
    weapon: WEAPONS[0] as WeaponDef,
    seed: 1000 + n,
    reduceMotion: false,
  };
}

function frameDt(f: number): number {
  if (f % LONG_FRAME_EVERY === LONG_FRAME_EVERY - 1) return 0.07; // past MAX_DT: clamped
  if (f % SLOW_FRAME_EVERY === SLOW_FRAME_EVERY - 1) return 1 / 30; // two bullet sub-steps
  return 1 / 60;
}

/** Where the finger is on frame `f`: sweeping across and up and down the upper board. */
function finger(s: GameState, f: number): { x: number; y: number } {
  const span = s.bottom - s.top;
  return {
    x: s.width / 2 + Math.sin(f * 0.045) * s.width * 0.45,
    y: s.top + span * (0.35 + 0.3 * Math.sin(f * 0.023)),
  };
}

/** Play `cfg` through the script. `onFrame` sees the state after each step, before its report is reset. */
export function runScript(cfg: GameConfig, hands: Hands, onFrame?: (s: GameState, f: number) => void): ScriptRun {
  const s = createGame(cfg);
  const tally: Tally = { shots: 0, hits: 0, kills: 0, armoredKills: 0, blasts: 0, bombs: 0, finals: 0, results: 0 };
  const phases = new Set<Phase>([s.phase]);
  const fired = new Set<string>();
  let bombed = false;
  let finished = false;

  for (let f = 0; f < SCRIPT_FRAMES; f++) {
    // Inputs first, as touches and buttons land between frames.
    if (f % WEAPON_EVERY === 0) setWeapon(s, WEAPONS[(f / WEAPON_EVERY) % WEAPONS.length] as WeaponDef);
    if (f === REDUCE_MOTION_FROM) setReduceMotion(s, true);
    if (f === REDUCE_MOTION_TO) setReduceMotion(s, false);
    const p = finger(s, f);
    const tap = f - QUICK_TAP;
    if (tap === 0 || tap === 2 || f % RELEASE_EVERY === RELEASE_EVERY - RELEASE_FOR) hands.up(s);
    else if (tap === 1 || tap === 3 || f % RELEASE_EVERY === 0) hands.down(s, p.x, p.y);
    else hands.move(s, p.x, p.y);
    if (f === BOMB_AT) bombed = dropBomb(s);
    if (f === FINISH_AT) finished = finishAll(s);

    step(s, frameDt(f));
    phases.add(s.phase);
    onFrame?.(s, f);

    // What GameCanvas does with each frame's report.
    const r = s.report;
    if (r.shots > 0) fired.add(s.weapon.id);
    tally.shots += r.shots;
    tally.hits += r.hits;
    tally.kills += r.kills;
    tally.armoredKills += r.armoredKills;
    tally.blasts += r.blasts;
    tally.bombs += r.bombs;
    if (r.final) tally.finals++;
    if (r.showResult) tally.results++;
    resetReport(r);
  }
  return { state: s, tally, bombed, finished, phases: [...phases], fired: [...fired] };
}

/**
 * When to write a fingerprint line: every 100 frames, as each phase begins and 5 frames into
 * it, and on the last frame.
 */
export function makeCheckpoints(): (s: GameState, f: number) => boolean {
  let phase: Phase | null = null;
  let since = 0;
  return (s, f) => {
    if (s.phase !== phase) {
      phase = s.phase;
      since = 0;
    } else {
      since++;
    }
    return since === 0 || since === 5 || f % 100 === 99 || f === SCRIPT_FRAMES - 1;
  };
}

/** A running 32-bit FNV-1a hash over numbers, strings and booleans. */
export interface Hasher {
  num: (v: number) => void;
  str: (v: string) => void;
  bool: (v: boolean) => void;
  hex: () => string;
}

const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;
/** Numbers are compared to a millionth: far finer than a point or a frame, coarser than float noise. */
const NUM_SCALE = 1e6;
const TWO_32 = 4294967296;

export function makeHasher(): Hasher {
  let h = FNV_OFFSET;
  const word = (w: number) => {
    h = Math.imul(h ^ (w | 0), FNV_PRIME);
  };
  const str = (v: string) => {
    word(v.length);
    for (let i = 0; i < v.length; i++) word(v.charCodeAt(i));
  };
  return {
    num: (v) => {
      if (!Number.isFinite(v)) {
        // Infinity (a round's first sinceShot) and NaN stay distinct from every number.
        word(0x7ff00000);
        str(String(v));
        return;
      }
      const q = Math.round(v * NUM_SCALE);
      word(q % TWO_32);
      word(Math.floor(q / TWO_32));
    },
    str,
    bool: (v) => word(v ? 0x5eed1 : 0x5eed0),
    hex: () => (h >>> 0).toString(16).padStart(8, '0'),
  };
}
