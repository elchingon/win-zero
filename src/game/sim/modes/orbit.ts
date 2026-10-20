'worklet';
// Orbit (SPEC 9): the turret sits in the middle of the board and aims all round, firing every
// weapon as in the Shooter, while the zeros circle it on oval tracks of their own: big and small,
// fast and slow, either way round. An armored zero splits into smaller zeros that keep its value
// (split.ts). Late in the round, bullets home in on the last few zeros.
import { armorBadges, pieceBadges } from '../badges';
import { keepOnBoard, liveZeros } from '../board';
import {
  ARMOR_SPEED_SCALE,
  ASSIST_LAST,
  HIT_FLASH,
  MAX_ZEROS,
  ORBIT_PIECES,
  SMALL_ZERO_BOOST,
  SMALL_ZERO_REF,
  SPEED_BASE,
  SPEED_CROWD_MAX,
  SPEED_JITTER_MIN,
  SPEED_JITTER_RANGE,
  SPEED_MAX,
  SPEED_PER_ZERO,
} from '../constants';
import { hittable } from '../hit';
import { between, random } from '../rng';
import { ZERO_ASPECT, ZERO_MIN_RADIUS, zeroRadius } from '../sizing';
import type { GameConfig, GameState, OrbitState } from '../types';
import { popInSpan, readyZero, zeroSize } from './place';
import { minTrack, onTrack } from './split';

/** Once nothing's been hit for this long, as when only ASSIST_LAST are left, bullets home in. */
export const ORBIT_ASSIST_IDLE = 3;
/** Homing bullets turn toward the nearest zero by up to this many radians a second. */
export const ORBIT_HOMING_TURN = 5;

const TAU = Math.PI * 2;

/** Spare zero slots an Orbit round keeps for split pieces: enough for every armored zero, within MAX_ZEROS. */
export function orbitSpares(groups: GameConfig['groups'], objectCount: number): number {
  let armored = 0;
  for (let g = 0; g < groups.length; g++) {
    const group = groups[g];
    if (group && group.kind === 'armored') armored += group.count;
  }
  return Math.max(0, Math.min(armored * ORBIT_PIECES, MAX_ZEROS - objectCount));
}

/** Orbit's state for `count` zero slots, the round's own `objectCount` first. */
export function makeOrbitState(count: number, objectCount: number, groups: GameConfig['groups']): OrbitState {
  const angle: number[] = [];
  const spin: number[] = [];
  const track: number[] = [];
  const reachX: number[] = [];
  const reachY: number[] = [];
  for (let i = 0; i < count; i++) {
    angle.push(0);
    spin.push(0);
    track.push(1);
    reachX.push(0);
    reachY.push(0);
  }
  return {
    mode: 'orbit',
    angle,
    spin,
    track,
    reachX,
    reachY,
    spareFrom: objectCount,
    badgeBase: armorBadges(groups).length,
    pieceValues: pieceBadges(groups),
  };
}

/** The turret to the middle, and every zero onto a track round it, at the Shooter's speeds. */
export function placeOrbit(s: GameState, cfg: GameConfig): void {
  const os = s.modeState;
  if (os.mode !== 'orbit') return;
  const rng = s.rng;
  s.muzzleX = s.width / 2;
  s.muzzleY = (s.top + s.bottom) / 2;
  const count = s.objectCount;
  const base = zeroRadius(count, s.width, s.height);
  const crowdSpeed = SPEED_BASE + Math.min(SPEED_CROWD_MAX, count * SPEED_PER_ZERO);
  const span = popInSpan(count);
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
      const reachX = Math.max(0, s.width / 2 - z.rx);
      const reachY = Math.max(0, (s.bottom - s.top) / 2 - z.ry);
      os.reachX[i] = reachX;
      os.reachY[i] = reachY;
      os.track[i] = between(rng, minTrack(z.rx, z.ry, reachX, reachY), 1);
      os.angle[i] = random(rng) * TAU;
      const jitter = SPEED_JITTER_MIN + random(rng) * SPEED_JITTER_RANGE;
      const smallBoost = 1 + (SMALL_ZERO_REF / Math.max(z.ry, ZERO_MIN_RADIUS)) * SMALL_ZERO_BOOST;
      const speed = Math.min(SPEED_MAX, crowdSpeed * jitter * smallBoost) * (armored ? ARMOR_SPEED_SCALE : 1);
      const radius = ((os.track[i] ?? 1) * (reachX + reachY)) / 2;
      os.spin[i] = ((random(rng) < 0.5 ? -1 : 1) * speed) / Math.max(1, radius);
      z.delay = random(rng) * span;
      onTrack(s, os, z, i);
      i++;
    }
  }
}

/** Bullets turn toward the nearest zero, keeping their speed. */
function homeBullets(s: GameState, dt: number): void {
  const turn = ORBIT_HOMING_TURN * dt;
  for (let b = 0; b < s.bullets.count; b++) {
    const bullet = s.bullets.items[b];
    if (!bullet) continue;
    let best = -1;
    let bestD = Infinity;
    for (let i = 0; i < s.zeros.length; i++) {
      const z = s.zeros[i];
      if (!z || !hittable(z)) continue;
      const d = (z.x - bullet.x) * (z.x - bullet.x) + (z.y - bullet.y) * (z.y - bullet.y);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    const z = s.zeros[best];
    if (!z) continue;
    const heading = Math.atan2(bullet.vy, bullet.vx);
    let off = Math.atan2(z.y - bullet.y, z.x - bullet.x) - heading;
    off -= TAU * Math.round(off / TAU);
    const angle = heading + Math.max(-turn, Math.min(turn, off));
    const speed = Math.sqrt(bullet.vx * bullet.vx + bullet.vy * bullet.vy);
    bullet.vx = Math.cos(angle) * speed;
    bullet.vy = Math.sin(angle) * speed;
  }
}

/** One frame of Orbit's zeros going round (the turret fires as the Shooter's does). */
export function stepOrbit(s: GameState, dt: number): void {
  const os = s.modeState;
  if (os.mode !== 'orbit') return;
  // The fill freezes whatever's left behind it.
  const moving = s.phase === 'play' || s.phase === 'celebrate';
  for (let i = 0; i < s.zeros.length; i++) {
    const z = s.zeros[i];
    if (!z || !z.alive) continue;
    z.age += dt;
    if (z.hitFlash > 0) z.hitFlash = Math.max(0, z.hitFlash - dt / HIT_FLASH);
    if (!moving) continue;
    os.angle[i] = ((os.angle[i] ?? 0) + (os.spin[i] ?? 0) * dt) % TAU;
    onTrack(s, os, z, i);
    keepOnBoard(z, s);
  }
  if (s.phase === 'play' && (s.sinceDamage >= ORBIT_ASSIST_IDLE || liveZeros(s) <= ASSIST_LAST)) homeBullets(s, dt);
}
