'worklet';
// The player's hands. The canvas reports the finger through pointerDown / pointerMove / pointerUp,
// and the round's mode decides what it does: in the Shooter, touch-down fires and aims, dragging
// aims, and holding keeps firing. The gesture callbacks call these on the UI thread; the screen
// calls the setters through scheduleOnUI.
import type { WeaponDef } from '@/engine';

import { FIRE_INTERVAL, MIN_TAP_INTERVAL, TIME_EPSILON } from './constants';
import { fireShot } from './fire';
import type { GameState } from './types';

function aimAt(s: GameState, x: number, y: number): void {
  s.aim = Math.atan2(y - s.muzzleY, x - s.muzzleX);
}

/** Touch-down: aim at the finger and fire at once (unless a shot just went). */
export function pressFire(s: GameState, x: number, y: number): void {
  if (s.phase !== 'play') return;
  aimAt(s, x, y);
  s.firing = true;
  if (s.sinceShot + TIME_EPSILON >= MIN_TAP_INTERVAL) fireShot(s);
}

export function moveAim(s: GameState, x: number, y: number): void {
  if (s.phase !== 'play' || !s.firing) return;
  aimAt(s, x, y);
}

export function releaseFire(s: GameState): void {
  s.firing = false;
}

/** The finger lands at (x, y). */
export function pointerDown(s: GameState, x: number, y: number): void {
  const p = s.pointer;
  p.down = true;
  p.x = x;
  p.y = y;
  switch (s.mode) {
    case 'shooter':
    default:
      pressFire(s, x, y);
  }
}

/** The finger moves to (x, y) while down. */
export function pointerMove(s: GameState, x: number, y: number): void {
  const p = s.pointer;
  p.x = x;
  p.y = y;
  switch (s.mode) {
    case 'shooter':
    default:
      moveAim(s, x, y);
  }
}

/** The finger lifts, or the touch is cancelled. */
export function pointerUp(s: GameState): void {
  s.pointer.down = false;
  switch (s.mode) {
    case 'shooter':
    default:
      releaseFire(s);
  }
}

/** Holding fires every FIRE_INTERVAL, carrying the remainder so slow frames keep the rate. */
export function updateFiring(s: GameState): void {
  if (s.phase !== 'play' || !s.firing || s.sinceShot + TIME_EPSILON < FIRE_INTERVAL) return;
  const carry = Math.min(FIRE_INTERVAL, s.sinceShot - FIRE_INTERVAL);
  fireShot(s);
  s.sinceShot = Math.max(0, carry);
}

/** Switch weapons. Bullets already in the air keep the weapon that fired them. */
export function setWeapon(s: GameState, weapon: WeaponDef): void {
  s.weapon = weapon;
}

export function setReduceMotion(s: GameState, reduceMotion: boolean): void {
  s.reduceMotion = reduceMotion;
}
