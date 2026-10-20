'worklet';
// Slice (SPEC 9): zeros are tossed up from the bottom edge of the board, a few at a time, and a
// swipe cuts them. A cut is a hit from the power-up's weapon (its damage, splash and chain); a
// zero that survives one (energy and armored zeros) is juggled higher with each cut until it
// pops. A zero that falls back unsliced waits on the bottom edge for another toss. Late in the
// round, tosses float and the blade reaches further, so the last zero is easy to cut.
//
// A zero waiting for its toss sits on the bottom edge, hidden and out of reach through its
// pop-in delay; it launches the moment it appears. So a bomb, or Finish round, that brings it in
// early simply tosses it.
import type { WeaponId } from '@/engine';

import { armorBadges } from '../badges';
import { catchable, keepOnBoard, liveZeros } from '../board';
import { ASSIST_LAST, HIT_FLASH } from '../constants';
import { segmentHitsZero } from '../hit';
import { between, random } from '../rng';
import { ZERO_ASPECT, zeroRadius } from '../sizing';
import type { GameConfig, GameState, SliceState, TrailPoint, Zero } from '../types';
import { applyHit } from '../weapons';
import { readyZero, zeroSize } from './place';

/** Points on the blade's trail, and how long one lasts (the Lingering Blade's cut for longer). */
export const SLICE_TRAIL = 24;
export const SLICE_TRAIL_LIFE = 0.22;
/** The finger has to move at least this far between reports to cut. */
export const SLICE_MIN_MOVE = 3;
/** A swish sounds for every this many points the blade sweeps. */
export const SLICE_SWISH_MIN = 140;

/** A toss to the top of the board takes this long to get there; armored zeros float, at this share of the pull. */
export const SLICE_RISE_S = 1.1;
export const SLICE_ARMOR_FLOAT = 0.45;
/** Tosses peak between these shares of the board's height above the bottom edge. */
export const SLICE_TOSS_MIN = 0.45;
export const SLICE_TOSS_MAX = 0.95;
/** Tosses head for this middle share of the board's width. */
export const SLICE_AIM = 0.6;
/** Zeros kept in the air (or on their way up), and the gap between tosses. */
export const SLICE_AIRBORNE = 5;
export const SLICE_STAGGER = 0.18;
/** The first toss waits this long, for the round to settle in. */
export const SLICE_FIRST_TOSS = 0.4;
/** A waiting zero's pop-in is put off by this much until its toss comes: always finite. */
export const SLICE_PARKED = 1e9;

/** A cut juggles a zero up this share of the board's height, and higher by SLICE_JUGGLE_GROW for every cut before. */
export const SLICE_JUGGLE = 0.25;
export const SLICE_JUGGLE_GROW = 0.15;
/** No second cut of the same zero within this long: one stroke cuts it once. */
export const SLICE_COOLDOWN = 0.25;
/** A ceiling hit keeps this much of the speed, heading down. */
export const SLICE_CEILING_KEEP = 0.3;

/** Twin Blade: the two blades run this far apart. */
export const SLICE_TWIN_GAP = 26;

/** Assist: once nothing's been cut for this long, as when only ASSIST_LAST are left. */
export const SLICE_ASSIST_IDLE = 3;
/** Late tosses fall at this share of the pull, the blade reaches this much further, and airborne zeros drift toward it. */
export const SLICE_ASSIST_FLOAT = 0.55;
export const SLICE_ASSIST_REACH = 24;
export const SLICE_ASSIST_PULL = 1.5;
/** The drift toward the blade never goes faster than this many board widths a second. */
export const SLICE_ASSIST_DRIFT_MAX = 0.5;

export interface SlicePower {
  blades: number;
  /** How far past a zero's edge the blade cuts, in points. */
  reach: number;
  /** How long the trail keeps cutting after the finger has passed, in seconds; 0 for a moment's cut. */
  linger: number;
}

/**
 * Each power-up, by the weapon tier it stands for (engine MODES): Blade, Twin Blade, Wide Arc,
 * Explosive Cut, Arcing Cut, Lingering Blade, Nova. A cut hits with the weapon's damage, splash
 * and chain.
 */
export const SLICE_POWER: Readonly<Record<WeaponId, SlicePower>> = {
  pea: { blades: 1, reach: 0, linger: 0 },
  twin: { blades: 2, reach: 0, linger: 0 },
  scatter: { blades: 1, reach: 22, linger: 0 },
  rocket: { blades: 1, reach: 6, linger: 0 },
  chain: { blades: 1, reach: 6, linger: 0 },
  laser: { blades: 1, reach: 6, linger: 0.6 },
  nuke: { blades: 1, reach: 30, linger: 0 },
};

/** Slice's state for `count` zeros. */
export function makeSliceState(count: number): SliceState {
  const trail: TrailPoint[] = [];
  for (let i = 0; i < SLICE_TRAIL; i++) trail.push({ x: 0, y: 0, age: 0, stroke: 0 });
  const launched: boolean[] = [];
  const cuts: number[] = [];
  for (let i = 0; i < count; i++) {
    launched.push(false);
    cuts.push(0);
  }
  return {
    mode: 'slice',
    trail,
    head: 0,
    count: 0,
    stroke: 0,
    lastX: 0,
    lastY: 0,
    swing: 0,
    tossIn: SLICE_FIRST_TOSS,
    cursor: 0,
    blades: 1,
    reach: 0,
    linger: 0,
    assist: false,
    launched,
    cuts,
  };
}

/** A zero waits, out of sight, on the bottom edge at a fresh spot for its next toss. */
function park(s: GameState, z: Zero): void {
  z.x = between(s.rng, z.rx, Math.max(z.rx, s.width - z.rx));
  z.y = s.bottom - z.ry;
  z.vx = 0;
  z.vy = 0;
  z.delay = z.age + SLICE_PARKED;
}

/** Every zero waits on the bottom edge for its toss. */
export function placeSlice(s: GameState, cfg: GameConfig): void {
  const ss = s.modeState;
  if (ss.mode !== 'slice') return;
  const base = zeroRadius(s.objectCount, s.width, s.height);
  const badges = armorBadges(cfg.groups);
  let i = 0;
  for (let g = 0; g < cfg.groups.length; g++) {
    const group = cfg.groups[g];
    if (!group) continue;
    const armored = group.kind === 'armored';
    for (let k = 0; k < group.count; k++) {
      const z = s.zeros[i];
      if (!z) return;
      readyZero(z, group, armored ? badges.indexOf(group.value) : -1, i);
      z.ry = zeroSize(s, base, armored);
      z.rx = z.ry * ZERO_ASPECT;
      park(s, z);
      i++;
    }
  }
}

/** The pull on a zero in the air: armored zeros float, and late tosses hang. */
function gravity(s: GameState, ss: SliceState, z: Zero): number {
  const g = (2 * (s.bottom - s.top)) / (SLICE_RISE_S * SLICE_RISE_S);
  return g * (z.kind === 'armored' ? SLICE_ARMOR_FLOAT : 1) * (ss.assist ? SLICE_ASSIST_FLOAT : 1);
}

/** The speed that carries a zero up `height` points against the pull. */
function upSpeed(s: GameState, ss: SliceState, z: Zero, height: number): number {
  return -Math.sqrt(2 * gravity(s, ss, z) * Math.max(0, height));
}

/** Toss a zero that's just appeared on the bottom edge, up toward the middle. */
function launch(s: GameState, ss: SliceState, z: Zero, i: number): void {
  ss.launched[i] = true;
  ss.cuts[i] = 0;
  const room = s.bottom - s.top - 2 * z.ry;
  const height = room * between(s.rng, SLICE_TOSS_MIN, SLICE_TOSS_MAX);
  z.vy = upSpeed(s, ss, z, height);
  const rise = -z.vy / gravity(s, ss, z);
  const aimX = s.width * (0.5 + (random(s.rng) - 0.5) * SLICE_AIM);
  z.vx = rise > 0 ? (aimX - z.x) / rise : 0;
}

/** Bring the next waiting zeros in, staggered, until enough are in the air. */
function toss(s: GameState, ss: SliceState, dt: number): void {
  ss.tossIn = Math.max(0, ss.tossIn - dt);
  if (ss.tossIn > 0 || s.phase !== 'play') return;
  let inPlay = 0;
  let alive = 0;
  for (let i = 0; i < s.zeros.length; i++) {
    const z = s.zeros[i];
    if (!z || !z.alive) continue;
    alive++;
    if (ss.launched[i] || z.delay - z.age < SLICE_PARKED / 2) inPlay++;
  }
  if (inPlay >= Math.min(SLICE_AIRBORNE, alive)) return;
  for (let n = 0; n < s.zeros.length; n++) {
    const i = (ss.cursor + n) % s.zeros.length;
    const z = s.zeros[i];
    if (!z || !z.alive || ss.launched[i] || z.delay - z.age < SLICE_PARKED / 2) continue;
    z.delay = z.age;
    ss.cursor = (i + 1) % s.zeros.length;
    ss.tossIn = ss.assist ? 0 : SLICE_STAGGER;
    return;
  }
}

/** Cut zero `i`: a hit, then (if it survives) a juggle, higher every time. */
function cut(s: GameState, ss: SliceState, z: Zero, i: number): void {
  z.cooldown = SLICE_COOLDOWN;
  const cuts = (ss.cuts[i] ?? 0) + 1;
  ss.cuts[i] = cuts;
  applyHit(s, s.weapon, z);
  if (!z.alive) return;
  const board = s.bottom - s.top;
  const height = Math.min(z.y - (s.top + z.ry), board * SLICE_JUGGLE * (1 + SLICE_JUGGLE_GROW * (cuts - 1)));
  z.vy = Math.min(z.vy, upSpeed(s, ss, z, height));
}

/** The blade from (x1, y1) to (x2, y2) cuts every zero in the air it crosses. */
function cutAlong(s: GameState, ss: SliceState, x1: number, y1: number, x2: number, y2: number): void {
  const reach = ss.reach + (ss.assist ? SLICE_ASSIST_REACH : 0);
  const len = Math.sqrt((x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1));
  // Twin Blade: two blades either side of the stroke.
  const nx = ss.blades > 1 && len > 0 ? (-(y2 - y1) / len) * (SLICE_TWIN_GAP / 2) : 0;
  const ny = ss.blades > 1 && len > 0 ? ((x2 - x1) / len) * (SLICE_TWIN_GAP / 2) : 0;
  for (let i = 0; i < s.zeros.length; i++) {
    const z = s.zeros[i];
    if (!z || !catchable(z) || !ss.launched[i]) continue;
    const hit =
      ss.blades > 1
        ? segmentHitsZero(x1 + nx, y1 + ny, x2 + nx, y2 + ny, z, reach) ||
          segmentHitsZero(x1 - nx, y1 - ny, x2 - nx, y2 - ny, z, reach)
        : segmentHitsZero(x1, y1, x2, y2, z, reach);
    if (hit) cut(s, ss, z, i);
  }
}

/** The newest point on the trail, or null before the first. */
function newest(ss: SliceState): TrailPoint | null {
  return ss.count > 0 ? (ss.trail[ss.head] ?? null) : null;
}

function addPoint(ss: SliceState, x: number, y: number): void {
  ss.head = (ss.head + 1) % ss.trail.length;
  ss.count = Math.min(ss.trail.length, ss.count + 1);
  const p = ss.trail[ss.head];
  if (!p) return;
  p.x = x;
  p.y = y;
  p.age = 0;
  p.stroke = ss.stroke;
}

/** The blade's power from the power-up, and whether it's late in the round. */
function applyPower(s: GameState, ss: SliceState): void {
  const p = SLICE_POWER[s.weapon.id];
  ss.blades = p.blades;
  ss.reach = p.reach;
  ss.linger = p.linger;
  ss.assist = s.phase === 'play' && (s.sinceDamage >= SLICE_ASSIST_IDLE || liveZeros(s) <= ASSIST_LAST);
}

/** The finger lands: a new stroke starts there. */
export function sliceDown(s: GameState, x: number, y: number): void {
  const ss = s.modeState;
  if (ss.mode !== 'slice') return;
  ss.stroke++;
  ss.swing = 0;
  ss.lastX = x;
  ss.lastY = y;
  addPoint(ss, x, y);
}

/** The finger moves: the blade cuts along the way. */
export function sliceMove(s: GameState, x: number, y: number): void {
  const ss = s.modeState;
  if (ss.mode !== 'slice') return;
  const x0 = ss.lastX;
  const y0 = ss.lastY;
  const len = Math.sqrt((x - x0) * (x - x0) + (y - y0) * (y - y0));
  if (len < SLICE_MIN_MOVE) return;
  ss.lastX = x;
  ss.lastY = y;
  // A trail that faded while the finger rested starts again from where it rested.
  const last = newest(ss);
  if (!last || last.x !== x0 || last.y !== y0) addPoint(ss, x0, y0);
  addPoint(ss, x, y);
  if (s.phase !== 'play') return;
  applyPower(s, ss);
  ss.swing += len;
  if (ss.swing >= SLICE_SWISH_MIN) {
    ss.swing = 0;
    s.report.swishes++;
    s.report.dirty = true;
  }
  cutAlong(s, ss, x0, y0, x, y);
}

/** The trail ages; the Lingering Blade's keeps cutting while it's fresh. */
function ageTrail(s: GameState, ss: SliceState, dt: number): void {
  const life = Math.max(SLICE_TRAIL_LIFE, ss.linger);
  for (let n = 0; n < ss.count; n++) {
    const p = ss.trail[(ss.head - n + ss.trail.length) % ss.trail.length];
    if (p) p.age += dt;
  }
  // Drop the oldest points once they've faded.
  while (ss.count > 0) {
    const oldest = ss.trail[(ss.head - ss.count + 1 + ss.trail.length) % ss.trail.length];
    if (!oldest || oldest.age <= life) break;
    ss.count--;
  }
  if (ss.linger <= 0 || s.phase !== 'play') return;
  for (let n = 0; n + 1 < ss.count; n++) {
    const a = ss.trail[(ss.head - n - 1 + ss.trail.length) % ss.trail.length];
    const b = ss.trail[(ss.head - n + ss.trail.length) % ss.trail.length];
    if (!a || !b || a.stroke !== b.stroke || b.age > ss.linger) continue;
    cutAlong(s, ss, a.x, a.y, b.x, b.y);
  }
}

/** One frame of Slice: tosses go up, zeros fly and fall, and the trail fades. */
export function stepSlice(s: GameState, dt: number): void {
  const ss = s.modeState;
  if (ss.mode !== 'slice') return;
  applyPower(s, ss);
  toss(s, ss, dt);
  // The fill freezes whatever's left behind it.
  const moving = s.phase === 'play' || s.phase === 'celebrate';
  const last = newest(ss);
  const pull = ss.assist && s.pointer.down && last !== null;
  for (let i = 0; i < s.zeros.length; i++) {
    const z = s.zeros[i];
    if (!z || !z.alive) continue;
    z.age += dt;
    if (z.hitFlash > 0) z.hitFlash = Math.max(0, z.hitFlash - dt / HIT_FLASH);
    if (z.cooldown > 0) z.cooldown = Math.max(0, z.cooldown - dt);
    if (!moving || z.age < z.delay) continue;
    if (!ss.launched[i]) launch(s, ss, z, i);
    z.vy += gravity(s, ss, z) * dt;
    if (pull && last) {
      const most = SLICE_ASSIST_DRIFT_MAX * s.width;
      z.vx = Math.max(-most, Math.min(most, z.vx + (last.x - z.x) * SLICE_ASSIST_PULL * dt));
    }
    z.x += z.vx * dt;
    z.y += z.vy * dt;
    if (z.x < z.rx) {
      z.x = z.rx;
      z.vx = Math.abs(z.vx);
    } else if (z.x > s.width - z.rx) {
      z.x = s.width - z.rx;
      z.vx = -Math.abs(z.vx);
    }
    if (z.y < s.top + z.ry) {
      z.y = s.top + z.ry;
      z.vy = Math.abs(z.vy) * SLICE_CEILING_KEEP;
    }
    // Back down unsliced: it waits for another toss.
    if (z.vy > 0 && z.y >= s.bottom - z.ry) {
      ss.launched[i] = false;
      park(s, z);
    }
    keepOnBoard(z, s);
  }
  ageTrail(s, ss, dt);
}
