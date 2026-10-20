'worklet';
// Catch (SPEC 9): zeros drift down the board, and cups at the bottom catch them. A catch is a hit
// from the power-up's weapon (its damage, splash and chain); a zero that survives it (energy and
// armored zeros) is juggled, hopping in its cup until it pops. A zero that lands beside the cups
// floats back up and drifts down again. One missed twice, or every one late in the round,
// steers into a cup, so a round always ends, even with a cup that never moves. The cups follow
// the finger's x, and start in the middle.
import type { WeaponId } from '@/engine';

import { armorBadges } from '../badges';
import { catchable, keepOnBoard, liveZeros } from '../board';
import { ASSIST_LAST, HIT_FLASH } from '../constants';
import { between, random, spread } from '../rng';
import { ZERO_ASPECT, zeroRadius } from '../sizing';
import type { CatchPull, CatchState, GameConfig, GameState, Zero } from '../types';
import { applyHit } from '../weapons';
import { popInSpan, readyZero, zeroSize } from './place';

/** How a zero moves: drifting down, hopping in a cup after a catch, or floating back up after a miss. */
export const CATCH_DRIFT = 0;
export const CATCH_JUGGLE = 1;
export const CATCH_FLOAT = 2;

/** A zero drifts from the top of the board to the bottom in about this long, give or take CATCH_FALL_JITTER; armored ones are heavy and slow. */
export const CATCH_FALL_S = 6;
export const CATCH_FALL_JITTER = 0.3;
export const CATCH_ARMOR_SLOW = 1.5;
/** Zeros start in this top share of the board. */
export const CATCH_START_SHARE = 0.55;
/** Sideways drift: up to this many board widths a second, either way. */
export const CATCH_SWAY = 0.05;
/** A drifting zero eases to its drift speed at this rate, per second. */
export const CATCH_SETTLE = 4;

/** A missed zero floats back up over this long, to between these shares of the board from the top. */
export const CATCH_FLOAT_S = 1.2;
export const CATCH_FLOAT_TO_MIN = 0.12;
export const CATCH_FLOAT_TO_MAX = 0.3;

/** A juggled zero hops this share of the board's height, up and down in CATCH_HOP_S. */
export const CATCH_HOP = 0.18;
export const CATCH_HOP_S = 0.7;
/** A juggled zero closes on its spot in the cup with this time constant, in seconds. */
export const CATCH_JUGGLE_FOLLOW = 0.08;
/** A juggled zero keeps within this share of its cup's half-width from the cup's middle. */
export const CATCH_JUGGLE_SPREAD = 0.6;
/** No second catch of the same zero within this long. */
export const CATCH_COOLDOWN = 0.15;

/** A cup's half-width: at least CUP_MIN_HALF points, else this share of the round's widest zero. */
export const CUP_MIN_HALF = 36;
export const CUP_RX_SHARE = 0.75;
/** A zero is caught when its middle is within the cup's half-width plus this share of its own. */
export const CATCH_EDGE = 0.5;
/** The cups' top speed, in board widths a second. */
export const CUP_SPEED = 2.5;
/** Twin Cups' middles sit this many half-widths apart. */
export const CUP_TWIN_GAP = 2.6;

/** Magnet: pulls zeros within this many board widths of a cup's middle. */
export const MAGNET_REACH = 0.3;
/** Pulled zeros steer sideways at up to this many board widths a second; the Black Hole's pull is stronger. */
export const CATCH_STEER_MAX = 0.35;
export const CATCH_HOLE_STEER = 0.6;
/** Steering aims to arrive no sooner than this, so a zero right over the rim doesn't overshoot. */
export const CATCH_STEER_MIN_T = 0.15;
/** Vacuum Beam: zeros in the column over a cup fall this many times their drift speed. */
export const CATCH_VACUUM_FALL = 4;

/** Assist: a zero missed this many times, or every zero once nothing's been hit for CATCH_ASSIST_IDLE seconds (or ASSIST_LAST are left), steers into a cup. */
export const CATCH_ASSIST_MISSES = 2;
export const CATCH_ASSIST_IDLE = 4;

export interface CatchPower {
  cups: number;
  /** Each cup's width, times the round's base cup. */
  width: number;
  pull: CatchPull;
}

/**
 * Each power-up, by the weapon tier it stands for (engine MODES): Cup, Twin Cups, Net, Magnet,
 * Chain Catch, Vacuum Beam, Black Hole. A catch hits with the weapon's damage, splash and chain.
 */
export const CATCH_POWER: Readonly<Record<WeaponId, CatchPower>> = {
  pea: { cups: 1, width: 1, pull: 'none' },
  twin: { cups: 2, width: 1, pull: 'none' },
  scatter: { cups: 1, width: 2.2, pull: 'none' },
  rocket: { cups: 1, width: 1.2, pull: 'magnet' },
  chain: { cups: 1, width: 1.3, pull: 'none' },
  laser: { cups: 1, width: 1.2, pull: 'vacuum' },
  nuke: { cups: 1, width: 1.4, pull: 'hole' },
};

/** Catch's state for `count` zeros on a board `width` wide, cups in the middle. */
export function makeCatchState(count: number, width: number): CatchState {
  const motion: number[] = [];
  const fall: number[] = [];
  const apex: number[] = [];
  const slot: number[] = [];
  const misses: number[] = [];
  for (let i = 0; i < count; i++) {
    motion.push(CATCH_DRIFT);
    fall.push(0);
    apex.push(0);
    slot.push(0);
    misses.push(0);
  }
  return {
    mode: 'catch',
    cupX: width / 2,
    targetX: width / 2,
    baseHalf: CUP_MIN_HALF,
    cups: 1,
    half: CUP_MIN_HALF,
    gap: 0,
    pull: 'none',
    pulling: false,
    motion,
    fall,
    apex,
    slot,
    misses,
  };
}

/** The cups as the power-up has them now: count, half-width, spacing and pull. */
function applyPower(s: GameState, cs: CatchState): void {
  const p = CATCH_POWER[s.weapon.id];
  cs.cups = p.cups;
  cs.half = cs.baseHalf * p.width;
  cs.gap = p.cups > 1 ? CUP_TWIN_GAP * cs.half : 0;
  cs.pull = p.pull;
}

/** The middle of cup `k`. */
export function cupMid(cs: CatchState, k: number): number {
  return cs.cupX + (k - (cs.cups - 1) / 2) * cs.gap;
}

/** The cup a zero at its x would land in, or -1. */
export function cupUnder(cs: CatchState, z: Zero): number {
  for (let k = 0; k < cs.cups; k++) {
    if (Math.abs(z.x - cupMid(cs, k)) <= cs.half + CATCH_EDGE * z.rx) return k;
  }
  return -1;
}

/** The middle of the cup nearest x. */
function nearestCup(cs: CatchState, x: number): number {
  let best = cupMid(cs, 0);
  for (let k = 1; k < cs.cups; k++) {
    const mid = cupMid(cs, k);
    if (Math.abs(mid - x) < Math.abs(best - x)) best = mid;
  }
  return best;
}

/** How far from the cups' middle to the outer edge of the outer cup. */
function cupsReach(cs: CatchState): number {
  return cs.half + ((cs.cups - 1) * cs.gap) / 2;
}

/** Points per second² that bring a juggled zero back down CATCH_HOP_S after it leaves the cup. */
function hopGravity(s: GameState): number {
  return (8 * CATCH_HOP * (s.bottom - s.top)) / (CATCH_HOP_S * CATCH_HOP_S);
}

/** Place every zero in the top of the board, drifting down, and size the cups to the round. */
export function placeCatch(s: GameState, cfg: GameConfig): void {
  const cs = s.modeState;
  if (cs.mode !== 'catch') return;
  const rng = s.rng;
  const base = zeroRadius(s.objectCount, s.width, s.height);
  const span = popInSpan(s.objectCount);
  const boardH = s.bottom - s.top;
  const badges = armorBadges(cfg.groups);
  let widest = 0;
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
      z.x = between(rng, z.rx, Math.max(z.rx, s.width - z.rx));
      const yMin = s.top + z.ry;
      z.y = between(rng, yMin, Math.max(yMin, yMin + (boardH - 2 * z.ry) * CATCH_START_SHARE));
      const fall =
        ((boardH / CATCH_FALL_S) * (1 - CATCH_FALL_JITTER / 2 + random(rng) * CATCH_FALL_JITTER)) /
        (armored ? CATCH_ARMOR_SLOW : 1);
      cs.fall[i] = fall;
      cs.motion[i] = CATCH_DRIFT;
      z.vx = spread(rng, CATCH_SWAY * s.width);
      z.vy = fall;
      z.delay = random(rng) * span;
      widest = Math.max(widest, z.rx);
      i++;
    }
  }
  cs.baseHalf = Math.max(CUP_MIN_HALF, widest * CUP_RX_SHARE);
  applyPower(s, cs);
}

/** Bounce off the side walls. */
function sideWalls(s: GameState, z: Zero): void {
  if (z.x < z.rx) {
    z.x = z.rx;
    z.vx = Math.abs(z.vx);
  } else if (z.x > s.width - z.rx) {
    z.x = s.width - z.rx;
    z.vx = -Math.abs(z.vx);
  }
}

/** Zero `i` landed in cup `k`: a hit, then (if it survives) a hop. */
function catchZero(s: GameState, cs: CatchState, z: Zero, i: number, k: number): void {
  s.report.bounces++;
  s.report.dirty = true;
  cs.misses[i] = 0;
  applyHit(s, s.weapon, z);
  if (!z.alive) return;
  const mid = cupMid(cs, k);
  const room = cs.half * CATCH_JUGGLE_SPREAD;
  cs.motion[i] = CATCH_JUGGLE;
  cs.slot[i] = mid - cs.cupX + Math.max(-room, Math.min(room, z.x - mid));
  z.cooldown = CATCH_COOLDOWN;
  z.vx = 0;
  const boardH = s.bottom - s.top;
  const height = Math.max(0, Math.min(CATCH_HOP * boardH, boardH - 2 * z.ry));
  z.vy = -Math.sqrt(2 * hopGravity(s) * height);
}

/** Zero `i` landed beside the cups: it floats back up to drift down again. */
function missZero(s: GameState, cs: CatchState, z: Zero, i: number): void {
  cs.misses[i] = (cs.misses[i] ?? 0) + 1;
  cs.motion[i] = CATCH_FLOAT;
  const top = s.top + z.ry;
  const apex = top + (s.bottom - z.ry - top) * between(s.rng, CATCH_FLOAT_TO_MIN, CATCH_FLOAT_TO_MAX);
  cs.apex[i] = apex;
  z.vy = -(z.y - apex) / CATCH_FLOAT_S;
}

function drift(s: GameState, cs: CatchState, z: Zero, i: number, dt: number, late: boolean): void {
  const fall = cs.fall[i] ?? 0;
  z.vy += (fall - z.vy) * Math.min(1, dt * CATCH_SETTLE);
  const mid = nearestCup(cs, z.x);
  const inColumn = cs.pulling && Math.abs(z.x - mid) <= cs.half + z.rx;
  if (inColumn) z.vy = Math.max(z.vy, fall * CATCH_VACUUM_FALL);
  // Steering: the assist and the Black Hole bring a zero all the way in; the Magnet and the
  // Vacuum Beam pull the ones near a cup.
  const assisted = late || cs.pull === 'hole' || (cs.misses[i] ?? 0) >= CATCH_ASSIST_MISSES;
  const near = (cs.pull === 'magnet' && Math.abs(z.x - mid) <= MAGNET_REACH * s.width) || inColumn;
  const steer = cs.pull === 'hole' ? CATCH_HOLE_STEER : assisted || near ? CATCH_STEER_MAX : 0;
  if (steer > 0) {
    const landIn = Math.max(CATCH_STEER_MIN_T, (s.bottom - z.ry - z.y) / Math.max(z.vy, 1));
    const top = steer * s.width;
    z.vx = Math.max(-top, Math.min(top, (mid - z.x) / landIn));
  }
  z.x += z.vx * dt;
  z.y += z.vy * dt;
  sideWalls(s, z);
  if (z.y < s.bottom - z.ry) return;
  z.y = s.bottom - z.ry;
  const k = cupUnder(cs, z);
  if (k >= 0 && catchable(z)) catchZero(s, cs, z, i, k);
  // An assisted zero waits on the rim's level while it steers into a cup.
  else if (assisted) z.vy = 0;
  else missZero(s, cs, z, i);
}

function juggle(s: GameState, cs: CatchState, z: Zero, i: number, dt: number): void {
  z.vy += hopGravity(s) * dt;
  const spot = cs.cupX + (cs.slot[i] ?? 0);
  z.x += (spot - z.x) * Math.min(1, dt / CATCH_JUGGLE_FOLLOW);
  z.y += z.vy * dt;
  if (z.vy <= 0 || z.y < s.bottom - z.ry) return;
  // It lands in its spot, however fast the cup slid: a juggled zero can't be missed.
  z.x = spot;
  z.y = s.bottom - z.ry;
  const k = cupUnder(cs, z);
  if (k >= 0 && catchable(z)) catchZero(s, cs, z, i, k);
  else if (k >= 0) z.vy = 0;
  // The power-up changed under it and its cup moved away.
  else missZero(s, cs, z, i);
}

function float(s: GameState, cs: CatchState, z: Zero, i: number, dt: number): void {
  z.x += z.vx * dt;
  z.y += z.vy * dt;
  sideWalls(s, z);
  const apex = cs.apex[i] ?? s.top + z.ry;
  if (z.y > apex) return;
  z.y = apex;
  z.vy = 0;
  cs.motion[i] = CATCH_DRIFT;
}

/** One frame of Catch: the cups glide toward the finger, and every zero moves, lands, or is caught. */
export function stepCatch(s: GameState, dt: number): void {
  const cs = s.modeState;
  if (cs.mode !== 'catch') return;
  applyPower(s, cs);
  const reach = Math.min(cupsReach(cs), s.width / 2);
  const target = Math.max(reach, Math.min(s.width - reach, cs.targetX));
  const most = CUP_SPEED * s.width * dt;
  cs.cupX += Math.max(-most, Math.min(most, target - cs.cupX));
  cs.pulling = cs.pull === 'vacuum' && s.pointer.down && s.phase === 'play';
  // The fill freezes whatever's left behind it.
  const moving = s.phase === 'play' || s.phase === 'celebrate';
  const late = s.sinceDamage >= CATCH_ASSIST_IDLE || liveZeros(s) <= ASSIST_LAST;
  for (let i = 0; i < s.zeros.length; i++) {
    const z = s.zeros[i];
    if (!z || !z.alive) continue;
    z.age += dt;
    if (z.hitFlash > 0) z.hitFlash = Math.max(0, z.hitFlash - dt / HIT_FLASH);
    if (z.cooldown > 0) z.cooldown = Math.max(0, z.cooldown - dt);
    if (!moving || z.age < z.delay) continue;
    const motion = cs.motion[i];
    if (motion === CATCH_JUGGLE) juggle(s, cs, z, i, dt);
    else if (motion === CATCH_FLOAT) float(s, cs, z, i, dt);
    else drift(s, cs, z, i, dt, late);
    if (z.alive) keepOnBoard(z, s);
  }
}

/** The finger is at x: the cups head there. */
export function aimCups(s: GameState, x: number): void {
  const cs = s.modeState;
  if (cs.mode === 'catch') cs.targetX = x;
}
