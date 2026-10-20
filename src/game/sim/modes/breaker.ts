'worklet';
// Breaker (SPEC 9): the zeros are bricks, standing in a grid in the top of the board, steel
// (armored) rows on top, and balls off a paddle break them. A ball hit is a hit from the
// power-up's weapon (its damage, splash and chain). A dropped ball just respawns on the paddle
// and serves itself, aimed at a brick, so a round always ends, even with a paddle that never
// moves. The paddle follows the finger's x, and starts in the middle.
//
// The layout keeps one ball quick enough for a long round, since a brick's hits and a ball's
// damage are the round's and the weapon's: a gap under the ceiling, where a ball that gets up
// there rattles against the steel; gutters by the walls that carry it up there; and room
// between bricks to ricochet through.
import type { WeaponId } from '@/engine';

import { armorBadges } from '../badges';
import { liveZeros } from '../board';
import { ARMOR_SIZE_SCALE, ASSIST_LAST, HIT_FLASH } from '../constants';
import { hittable } from '../hit';
import { ZERO_ASPECT, zeroRadius } from '../sizing';
import { updateFiring } from '../trigger';
import type { Ball, BallLook, BreakerState, GameConfig, GameState, Zero } from '../types';
import { applyHit } from '../weapons';
import { popInSpan, readyZero } from './place';

/** Most balls in play at once (Multi-ball's). */
export const BREAKER_MAX_BALLS = 5;
/** A ball's radius, in points (the Mega Ball's is bigger). */
export const BALL_R = 7;
/** A ball crosses from the paddle to the top of the board in about this long, within these speeds. */
export const BREAKER_CROSS_S = 0.8;
export const BALL_SPEED_MIN = 500;
export const BALL_SPEED_MAX = 1100;
/** Each paddle hit speeds a ball up this much, to at most this many times the board's speed. */
export const BREAKER_SPEEDUP = 1.03;
export const BREAKER_SPEEDUP_MAX = 1.3;
/** A ball never travels flatter than this (radians from level), so it can't skim between the walls. */
export const BREAKER_MIN_ANGLE = (25 * Math.PI) / 180;
/** Off the paddle's ends, a ball leaves at up to this angle from straight up (radians). */
export const BREAKER_BOUNCE_MAX = (60 * Math.PI) / 180;
/** A ball moves at most this share of its radius per sub-step, so it never skips through a brick. */
export const BREAKER_STEP = 0.5;
/** A held ball serves itself after this long; a tap serves it at once. */
export const BALL_SERVE_DELAY = 0.6;
/** A ball this far past the paddle's top is dropped, and respawns on the paddle. */
export const BREAKER_DROP = 40;

/** The bricks' field: its share of the board's height. */
export const BREAKER_FIELD = 0.55;
/** In ball widths: the gap under the ceiling, the gutters by the walls, and the least room between bricks. */
export const BREAKER_CEILING_GAP = 3;
export const BREAKER_GUTTER = 2.5;
export const BREAKER_GAP = 0.8;

/** The paddle's half-width: this share of the board's width, at least PADDLE_MIN_HALF points. Its top speed, in board widths a second. */
export const PADDLE_HALF_SHARE = 0.1;
export const PADDLE_MIN_HALF = 38;
export const PADDLE_SPEED = 2.5;
/** Held balls sit this many radii apart on the paddle. */
export const PADDLE_BALL_SPACING = 2.4;

/**
 * Assist: once nothing's been hit for this long, as when only ASSIST_LAST bricks are left, every
 * ball off the paddle heads straight for a brick. (Not by curving in flight: a fast ball turning
 * gently can circle its brick for ever.)
 */
export const BREAKER_ASSIST_IDLE = 4;
/** A ball back at the paddle more than this many times in a row without touching a brick leaves it for one, so no rally goes nowhere. */
export const BREAKER_EMPTY_RETURNS = 1;

export interface BreakerPower {
  balls: number;
  /** The ball's radius, times BALL_R. */
  size: number;
  /** It burns through a brick it breaks rather than bouncing off it. */
  pierce: boolean;
  /** The paddle fires the Rail Laser while the finger is down. */
  laser: boolean;
  look: BallLook;
}

/**
 * Each power-up, by the weapon tier it stands for (engine MODES): 1 ball, 2 balls, Multi-ball,
 * Fireball, Lightning Ball, Laser Paddle, Mega Ball. A ball hits with the weapon's damage,
 * splash and chain; the Laser Paddle fires the Rail Laser itself.
 */
export const BREAKER_POWER: Readonly<Record<WeaponId, BreakerPower>> = {
  pea: { balls: 1, size: 1, pierce: false, laser: false, look: 'plain' },
  twin: { balls: 2, size: 1, pierce: false, laser: false, look: 'plain' },
  scatter: { balls: 5, size: 1, pierce: false, laser: false, look: 'plain' },
  rocket: { balls: 1, size: 1.2, pierce: true, laser: false, look: 'fire' },
  chain: { balls: 1, size: 1, pierce: false, laser: false, look: 'lightning' },
  laser: { balls: 1, size: 1, pierce: false, laser: true, look: 'plain' },
  nuke: { balls: 1, size: 2.2, pierce: true, laser: false, look: 'mega' },
};

/** Breaker's state on a board `width` wide: the paddle in the middle, no ball yet. */
export function makeBreakerState(width: number): BreakerState {
  const ball: Ball[] = [];
  for (let k = 0; k < BREAKER_MAX_BALLS; k++) {
    ball.push({ live: false, held: false, x: 0, y: 0, vx: 0, vy: 0, serve: 0, speed: 0, returns: 0 });
  }
  return {
    mode: 'breaker',
    paddleX: width / 2,
    targetX: width / 2,
    half: PADDLE_MIN_HALF,
    ball,
    balls: 1,
    radius: BALL_R,
    look: 'plain',
    pierce: false,
    laser: false,
    speed: BALL_SPEED_MIN,
    assist: false,
  };
}

/** The balls as the power-up has them now; a switch adds balls on the paddle, or takes the newest away. */
function applyPower(s: GameState, bs: BreakerState): void {
  const p = BREAKER_POWER[s.weapon.id];
  bs.balls = p.balls;
  bs.radius = BALL_R * p.size;
  bs.look = p.look;
  bs.pierce = p.pierce;
  bs.laser = p.laser;
  for (let k = 0; k < bs.ball.length; k++) {
    const b = bs.ball[k];
    if (!b) continue;
    if (k >= bs.balls) {
      b.live = false;
    } else if (!b.live) {
      b.live = true;
      b.held = true;
      b.serve = BALL_SERVE_DELAY;
      b.speed = bs.speed;
      b.returns = 0;
    }
  }
}

/** Stand every brick in the grid that fits the round's count biggest, steel on top, and hold the first balls on the paddle. */
export function placeBreaker(s: GameState, cfg: GameConfig): void {
  const bs = s.modeState;
  if (bs.mode !== 'breaker') return;
  const count = s.objectCount;
  const board = s.bottom - s.top;
  bs.speed = Math.max(BALL_SPEED_MIN, Math.min(BALL_SPEED_MAX, board / BREAKER_CROSS_S));
  bs.half = Math.max(PADDLE_MIN_HALF, s.width * PADDLE_HALF_SHARE);
  const across = 2 * BALL_R;
  const fieldTop = s.top + BREAKER_CEILING_GAP * across;
  const fieldH = board * BREAKER_FIELD;
  const fieldW = s.width - 2 * BREAKER_GUTTER * across;
  const gap = BREAKER_GAP * across;
  let cols = 1;
  let biggest = 0;
  for (let c = 1; c <= count; c++) {
    const r = Math.ceil(count / c);
    const ry = Math.min((fieldH / r - gap) / 2, (fieldW / c - gap) / (2 * ZERO_ASPECT));
    if (ry > biggest) {
      biggest = ry;
      cols = c;
    }
    if (r === 1) break;
  }
  const rows = Math.ceil(count / cols);
  const cellW = fieldW / cols;
  const cellH = fieldH / rows;
  const base = zeroRadius(count, s.width, s.height);
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
      // Never bigger than the sprite it's drawn from.
      z.ry = Math.max(1, Math.min(biggest, base * (armored ? ARMOR_SIZE_SCALE : 1)));
      z.rx = z.ry * ZERO_ASPECT;
      z.delay = (i / Math.max(1, count)) * span;
      i++;
    }
  }
  // Steel on top: the armored bricks take the first cells, row by row.
  let cell = 0;
  for (let pass = 0; pass < 2; pass++) {
    for (let j = 0; j < count; j++) {
      const z = s.zeros[j];
      if (!z || (z.kind === 'armored') !== (pass === 0)) continue;
      const row = Math.floor(cell / cols);
      const col = cell - row * cols;
      const inRow = row === rows - 1 ? count - row * cols : cols;
      z.x = s.width / 2 + (col - (inRow - 1) / 2) * cellW;
      z.y = fieldTop + cellH * (row + 0.5);
      cell++;
    }
  }
  applyPower(s, bs);
  for (let k = 0; k < bs.balls; k++) {
    const b = bs.ball[k];
    if (!b) continue;
    b.live = true;
    b.held = true;
    b.serve = BALL_SERVE_DELAY + span;
    b.speed = bs.speed;
  }
}

/** The brick nearest (x, y) that a ball can hit, or null. */
function nearestBrick(s: GameState, x: number, y: number): Zero | null {
  let best: Zero | null = null;
  let bestD = Infinity;
  for (let i = 0; i < s.zeros.length; i++) {
    const z = s.zeros[i];
    if (!z || !hittable(z)) continue;
    const d = (z.x - x) * (z.x - x) + (z.y - y) * (z.y - y);
    if (d < bestD) {
      bestD = d;
      best = z;
    }
  }
  return best;
}

/** Send a ball straight at the nearest brick: in a board with no corners to go round, the first thing it meets is a brick. */
function aimAtBrick(s: GameState, b: Ball): boolean {
  const z = nearestBrick(s, b.x, b.y);
  if (!z) return false;
  const dx = z.x - b.x;
  const dy = z.y - b.y;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  b.vx = (dx / len) * b.speed;
  b.vy = (dy / len) * b.speed;
  return true;
}

/** Keep a ball off the level: at least BREAKER_MIN_ANGLE, at its own speed. */
function steepen(b: Ball): void {
  const least = b.speed * Math.sin(BREAKER_MIN_ANGLE);
  if (Math.abs(b.vy) >= least) return;
  b.vy = b.vy > 0 ? least : -least;
  b.vx = (b.vx < 0 ? -1 : 1) * Math.sqrt(b.speed * b.speed - least * least);
}

/** A held ball leaves the paddle for a brick. */
function serve(s: GameState, b: Ball): void {
  if (!aimAtBrick(s, b)) return;
  b.held = false;
}

/** A ball fell past the paddle: back to the paddle, at the board's speed, to serve again. */
function dropBall(bs: BreakerState, b: Ball): void {
  b.held = true;
  b.serve = BALL_SERVE_DELAY;
  b.speed = bs.speed;
  b.returns = 0;
}

/**
 * Off the paddle: the further from its middle, the more slanted; faster each time. Straight for a
 * brick in the assist, or when it keeps coming back without touching one.
 */
function offPaddle(s: GameState, bs: BreakerState, b: Ball, r: number): void {
  b.y = s.bottom - r;
  b.speed = Math.min(bs.speed * BREAKER_SPEEDUP_MAX, b.speed * BREAKER_SPEEDUP);
  b.returns++;
  s.report.bounces++;
  s.report.dirty = true;
  if ((bs.assist || b.returns > BREAKER_EMPTY_RETURNS) && aimAtBrick(s, b)) return;
  const along = Math.max(-1, Math.min(1, (b.x - bs.paddleX) / bs.half));
  const angle = along * BREAKER_BOUNCE_MAX;
  b.vx = Math.sin(angle) * b.speed;
  b.vy = -Math.cos(angle) * b.speed;
}

/** The ball at radius r meets brick z (if it does): a hit, and a bounce off a brick still standing. True when it met one. */
function offBrick(s: GameState, bs: BreakerState, b: Ball, r: number, z: Zero): boolean {
  const ax = z.rx + r;
  const ay = z.ry + r;
  if (Math.abs(b.x - z.x) > ax || Math.abs(b.y - z.y) > ay) return false;
  const u = (b.x - z.x) / ax;
  const v = (b.y - z.y) / ay;
  const d = Math.sqrt(u * u + v * v);
  if (d >= 1) return false;
  applyHit(s, s.weapon, z);
  b.returns = 0;
  s.report.bounces++;
  s.report.dirty = true;
  // A Fireball or Mega Ball burns on through a brick it breaks.
  if (bs.pierce && !z.alive) return true;
  // Bounce off the oval, the way it faces where the ball struck, and step back out of it.
  let nx = u / ax;
  let ny = v / ay;
  const nl = Math.sqrt(nx * nx + ny * ny) || 1;
  nx /= nl;
  ny /= nl;
  const dot = b.vx * nx + b.vy * ny;
  if (dot < 0) {
    b.vx -= 2 * dot * nx;
    b.vy -= 2 * dot * ny;
  }
  const out = d > 0 ? 1 / d : 1;
  b.x = z.x + u * out * ax;
  b.y = z.y + (d > 0 ? v * out : 1) * ay;
  steepen(b);
  return true;
}

/** One flying ball for dt, in sub-steps short enough that it never skips through a brick. */
function fly(s: GameState, bs: BreakerState, b: Ball, dt: number): void {
  const r = bs.radius;
  const steps = Math.max(1, Math.ceil((b.speed * dt) / (r * BREAKER_STEP)));
  const h = dt / steps;
  for (let k = 0; k < steps; k++) {
    b.x += b.vx * h;
    b.y += b.vy * h;
    if (b.x < r) {
      b.x = r;
      b.vx = Math.abs(b.vx);
      steepen(b);
    } else if (b.x > s.width - r) {
      b.x = s.width - r;
      b.vx = -Math.abs(b.vx);
      steepen(b);
    }
    if (b.y < s.top + r) {
      b.y = s.top + r;
      b.vy = Math.abs(b.vy);
    }
    const bottom = b.y + r;
    if (b.vy > 0 && bottom >= s.bottom && bottom - b.vy * h <= s.bottom && Math.abs(b.x - bs.paddleX) <= bs.half + r) {
      offPaddle(s, bs, b, r);
      continue;
    }
    if (b.y - r > s.bottom + BREAKER_DROP) {
      dropBall(bs, b);
      return;
    }
    if (s.phase !== 'play') continue;
    for (let i = 0; i < s.zeros.length; i++) {
      const z = s.zeros[i];
      if (z && hittable(z) && offBrick(s, bs, b, r, z)) break;
    }
  }
}

/** One frame of Breaker: the paddle glides to the finger and fires its laser, held balls serve, and flying balls fly. */
export function stepBreaker(s: GameState, dt: number): void {
  const bs = s.modeState;
  if (bs.mode !== 'breaker') return;
  applyPower(s, bs);
  bs.assist = s.phase === 'play' && (s.sinceDamage >= BREAKER_ASSIST_IDLE || liveZeros(s) <= ASSIST_LAST);
  const target = Math.max(bs.half, Math.min(s.width - bs.half, bs.targetX));
  const most = PADDLE_SPEED * s.width * dt;
  bs.paddleX += Math.max(-most, Math.min(most, target - bs.paddleX));
  // The Laser Paddle fires the Rail Laser straight up from the paddle at the fire rate.
  s.muzzleX = bs.paddleX;
  s.muzzleY = s.bottom;
  s.aim = -Math.PI / 2;
  s.firing = bs.laser && s.pointer.down && s.phase === 'play';
  updateFiring(s);
  for (let i = 0; i < s.zeros.length; i++) {
    const z = s.zeros[i];
    if (!z || !z.alive) continue;
    z.age += dt;
    if (z.hitFlash > 0) z.hitFlash = Math.max(0, z.hitFlash - dt / HIT_FLASH);
  }
  // The fill freezes whatever's left behind it.
  if (s.phase !== 'play' && s.phase !== 'celebrate') return;
  let held = 0;
  for (let k = 0; k < bs.ball.length; k++) {
    const b = bs.ball[k];
    if (!b || !b.live) continue;
    if (!b.held) {
      fly(s, bs, b, dt);
      continue;
    }
    b.x = bs.paddleX + (held - (bs.balls - 1) / 2) * bs.radius * PADDLE_BALL_SPACING;
    b.y = s.bottom - bs.radius;
    held++;
    b.serve -= dt;
    if (b.serve <= 0 && s.phase === 'play') serve(s, b);
  }
}

/** The finger lands at x: the paddle heads there, and balls waiting on it serve. */
export function breakerDown(s: GameState, x: number): void {
  const bs = s.modeState;
  if (bs.mode !== 'breaker') return;
  bs.targetX = x;
  if (s.phase !== 'play') return;
  for (let k = 0; k < bs.ball.length; k++) {
    const b = bs.ball[k];
    if (b && b.live && b.held) serve(s, b);
  }
}

/** The finger moves to x: the paddle follows. */
export function breakerMove(s: GameState, x: number): void {
  const bs = s.modeState;
  if (bs.mode === 'breaker') bs.targetX = x;
}
