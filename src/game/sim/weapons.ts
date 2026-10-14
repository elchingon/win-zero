'worklet';
// What each weapon does when it lands (SPEC 5, damage from engine/weapons.ts): the direct hit,
// then the Rocket's and Nuke's splash, then the Chain Zapper's and Nuke's lightning. The Rail
// Laser has no bullet: it hits everything on its line the moment it fires.
import type { SplashSpec, WeaponDef } from '@/engine';

import {
  AMBER,
  BEAM_DURATION,
  BEAM_LENGTH,
  BEAM_MIN_REACH,
  BLAST_RING,
  BOLT_DURATION,
  BOLT_JITTER,
  BOLT_POINTS,
  SHAKE_BLAST,
  SPLASH_MARGIN,
} from './constants';
import { damageZero } from './damage';
import { addRing, addShake } from './effects';
import { hittable } from './hit';
import { acquire } from './pool';
import { spread } from './rng';
import type { GameState, Zero } from './types';

/** The prototype's blast radius: a fraction of the shorter side, never below the minimum. */
export function splashRadius(s: GameState, splash: SplashSpec): number {
  return Math.max(splash.minRadiusPx, Math.min(s.width, s.height) * splash.radiusFraction);
}

/** A jagged lightning bolt from (x1, y1) to (x2, y2). */
function addBolt(s: GameState, x1: number, y1: number, x2: number, y2: number): void {
  const bolt = acquire(s.bolts);
  if (!bolt) return;
  bolt.t = 0;
  bolt.dur = BOLT_DURATION;
  const last = BOLT_POINTS - 1;
  for (let i = 0; i <= last; i++) {
    const t = i / last;
    const jitter = i === 0 || i === last ? 0 : BOLT_JITTER;
    bolt.xs[i] = x1 + (x2 - x1) * t + spread(s.rng, jitter);
    bolt.ys[i] = y1 + (y2 - y1) * t + spread(s.rng, jitter);
  }
}

/** Splash damage to every other zero in reach of the hit. The zero hit directly is spared. */
function splash(s: GameState, w: WeaponDef, hit: Zero): void {
  const spec = w.splash;
  if (!spec) return;
  const reach = splashRadius(s, spec);
  addRing(s, hit.x, hit.y, BLAST_RING.start, reach, BLAST_RING.duration, AMBER, BLAST_RING.width);
  addShake(s, SHAKE_BLAST);
  s.report.blasts++;
  s.report.dirty = true;
  for (let i = 0; i < s.zeros.length; i++) {
    const z = s.zeros[i];
    if (!z || z === hit || !hittable(z)) continue;
    if (Math.hypot(z.x - hit.x, z.y - hit.y) < reach + z.ry * SPLASH_MARGIN) damageZero(s, z, spec.damage);
  }
}

/**
 * Lightning to the nearest zeros still standing (not the one hit), one after another. Runs
 * after the splash, so the Nuke's bolts find its survivors and stack on them.
 */
function chain(s: GameState, w: WeaponDef, hit: Zero): void {
  const spec = w.chain;
  if (!spec) return;
  let fromX = hit.x;
  let fromY = hit.y;
  for (let k = 0; k < spec.targets; k++) {
    let best: Zero | null = null;
    let bestD = Infinity;
    for (let i = 0; i < s.zeros.length; i++) {
      const z = s.zeros[i];
      if (!z || z === hit || z.mark === 1 || !hittable(z)) continue;
      const d = (z.x - hit.x) * (z.x - hit.x) + (z.y - hit.y) * (z.y - hit.y);
      if (d < bestD) {
        bestD = d;
        best = z;
      }
    }
    if (!best) break;
    best.mark = 1;
    addBolt(s, fromX, fromY, best.x, best.y);
    fromX = best.x;
    fromY = best.y;
    damageZero(s, best, spec.damage);
  }
  for (let i = 0; i < s.zeros.length; i++) {
    const z = s.zeros[i];
    if (z) z.mark = 0;
  }
}

/** A bullet from weapon `w` landed on `z`. */
export function applyHit(s: GameState, w: WeaponDef, z: Zero): void {
  damageZero(s, z, w.damage);
  splash(s, w, z);
  chain(s, w, z);
}

/** The Rail Laser: a beam from the muzzle along `angle`, hitting every zero ahead on its line. */
export function fireBeam(s: GameState, w: WeaponDef, angle: number): void {
  const length = Math.hypot(s.width, s.height) * BEAM_LENGTH;
  const ox = s.muzzleX;
  const oy = s.muzzleY;
  const dx = Math.cos(angle) * length;
  const dy = Math.sin(angle) * length;
  const beam = acquire(s.beams);
  if (beam) {
    beam.x1 = ox;
    beam.y1 = oy;
    beam.x2 = ox + dx;
    beam.y2 = oy + dy;
    beam.t = 0;
    beam.dur = BEAM_DURATION;
  }
  const len2 = dx * dx + dy * dy;
  for (let i = 0; i < s.zeros.length; i++) {
    const z = s.zeros[i];
    if (!z || !hittable(z)) continue;
    const t = ((z.x - ox) * dx + (z.y - oy) * dy) / len2;
    if (t < 0) continue; // behind the turret
    const off = Math.hypot(z.x - (ox + dx * t), z.y - (oy + dy * t));
    if (off < Math.max(z.ry, BEAM_MIN_REACH)) damageZero(s, z, w.damage);
  }
}
