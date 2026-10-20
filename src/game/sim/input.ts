'worklet';
// The player's hands. The canvas reports the finger through pointerDown / pointerMove / pointerUp,
// and the round's mode decides what it does: in the Shooter, touch-down fires and aims, dragging
// aims, and holding keeps firing (trigger.ts). The gesture callbacks call these on the UI thread;
// the screen calls the setters through scheduleOnUI.
import type { WeaponDef } from '@/engine';

import { aimCups } from './modes/catch';
import { sliceDown, sliceMove } from './modes/slice';
import { moveAim, pressFire, releaseFire } from './trigger';
import type { GameState } from './types';

// The website, and tests from before modes, pull the trigger directly.
export { moveAim, pressFire, releaseFire, updateFiring } from './trigger';

/** The finger lands at (x, y). */
export function pointerDown(s: GameState, x: number, y: number): void {
  const p = s.pointer;
  p.down = true;
  p.x = x;
  p.y = y;
  switch (s.mode) {
    case 'catch':
      aimCups(s, x);
      break;
    case 'slice':
      sliceDown(s, x, y);
      break;
    // Orbit's turret, in the middle, fires as the Shooter's does.
    case 'orbit':
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
    case 'catch':
      aimCups(s, x);
      break;
    case 'slice':
      sliceMove(s, x, y);
      break;
    case 'orbit':
    case 'shooter':
    default:
      moveAim(s, x, y);
  }
}

/** The finger lifts, or the touch is cancelled. */
export function pointerUp(s: GameState): void {
  s.pointer.down = false;
  switch (s.mode) {
    // The cups stay where the finger left them; the blade's trail fades on its own.
    case 'catch':
    case 'slice':
      break;
    case 'orbit':
    case 'shooter':
    default:
      releaseFire(s);
  }
}

/** Switch weapons. Bullets already in the air keep the weapon that fired them. */
export function setWeapon(s: GameState, weapon: WeaponDef): void {
  s.weapon = weapon;
}

export function setReduceMotion(s: GameState, reduceMotion: boolean): void {
  s.reduceMotion = reduceMotion;
}
