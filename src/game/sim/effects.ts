'worklet';
// Juice: particles, shockwave rings, screen shake and flash, ported from the prototype's
// explode() and update(). Every effect draws from a fixed pool; when a pool is full the extra
// pieces are simply skipped. Reduce motion means fewer particles and much less shake.
import {
  FLASH_DECAY,
  FRAGMENT,
  KILL_FRAGMENTS,
  KILL_FRAGMENTS_BUSY,
  KILL_PARTICLE_CAP,
  KILL_RING,
  KILL_SPARKS,
  KILL_SPARKS_BUSY,
  MUZZLE_DECAY,
  PARTICLE_DRAG,
  REDUCED_PARTICLES,
  REDUCED_SHAKE,
  SHAKE_DECAY,
  SHAKE_KILL_BASE,
  SHAKE_KILL_MAX,
  SHAKE_KILL_PER_RY,
  SHAKE_MIN,
  SPARK,
} from './constants';
import { decay } from './ease';
import { acquire, release } from './pool';
import { random, spread } from './rng';
import type { ColorSlot, GameState, Particle, ParticleShape, Zero } from './types';

const TAU = Math.PI * 2;

/** `count`, halved (rounding up) under reduce motion. */
export function scaledCount(s: GameState, count: number): number {
  return s.reduceMotion ? Math.ceil(count * REDUCED_PARTICLES) : count;
}

export function addShake(s: GameState, amount: number): void {
  s.shake = Math.max(s.shake, amount * (s.reduceMotion ? REDUCED_SHAKE : 1));
}

export function addFlash(s: GameState, amount: number): void {
  s.flash = Math.max(s.flash, amount);
}

/** A fresh particle at (x, y), or null when the pool is full. The caller sets its motion and size. */
export function particle(s: GameState, shape: ParticleShape, x: number, y: number, color: ColorSlot): Particle | null {
  const p = acquire(s.particles);
  if (!p) return null;
  p.shape = shape;
  p.x = x;
  p.y = y;
  p.vx = 0;
  p.vy = 0;
  p.color = color;
  p.life = 0;
  p.max = 1;
  p.size = 1;
  p.gravity = 0;
  p.drag = PARTICLE_DRAG;
  p.dragY = shape === 'dot';
  p.rot = 0;
  p.spin = 0;
  return p;
}

/** Launch `p` in a random direction at `speed`, plus `lift` upward. */
function fling(s: GameState, p: Particle, speed: number, lift: number): void {
  const a = random(s.rng) * TAU;
  p.vx = Math.cos(a) * speed;
  p.vy = Math.sin(a) * speed - lift;
}

/** Sparks flying out of a zero. Skipped once the pool is past KILL_PARTICLE_CAP. */
export function sparks(s: GameState, z: Zero, count: number): void {
  const scale = Math.max(SPARK.scaleMin, z.ry / SPARK.scaleRef);
  for (let i = 0; i < count; i++) {
    if (s.particles.count >= KILL_PARTICLE_CAP) return;
    const p = particle(s, 'dot', z.x, z.y, z.color);
    if (!p) return;
    fling(s, p, (SPARK.speedMin + random(s.rng) * SPARK.speedRange) * scale, 0);
    p.max = SPARK.lifeMin + random(s.rng) * SPARK.lifeRange;
    p.size = SPARK.sizeMin + random(s.rng) * SPARK.sizeRange * scale;
  }
}

/** Little "0" rings that tumble out of a zero and fall. */
export function fragments(s: GameState, z: Zero, count: number): void {
  for (let i = 0; i < count; i++) {
    if (s.particles.count >= KILL_PARTICLE_CAP) return;
    const p = particle(s, 'ring', z.x, z.y, z.color);
    if (!p) return;
    fling(s, p, FRAGMENT.speedMin + random(s.rng) * FRAGMENT.speedRange, FRAGMENT.lift);
    p.max = FRAGMENT.lifeMin + random(s.rng) * FRAGMENT.lifeRange;
    p.size = z.ry * FRAGMENT.size;
    p.gravity = FRAGMENT.gravity;
    p.rot = random(s.rng) * TAU;
    p.spin = spread(s.rng, FRAGMENT.spin / 2);
  }
}

/** A shockwave ring growing from `r` to `max` over `dur` seconds, thinning as it goes. */
export function addRing(
  s: GameState,
  x: number,
  y: number,
  r: number,
  max: number,
  dur: number,
  color: ColorSlot,
  width: number,
): void {
  const ring = acquire(s.rings);
  if (!ring) return;
  ring.x = x;
  ring.y = y;
  ring.r = r;
  ring.max = max;
  ring.t = 0;
  ring.dur = dur;
  ring.color = color;
  ring.width = width;
}

/** A zero going up: sparks, fragments, a shockwave and a shake (the prototype's explode). */
export function explode(s: GameState, z: Zero): void {
  sparks(s, z, scaledCount(s, s.busy ? KILL_SPARKS_BUSY : KILL_SPARKS));
  fragments(s, z, scaledCount(s, s.busy ? KILL_FRAGMENTS_BUSY : KILL_FRAGMENTS));
  addRing(
    s,
    z.x,
    z.y,
    z.ry * KILL_RING.start,
    z.ry * KILL_RING.reach,
    KILL_RING.duration,
    z.color,
    Math.max(KILL_RING.minWidth, z.ry * KILL_RING.width),
  );
  addShake(s, Math.min(SHAKE_KILL_MAX, SHAKE_KILL_BASE + z.ry * SHAKE_KILL_PER_RY));
}

function updateParticles(s: GameState, dt: number): void {
  const pool = s.particles;
  for (let i = pool.count - 1; i >= 0; i--) {
    const p = pool.items[i];
    if (!p) continue;
    p.life += dt;
    if (p.life >= p.max) {
      release(pool, i);
      continue;
    }
    p.vy += p.gravity * dt;
    const d = decay(p.drag, dt);
    p.vx *= d;
    if (p.dragY) p.vy *= d;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.rot += p.spin * dt;
  }
}

function age(pool: { items: { t: number; dur: number }[]; count: number }, dt: number): void {
  for (let i = pool.count - 1; i >= 0; i--) {
    const item = pool.items[i];
    if (!item) continue;
    item.t += dt;
    if (item.t >= item.dur) release(pool, i);
  }
}

/** Move every effect on by `dt`, retire the finished ones, and settle the shake and flashes. */
export function updateEffects(s: GameState, dt: number): void {
  updateParticles(s, dt);
  age(s.rings, dt);
  age(s.beams, dt);
  age(s.bolts, dt);
  s.shake *= decay(SHAKE_DECAY, dt);
  s.flash *= decay(FLASH_DECAY, dt);
  s.muzzle *= decay(MUZZLE_DECAY, dt);
  if (s.shake > SHAKE_MIN) {
    s.shakeX = spread(s.rng, s.shake / 2);
    s.shakeY = spread(s.rng, s.shake / 2);
  } else {
    s.shakeX = 0;
    s.shakeY = 0;
  }
}
