'worklet';
// Building a round: zeros from composeRound's groups, placed and set moving the way the round's
// mode wants (the Shooter as in the prototype's spawn()), plus every pool the frame loop will
// need, allocated once up front.
import { DEFAULT_MODE, PLAYABLE_MODES, type ModeId } from '@/engine';

import {
  ARMOR_SIZE_SCALE,
  ARMOR_SPEED_SCALE,
  BOLT_POINTS,
  BUSY_OBJECTS,
  HUD_BOTTOM,
  HUD_TOP,
  MAX_BEAMS,
  MAX_BOLTS,
  MAX_BULLETS,
  MAX_PARTICLES,
  MAX_RINGS,
  PALETTE_SIZE,
  SIZE_JITTER,
  SMALL_ZERO_BOOST,
  SMALL_ZERO_REF,
  SPAWN_DELAY_BASE,
  SPAWN_DELAY_MAX,
  SPAWN_DELAY_PER_ZERO,
  SPEED_BASE,
  SPEED_CROWD_MAX,
  SPEED_JITTER_MIN,
  SPEED_JITTER_RANGE,
  SPEED_MAX,
  SPEED_PER_ZERO,
  TURRET_Y_FROM_BOTTOM,
} from './constants';
import { armorBadges } from './badges';
import { layoutFill } from './fill';
import { makePool } from './pool';
import { makeCatchState, placeCatch } from './modes/catch';
import { makeOrbitState, orbitSpares, placeOrbit } from './modes/orbit';
import { makeReport } from './report';
import { between, makeRng, random } from './rng';
import { ZERO_ASPECT, ZERO_MIN_RADIUS, zeroRadius } from './sizing';
import type { Beam, Bolt, Bullet, GameConfig, GameState, Glyph, ModeState, Particle, Ring, Zero } from './types';

function makeZero(): Zero {
  return {
    alive: false,
    kind: 'standard',
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    rx: 0,
    ry: 0,
    color: 0,
    hp: 0,
    maxHp: 0,
    value: 0,
    badge: -1,
    energyBar: false,
    delay: 0,
    age: 0,
    hitFlash: 0,
    mark: 0,
    cooldown: 0,
  };
}

function makeParticle(): Particle {
  return {
    shape: 'dot',
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    life: 0,
    max: 0,
    size: 0,
    color: 0,
    gravity: 0,
    drag: 0,
    dragY: true,
    rot: 0,
    spin: 0,
  };
}

function makeRing(): Ring {
  return { x: 0, y: 0, r: 0, max: 0, t: 0, dur: 0, color: 0, width: 0 };
}

function makeBeam(): Beam {
  return { x1: 0, y1: 0, x2: 0, y2: 0, t: 0, dur: 0 };
}

function makeBolt(): Bolt {
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i < BOLT_POINTS; i++) {
    xs.push(0);
    ys.push(0);
  }
  return { xs, ys, t: 0, dur: 0 };
}

function makeGlyph(): Glyph {
  return { x: 0, y: 0, color: 0, delay: 0 };
}

/** Place and launch every zero. The play area and object count must already be set. */
function spawnZeros(state: GameState, cfg: GameConfig): void {
  const rng = state.rng;
  const count = state.objectCount;
  const base = zeroRadius(count, state.width, state.height);
  const crowdSpeed = SPEED_BASE + Math.min(SPEED_CROWD_MAX, count * SPEED_PER_ZERO);
  const delaySpan = Math.min(SPAWN_DELAY_MAX, SPAWN_DELAY_BASE + count * SPAWN_DELAY_PER_ZERO);
  const badges = armorBadges(cfg.groups);
  let i = 0;
  for (let g = 0; g < cfg.groups.length; g++) {
    const group = cfg.groups[g];
    if (!group) continue;
    const armored = group.kind === 'armored';
    for (let k = 0; k < group.count; k++) {
      const z = state.zeros[i];
      if (!z) return;
      const ry = base * (1 - SIZE_JITTER / 2 + random(rng) * SIZE_JITTER) * (armored ? ARMOR_SIZE_SCALE : 1);
      const rx = ry * ZERO_ASPECT;
      const jitter = SPEED_JITTER_MIN + random(rng) * SPEED_JITTER_RANGE;
      const smallBoost = 1 + (SMALL_ZERO_REF / Math.max(ry, ZERO_MIN_RADIUS)) * SMALL_ZERO_BOOST;
      const speed = Math.min(SPEED_MAX, crowdSpeed * jitter * smallBoost) * (armored ? ARMOR_SPEED_SCALE : 1);
      const angle = random(rng) * Math.PI * 2;
      const yMin = state.top + ry;
      const yMax = Math.max(yMin, state.bottom - ry);
      z.alive = true;
      z.kind = group.kind;
      z.rx = rx;
      z.ry = ry;
      z.x = rx + random(rng) * Math.max(0, state.width - 2 * rx);
      z.y = between(rng, yMin, yMax);
      z.vx = Math.cos(angle) * speed;
      z.vy = Math.sin(angle) * speed;
      z.color = i % PALETTE_SIZE;
      z.hp = group.hp;
      z.maxHp = group.hp;
      z.value = group.value;
      z.badge = armored ? badges.indexOf(group.value) : -1;
      z.energyBar = group.energyBar;
      z.delay = random(rng) * delaySpan;
      z.age = 0;
      z.hitFlash = 0;
      z.mark = 0;
      z.cooldown = 0;
      i++;
    }
  }
}

/** The mode a round plays: the one asked for once its round is built, otherwise the Shooter. */
function roundMode(mode: ModeId | undefined): ModeId {
  return mode !== undefined && PLAYABLE_MODES.indexOf(mode) >= 0 ? mode : DEFAULT_MODE;
}

function makeModeState(mode: ModeId, count: number, objectCount: number, cfg: GameConfig): ModeState {
  switch (mode) {
    case 'catch':
      return makeCatchState(count, cfg.width);
    case 'orbit':
      return makeOrbitState(count, objectCount, cfg.groups);
    case 'shooter':
    default:
      return { mode: 'shooter' };
  }
}

/** Place the zeros as the round's mode starts them. */
function placeZeros(state: GameState, cfg: GameConfig): void {
  switch (state.mode) {
    case 'catch':
      placeCatch(state, cfg);
      break;
    case 'orbit':
      placeOrbit(state, cfg);
      break;
    case 'shooter':
    default:
      spawnZeros(state, cfg);
  }
}

/**
 * A fresh round in exactly `mode`, whether or not that mode is offered yet: createGame picks the
 * mode, and a mode's tests build its round before it joins PLAYABLE_MODES.
 */
export function buildGame(cfg: GameConfig, mode: ModeId): GameState {
  let objectCount = 0;
  for (let g = 0; g < cfg.groups.length; g++) objectCount += cfg.groups[g]?.count ?? 0;

  // A mode may keep spare slots past the round's own zeros (Orbit's split pieces).
  const slots = objectCount + (mode === 'orbit' ? orbitSpares(cfg.groups, objectCount) : 0);
  const zeros: Zero[] = [];
  for (let i = 0; i < slots; i++) zeros.push(makeZero());
  const glyphs: Glyph[] = [];
  const glyphCount = cfg.fill.glyphs;
  for (let i = 0; i < glyphCount; i++) glyphs.push(makeGlyph());

  const bottomInset = cfg.height - cfg.insetBottom;
  const state: GameState = {
    mode,
    modeState: makeModeState(mode, zeros.length, objectCount, cfg),
    n: cfg.n,
    seed: cfg.seed,
    width: cfg.width,
    height: cfg.height,
    top: cfg.insetTop + HUD_TOP,
    bottom: bottomInset - HUD_BOTTOM,
    muzzleX: cfg.width / 2,
    muzzleY: bottomInset - TURRET_Y_FROM_BOTTOM,
    reduceMotion: cfg.reduceMotion,
    objectCount,
    busy: objectCount > BUSY_OBJECTS,

    phase: 'play',
    time: 0,
    phaseT: 0,
    valueLeft: cfg.n,

    zeros,
    bullets: makePool<Bullet>(MAX_BULLETS, () => ({ x: 0, y: 0, vx: 0, vy: 0, weapon: cfg.weapon })),
    particles: makePool(MAX_PARTICLES, makeParticle),
    rings: makePool(MAX_RINGS, makeRing),
    beams: makePool(MAX_BEAMS, makeBeam),
    bolts: makePool(MAX_BOLTS, makeBolt),

    glyphs,
    glyphCount,
    glyphSize: 0,
    overlayNumber: cfg.fill.overlayNumber,
    fillLen: 0,

    weapon: cfg.weapon,
    pointer: { down: false, x: 0, y: 0 },
    aim: -Math.PI / 2,
    firing: false,
    sinceShot: Infinity,
    sinceDamage: 0,

    shake: 0,
    shakeX: 0,
    shakeY: 0,
    flash: 0,
    muzzle: 0,

    rng: makeRng(cfg.seed),
    report: makeReport(cfg.n, cfg.seed),
  };
  placeZeros(state, cfg);
  layoutFill(state);
  return state;
}

/** A fresh round, ready for its first frame, in the mode it asks for once that mode's round is built. */
export function createGame(cfg: GameConfig): GameState {
  return buildGame(cfg, roundMode(cfg.mode));
}
