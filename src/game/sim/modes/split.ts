'worklet';
// Orbit's tracks, and its armored zeros splitting (SPEC 9: "splits into smaller zeros that keep
// its value"). damage.ts calls splitZero just before an armored zero dies, so this file must
// never import damage.ts or anything that does (weapons, bullets, the modes): a circle of
// imports would leave a worklet holding nothing. It imports only leaves.
import { pieceValue } from '../badges';
import { ORBIT_PIECES } from '../constants';
import type { GameState, OrbitState, Zero } from '../types';

/** Zeros keep at least this far, edge to middle, from the turret in the middle. */
export const ORBIT_TURRET_CLEAR = 48;
/** A piece is this much the size of the zero it split from. */
export const ORBIT_PIECE_SCALE = 0.7;
/** Pieces take this many hits. */
export const ORBIT_PIECE_HP = 1;
/** Pieces appear after this long, so the splash or lightning that split a zero can't take them unseen. */
export const ORBIT_SPLIT_GRACE = 0.25;
/** Pieces take tracks either side of the zero's, this much smaller and bigger. */
export const ORBIT_PIECE_SPREAD = 0.12;
/** Pieces fly off this much faster than the zero went, in opposite directions. */
export const ORBIT_PIECE_SPEEDUP = 1.3;

/** The smallest track (a share of the reach) that keeps a zero this size clear of the turret. */
export function minTrack(rx: number, ry: number, reachX: number, reachY: number): number {
  return Math.min(1, (ORBIT_TURRET_CLEAR + Math.max(rx, ry)) / Math.max(1, Math.min(reachX, reachY)));
}

/** Put zero `i` where its track has it, moving along it: its velocity is the track's tangent. */
export function onTrack(s: GameState, os: OrbitState, z: Zero, i: number): void {
  const angle = os.angle[i] ?? 0;
  const spin = os.spin[i] ?? 0;
  const track = os.track[i] ?? 1;
  const ax = track * (os.reachX[i] ?? 0);
  const ay = track * (os.reachY[i] ?? 0);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  z.x = s.muzzleX + ax * cos;
  z.y = s.muzzleY + ay * sin;
  z.vx = -ax * sin * spin;
  z.vy = ay * cos * spin;
}

/**
 * An armored zero is about to go: hand its value to ORBIT_PIECES smaller zeros in the spare
 * slots, leaving it worth nothing as it dies, so the counter never goes up and the round ends on
 * the last piece. Without room for every piece it goes the usual way.
 */
export function splitZero(s: GameState, os: OrbitState, z: Zero): void {
  const i = s.zeros.indexOf(z);
  if (i < 0) return;
  let room = 0;
  for (let j = os.spareFrom; j < s.zeros.length; j++) if (!s.zeros[j]?.alive) room++;
  if (room < ORBIT_PIECES) return;
  let k = 0;
  for (let j = os.spareFrom; j < s.zeros.length && k < ORBIT_PIECES; j++) {
    const piece = s.zeros[j];
    if (!piece || piece.alive) continue;
    const value = pieceValue(z.value, k);
    piece.alive = true;
    piece.kind = 'standard';
    piece.color = z.color;
    piece.hp = ORBIT_PIECE_HP;
    piece.maxHp = ORBIT_PIECE_HP;
    piece.value = value;
    piece.badge = os.badgeBase + os.pieceValues.indexOf(value);
    piece.energyBar = false;
    piece.rx = z.rx * ORBIT_PIECE_SCALE;
    piece.ry = z.ry * ORBIT_PIECE_SCALE;
    piece.age = 0;
    piece.delay = ORBIT_SPLIT_GRACE;
    piece.hitFlash = 0;
    piece.mark = 0;
    piece.cooldown = 0;
    // The parent's reach, worked out for a bigger zero, keeps a piece inside the board too.
    const reachX = os.reachX[i] ?? 0;
    const reachY = os.reachY[i] ?? 0;
    os.reachX[j] = reachX;
    os.reachY[j] = reachY;
    const side = k % 2 === 0 ? -1 : 1;
    const track = (os.track[i] ?? 1) + side * ORBIT_PIECE_SPREAD;
    os.track[j] = Math.max(minTrack(piece.rx, piece.ry, reachX, reachY), Math.min(1, track));
    os.angle[j] = os.angle[i] ?? 0;
    os.spin[j] = (os.spin[i] ?? 0) * ORBIT_PIECE_SPEEDUP * -side;
    onTrack(s, os, piece, j);
    k++;
  }
  z.value = 0;
}
