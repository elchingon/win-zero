'worklet';
// Setting up a game mode's zeros from composeRound's groups, as the Shooter's spawnZeros does:
// each one's kind, HP, value, ×V badge and color, and its size and pace for the round. Where it
// starts and how it moves are the mode's own. A leaf file.
import type { ZeroGroup } from '@/engine';

import {
  ARMOR_SIZE_SCALE,
  PALETTE_SIZE,
  SIZE_JITTER,
  SPAWN_DELAY_BASE,
  SPAWN_DELAY_MAX,
  SPAWN_DELAY_PER_ZERO,
} from '../constants';
import { random } from '../rng';
import type { GameState, Zero } from '../types';

/** Make `z` the `i`th zero of the round, one of `group`'s, wearing badge `badge` (-1 for none). */
export function readyZero(z: Zero, group: ZeroGroup, badge: number, i: number): void {
  z.alive = true;
  z.kind = group.kind;
  z.color = i % PALETTE_SIZE;
  z.hp = group.hp;
  z.maxHp = group.hp;
  z.value = group.value;
  z.badge = badge;
  z.energyBar = group.energyBar;
  z.x = 0;
  z.y = 0;
  z.vx = 0;
  z.vy = 0;
  z.delay = 0;
  z.age = 0;
  z.hitFlash = 0;
  z.mark = 0;
  z.cooldown = 0;
}

/** A zero's vertical radius: the round's base size, give or take SIZE_JITTER, bigger when armored. */
export function zeroSize(s: GameState, base: number, armored: boolean): number {
  return base * (1 - SIZE_JITTER / 2 + random(s.rng) * SIZE_JITTER) * (armored ? ARMOR_SIZE_SCALE : 1);
}

/** How long the round's zeros take to pop in, from the first to the last: the Shooter's spread. */
export function popInSpan(objectCount: number): number {
  return Math.min(SPAWN_DELAY_MAX, SPAWN_DELAY_BASE + objectCount * SPAWN_DELAY_PER_ZERO);
}
