'worklet';
// The end of the round: the final zero's celebration, then the fill, then the result sheet.
import {
  CONFETTI,
  CONFETTI_DRAG,
  CONFETTI_FRAGMENT,
  CONFETTI_PIECE,
  CONFETTI_RINGS,
  FILL_DELAY,
  FINAL_RINGS,
  FLASH_FINAL,
  PALETTE_SIZE,
  RESULT_DELAY,
  SHAKE_FINAL,
} from './constants';
import { addFlash, addRing, addShake, particle, scaledCount } from './effects';
import { updateFill } from './fill';
import { random, spread } from './rng';
import type { GameState, ParticleShape, Zero } from './types';

const TAU = Math.PI * 2;

type Burst = typeof CONFETTI_PIECE;

/** `count` pieces of celebration, cycling the palette, flung from (x, y). */
function throwPieces(s: GameState, shape: ParticleShape, x: number, y: number, count: number, b: Burst, drag: number): void {
  for (let i = 0; i < count; i++) {
    const p = particle(s, shape, x, y, i % PALETTE_SIZE);
    if (!p) return;
    const a = random(s.rng) * TAU;
    const v = b.speedMin + random(s.rng) * b.speedRange;
    p.vx = Math.cos(a) * v;
    p.vy = Math.sin(a) * v - b.lift;
    p.max = b.lifeMin + random(s.rng) * b.lifeRange;
    p.size = b.sizeMin + random(s.rng) * b.sizeRange;
    p.rot = random(s.rng) * TAU;
    p.spin = spread(s.rng, b.spin / 2);
    p.gravity = b.gravity;
    p.drag = drag;
    p.dragY = false;
  }
}

/** The last zero went at `z`: three shockwaves, confetti, a white flash and a big shake. */
export function celebrate(s: GameState, z: Zero): void {
  const diagonal = Math.hypot(s.width, s.height);
  for (let i = 0; i < FINAL_RINGS.length; i++) {
    const r = FINAL_RINGS[i];
    if (r) addRing(s, z.x, z.y, r.start, diagonal * r.reach, r.duration, r.color, r.width);
  }
  throwPieces(s, 'confetti', z.x, z.y, scaledCount(s, CONFETTI), CONFETTI_PIECE, CONFETTI_DRAG);
  throwPieces(s, 'ring', z.x, z.y, scaledCount(s, CONFETTI_RINGS), CONFETTI_FRAGMENT, CONFETTI_DRAG);
  addFlash(s, FLASH_FINAL);
  addShake(s, SHAKE_FINAL);
}

/** Celebrate → fill after FILL_DELAY → done (show the result) once the fill has landed. */
export function updatePhase(s: GameState, dt: number): void {
  if (s.phase === 'celebrate' && s.phaseT >= FILL_DELAY) {
    s.phase = 'fill';
    s.phaseT = 0;
  } else if (s.phase === 'fill' && s.phaseT >= s.fillLen + RESULT_DELAY) {
    s.phase = 'done';
    s.report.showResult = true;
    s.report.dirty = true;
  }
  if (s.phase === 'fill' || s.phase === 'done') updateFill(s, dt);
}
