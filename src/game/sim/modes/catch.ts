'worklet';
// Catch (SPEC 9): zeros fall like floaty balls, and cups at the bottom catch them. A catch is a
// hit from the power-up's weapon (its damage, splash and chain); a zero that survives it (energy
// and armored zeros) bounces back up high, off toward the side of the cup it struck. A zero that
// lands beside the cups bounces up high too, along its own path. Nothing draws a zero in but the
// power-ups that pull (Magnet, Vacuum Beam, Black Hole), and those only on its way down: with the
// plain cups, the player has to get under every zero. The cups follow the finger's x, and start
// in the middle.
import type { WeaponId } from '@/engine';

import { armorBadges } from '../badges';
import { catchable, keepOnBoard } from '../board';
import { HIT_FLASH } from '../constants';
import { between, random, spread } from '../rng';
import { ZERO_ASPECT, zeroRadius } from '../sizing';
import type { CatchPull, CatchState, GameConfig, GameState, Zero } from '../types';
import { applyHit } from '../weapons';
import { popInSpan, readyZero, zeroSize } from './place';

/** A zero dropped from rest at the top of the board reaches the bottom in about this long: it sets the gravity. */
export const CATCH_DROP_S = 2.5;
/** Each zero's pace is 1 give or take CATCH_PACE_JITTER; armored ones are heavy, and fly CATCH_ARMOR_SLOW times slower. */
export const CATCH_PACE_JITTER = 0.3;
export const CATCH_ARMOR_SLOW = 1.5;
/** Zeros start in this top share of the board. */
export const CATCH_START_SHARE = 0.55;
/** Sideways drift at the start: up to this many board widths a second, either way. */
export const CATCH_SWAY = 0.05;

/** A bounce, off the floor or a cup, carries a zero up to between these shares of the board from the top. */
export const CATCH_BOUNCE_TO_MIN = 0.08;
export const CATCH_BOUNCE_TO_MAX = 0.25;
/** A zero caught at a cup's edge leaves sideways at this many board widths a second; from its middle, straight up. */
export const CATCH_DEFLECT = 0.25;
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

/** Magnet: pulls falling zeros within this many board widths of a cup's middle. */
export const MAGNET_REACH = 0.3;
/** Pulled zeros steer sideways at up to this many board widths a second; the Black Hole's pull is stronger. */
export const CATCH_STEER_MAX = 0.35;
export const CATCH_HOLE_STEER = 0.6;
/** Steering aims to arrive no sooner than this, so a zero right over the rim doesn't overshoot. */
export const CATCH_STEER_MIN_T = 0.15;
/** Vacuum Beam: zeros falling in the column over a cup fall at least this many board heights a second. */
export const CATCH_VACUUM_FALL = 1.5;

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
  const pace: number[] = [];
  for (let i = 0; i < count; i++) pace.push(1);
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
    pace,
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

/** Zero `i`'s gravity, in points per second²: CATCH_DROP_S's, slowed by its pace. */
function gravity(s: GameState, cs: CatchState, i: number): number {
  const pace = cs.pace[i] ?? 1;
  return (2 * (s.bottom - s.top)) / (CATCH_DROP_S * CATCH_DROP_S * pace * pace);
}

/** Seconds until zero `i`, flying as it is now, comes down to the rims' level. */
export function landsIn(s: GameState, cs: CatchState, z: Zero, i: number): number {
  const g = gravity(s, cs, i);
  const d = Math.max(0, s.bottom - z.ry - z.y);
  return (Math.sqrt(z.vy * z.vy + 2 * g * d) - z.vy) / g;
}

/** Place every zero in the top of the board, at rest, and size the cups to the round. */
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
      cs.pace[i] =
        (1 - CATCH_PACE_JITTER / 2 + random(rng) * CATCH_PACE_JITTER) * (armored ? CATCH_ARMOR_SLOW : 1);
      z.vx = spread(rng, CATCH_SWAY * s.width);
      z.vy = 0;
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

/** Zero `i` leaves the rims' level, headed for a high point near the top of the board. */
function bounce(s: GameState, cs: CatchState, z: Zero, i: number): void {
  const top = s.top + z.ry;
  const apex = top + (s.bottom - z.ry - top) * between(s.rng, CATCH_BOUNCE_TO_MIN, CATCH_BOUNCE_TO_MAX);
  z.vy = -Math.sqrt(2 * gravity(s, cs, i) * Math.max(0, z.y - apex));
}

/** Zero `i` landed in cup `k`: a hit, then (if it survives) a bounce, off toward the side of the cup it struck. */
function catchZero(s: GameState, cs: CatchState, z: Zero, i: number, k: number): void {
  s.report.bounces++;
  s.report.dirty = true;
  applyHit(s, s.weapon, z);
  if (!z.alive) return;
  z.cooldown = CATCH_COOLDOWN;
  const along = Math.max(-1, Math.min(1, (z.x - cupMid(cs, k)) / (cs.half + CATCH_EDGE * z.rx)));
  z.vx = (along * CATCH_DEFLECT * s.width) / (cs.pace[i] ?? 1);
  bounce(s, cs, z, i);
}

/** The power-up's pull on a falling zero: the Vacuum Beam draws it down its column, and the Magnet, the Vacuum Beam and the Black Hole steer it in. */
function pull(s: GameState, cs: CatchState, z: Zero, i: number): void {
  const mid = nearestCup(cs, z.x);
  const inColumn = cs.pulling && Math.abs(z.x - mid) <= cs.half + z.rx;
  if (inColumn) z.vy = Math.max(z.vy, (CATCH_VACUUM_FALL * (s.bottom - s.top)) / (cs.pace[i] ?? 1));
  const near = (cs.pull === 'magnet' && Math.abs(z.x - mid) <= MAGNET_REACH * s.width) || inColumn;
  const steer = cs.pull === 'hole' ? CATCH_HOLE_STEER : near ? CATCH_STEER_MAX : 0;
  if (steer <= 0) return;
  const landIn = Math.max(CATCH_STEER_MIN_T, landsIn(s, cs, z, i));
  const top = steer * s.width;
  z.vx = Math.max(-top, Math.min(top, (mid - z.x) / landIn));
}

/** One frame of a zero's flight: gravity, the power-up's pull, the walls, and its landing in a cup or beside them. */
function fly(s: GameState, cs: CatchState, z: Zero, i: number, dt: number): void {
  z.vy += gravity(s, cs, i) * dt;
  // The pulls draw a zero in only on its way down, so every bounce still goes up high.
  if (z.vy > 0 && cs.pull !== 'none') pull(s, cs, z, i);
  z.x += z.vx * dt;
  z.y += z.vy * dt;
  sideWalls(s, z);
  if (z.y < s.bottom - z.ry) return;
  z.y = s.bottom - z.ry;
  const k = cupUnder(cs, z);
  if (k >= 0 && catchable(z)) catchZero(s, cs, z, i, k);
  // Beside the cups: off the floor and back up high, along its own path.
  else bounce(s, cs, z, i);
}

/** One frame of Catch: the cups glide toward the finger, and every zero flies, lands, or is caught. */
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
  for (let i = 0; i < s.zeros.length; i++) {
    const z = s.zeros[i];
    if (!z || !z.alive) continue;
    z.age += dt;
    if (z.hitFlash > 0) z.hitFlash = Math.max(0, z.hitFlash - dt / HIT_FLASH);
    if (z.cooldown > 0) z.cooldown = Math.max(0, z.cooldown - dt);
    if (!moving || z.age < z.delay) continue;
    fly(s, cs, z, i, dt);
    if (z.alive) keepOnBoard(z, s);
  }
}

/** The finger is at x: the cups head there. */
export function aimCups(s: GameState, x: number): void {
  const cs = s.modeState;
  if (cs.mode === 'catch') cs.targetX = x;
}
