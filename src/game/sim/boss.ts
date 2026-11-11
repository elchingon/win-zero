'worklet';
// Boss rounds (SPEC 4): the round's one huge zero, fought in the stages of the engine's bossPlan.
// When a stage's HP runs out the boss doesn't go: it bursts, shrinks, speeds up and sheds a ring of
// small zeros into the round's spare slots, carrying part of its value, and is shielded until every
// one of them is gone. On its last stage it goes as any zero does. The counter never moves at a
// break: the ring holds exactly the value the boss gave up.
//
// damage.ts calls bossBreak just before a boss would die, so this file must never import damage.ts
// or anything that does (weapons, bullets, the modes): it imports only leaves, as split.ts does.
// Each mode sets a new ring off its own way (step.ts calls it the next frame).
import { BOSS_RING_HP, type BossPlan } from '@/engine';

import {
  BOSS_BOARD_SHARE,
  BOSS_BURST_SCALE,
  BOSS_DRIFT,
  BOSS_GUARD_PULSE,
  BOSS_RING_SIZE_AS_IF,
  BOSS_RING_SPEED,
  BOSS_SHED_GRACE,
  BOSS_SHRINK,
  BOSS_SIDE_SHARE,
  BOSS_SPEEDUP,
  FLASH_BOSS_BREAK,
  FLARE,
  KILL_FRAGMENTS,
  KILL_RING,
  KILL_SPARKS,
  PALETTE_SIZE,
  SHAKE_BOSS_BREAK,
  TEAL,
} from './constants';
import { addFlash, addRing, addShake, fragments, scaledCount, sparks } from './effects';
import { ZERO_ASPECT, zeroRadius } from './sizing';
import type { BossState, GameState, Zero } from './types';

const TAU = Math.PI * 2;

/** The boss's state for a round of `slots` zero slots, its rings going in from `ringFrom` on. */
export function makeBossState(plan: BossPlan, ringFrom: number, slots: number): BossState {
  const hp: number[] = [];
  const value: number[] = [];
  const shed: number[] = [];
  const shedFrom: number[] = [];
  for (let k = 0; k < plan.stages.length; k++) {
    const stage = plan.stages[k];
    if (!stage) continue;
    hp.push(stage.hp);
    value.push(stage.value);
    shedFrom.push(shed.length);
    for (let r = 0; r < stage.shed.length; r++) shed.push(stage.shed[r] ?? 1);
  }
  shedFrom.push(shed.length);
  const badges: number[] = [];
  for (let b = 0; b < plan.badges.length; b++) badges.push(plan.badges[b] ?? 0);
  const fresh: boolean[] = [];
  for (let i = 0; i < slots; i++) fresh.push(false);
  return { stage: 0, stages: hp.length, hp, value, shed, shedFrom, badges, slot: 0, ringFrom, fresh, pulse: 0 };
}

/** The boss's vertical radius on this board, before any mode's own limit. */
export function bossRy(s: GameState): number {
  const board = s.bottom - s.top;
  return Math.max(1, Math.min(Math.min(s.width, board) * BOSS_SIDE_SHARE, board * BOSS_BOARD_SHARE));
}

/** A ring zero's vertical radius on this board. */
export function ringRy(s: GameState): number {
  return zeroRadius(BOSS_RING_SIZE_AS_IF, s.width, s.height);
}

/** The ×V badge a boss-round zero worth `value` wears, or -1. */
export function bossBadge(s: GameState, value: number): number {
  return s.boss === null || value <= 1 ? -1 : s.boss.badges.indexOf(value);
}

/** True while the boss's ring is out: a zero in the spare slots is still standing. */
function ringOut(s: GameState, bs: BossState): boolean {
  for (let j = bs.ringFrom; j < s.zeros.length; j++) if (s.zeros[j]?.alive) return true;
  return false;
}

/** The burst of a broken stage: a kill's sparks and fragments times BOSS_BURST_SCALE, two rings, a shake and a flash. */
function burst(s: GameState, z: Zero): void {
  sparks(s, z, scaledCount(s, KILL_SPARKS * BOSS_BURST_SCALE));
  fragments(s, z, scaledCount(s, KILL_FRAGMENTS * BOSS_BURST_SCALE));
  const width = Math.max(KILL_RING.minWidth, z.ry * KILL_RING.width);
  addRing(s, z.x, z.y, z.ry * KILL_RING.start, z.ry * KILL_RING.reach * 2, KILL_RING.duration * 2, FLARE, width * 2);
  addRing(s, z.x, z.y, z.ry * KILL_RING.start, z.ry * KILL_RING.reach * 1.4, KILL_RING.duration * 1.5, z.color, width);
  addShake(s, SHAKE_BOSS_BREAK);
  addFlash(s, FLASH_BOSS_BREAK);
}

/**
 * The boss `z` is about to go: unless it's on its last stage, break the stage instead. The next
 * stage's HP (damage past this one's is lost, so a stage can't be skipped), its smaller value and
 * size and higher speed, and the ring of zeros carrying the difference, waiting in the spare slots
 * for the mode to set them off. True when the boss fights on.
 */
export function bossBreak(s: GameState, z: Zero): boolean {
  const bs = s.boss;
  if (bs === null || z.kind !== 'boss' || bs.stage >= bs.stages - 1) return false;
  const from = bs.shedFrom[bs.stage] ?? 0;
  const to = bs.shedFrom[bs.stage + 1] ?? from;
  let room = 0;
  for (let j = bs.ringFrom; j < s.zeros.length; j++) if (!s.zeros[j]?.alive) room++;
  if (room < to - from) return false;

  bs.stage++;
  const ry = ringRy(s);
  let k = 0;
  for (let j = bs.ringFrom; j < s.zeros.length && from + k < to; j++) {
    const r = s.zeros[j];
    if (!r || r.alive) continue;
    const value = bs.shed[from + k] ?? 1;
    r.alive = true;
    r.kind = 'standard';
    r.color = (z.color + 1 + k) % PALETTE_SIZE;
    r.hp = BOSS_RING_HP;
    r.maxHp = BOSS_RING_HP;
    r.value = value;
    r.badge = bossBadge(s, value);
    r.energyBar = false;
    r.ry = ry;
    r.rx = ry * ZERO_ASPECT;
    r.x = z.x;
    r.y = z.y;
    r.vx = 0;
    r.vy = 0;
    r.age = 0;
    r.delay = BOSS_SHED_GRACE;
    r.hitFlash = 0;
    r.mark = 0;
    r.cooldown = 0;
    r.guarded = false;
    bs.fresh[j] = true;
    k++;
  }

  const value = bs.value[bs.stage] ?? z.value;
  z.value = value;
  z.badge = bossBadge(s, value);
  z.hp = bs.hp[bs.stage] ?? 1;
  z.maxHp = z.hp;
  z.ry *= BOSS_SHRINK;
  z.rx = z.ry * ZERO_ASPECT;
  z.vx *= BOSS_SPEEDUP;
  z.vy *= BOSS_SPEEDUP;
  z.guarded = k > 0;
  z.hitFlash = 1;
  // The modes that keep a zero's pace apart from its velocity speed up too.
  const ms = s.modeState;
  if (ms.mode === 'orbit') ms.spin[bs.slot] = (ms.spin[bs.slot] ?? 0) * BOSS_SPEEDUP;
  else if (ms.mode === 'catch') ms.pace[bs.slot] = (ms.pace[bs.slot] ?? 1) / BOSS_SPEEDUP;
  // Breaker's boss stands still through its first stage, then drifts.
  else if (ms.mode === 'breaker' && z.vx === 0) z.vx = BOSS_DRIFT * s.width;
  bs.pulse = BOSS_GUARD_PULSE;
  burst(s, z);
  s.report.bossStage = bs.stage;
  s.report.bossBreaks++;
  s.report.dirty = true;
  return true;
}

/** The Shooter sets ring zero `k` of `count` off: out from the boss's middle, each its own way. */
export function shedShooter(s: GameState, boss: Zero, r: Zero, k: number, count: number): void {
  const angle = (k / Math.max(1, count)) * TAU + boss.age;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  r.x = Math.max(r.rx, Math.min(s.width - r.rx, boss.x + cos * boss.rx * 0.5));
  r.y = Math.max(s.top + r.ry, Math.min(s.bottom - r.ry, boss.y + sin * boss.ry * 0.5));
  r.vx = cos * BOSS_RING_SPEED;
  r.vy = sin * BOSS_RING_SPEED;
}

/**
 * The boss between stages: once its ring is gone it can be hit again, and while the ring is out a
 * teal pulse says it's shielded.
 */
export function updateBoss(s: GameState, dt: number): void {
  const bs = s.boss;
  if (bs === null) return;
  const z = s.zeros[bs.slot];
  if (!z || !z.alive || !z.guarded) return;
  if (!ringOut(s, bs)) {
    z.guarded = false;
    z.hitFlash = 1;
    addRing(s, z.x, z.y, z.ry * 0.8, z.ry * 1.6, KILL_RING.duration, TEAL, Math.max(KILL_RING.minWidth, z.ry * KILL_RING.width));
    s.report.dirty = true;
    return;
  }
  bs.pulse -= dt;
  if (bs.pulse > 0 || s.phase !== 'play') return;
  bs.pulse = BOSS_GUARD_PULSE;
  addRing(s, z.x, z.y, z.ry * 0.9, z.ry * 1.3, KILL_RING.duration, TEAL, Math.max(KILL_RING.minWidth, z.ry * 0.06));
}
