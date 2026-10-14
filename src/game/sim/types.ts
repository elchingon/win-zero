'worklet';
// The shooting round's state. It lives on the UI thread and is mutated in place every frame,
// so everything is plain data: fixed pools of reusable objects, palette slots instead of
// color strings, and the random number generator's state inside it.
import type { WeaponDef, ZeroGroup, ZeroKind } from '@/engine';

/** play → celebrate (the last zero went) → fill (the screen fills with zeros) → done (result sheet). */
export type Phase = 'play' | 'celebrate' | 'fill' | 'done';

/** An index into tokens.zeroPalette: amber, flare, teal, fg. */
export type ColorSlot = number;

export interface Zero {
  alive: boolean;
  kind: ZeroKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rx: number;
  ry: number;
  color: ColorSlot;
  hp: number;
  maxHp: number;
  /** Zeros this object counts for in the HUD: 1, or V for an armored zero. */
  value: number;
  energyBar: boolean;
  /** Seconds after the round starts before it pops in. Bullets pass through until then. */
  delay: number;
  age: number;
  /** 1 right after a hit it survived, fading to 0. */
  hitFlash: number;
  /** Scratch mark for picking chain targets without allocating. */
  mark: number;
}

export interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** The weapon that fired it: its damage, splash and chain. */
  weapon: WeaponDef;
}

export type ParticleShape = 'dot' | 'ring' | 'confetti';

export interface Particle {
  shape: ParticleShape;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: ColorSlot;
  gravity: number;
  drag: number;
  /** Dots slow down on both axes; rings and confetti only sideways, so they fall. */
  dragY: boolean;
  rot: number;
  spin: number;
}

/** An expanding shockwave ring. */
export interface Ring {
  x: number;
  y: number;
  r: number;
  max: number;
  t: number;
  dur: number;
  color: ColorSlot;
  width: number;
}

/** A Rail Laser beam. */
export interface Beam {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  t: number;
  dur: number;
}

/** A Chain Zapper bolt: BOLT_POINTS points from one zero to the next. */
export interface Bolt {
  xs: number[];
  ys: number[];
  t: number;
  dur: number;
}

/** One "0" in the celebration fill. */
export interface Glyph {
  x: number;
  y: number;
  color: ColorSlot;
  delay: number;
}

/** A fixed set of reusable objects: items[0 .. count) are live. */
export interface Pool<T> {
  items: T[];
  count: number;
}

export interface Rng {
  s: number;
}

/** What the screen hands the sim to start a round. Computed on the JS thread. */
export interface GameConfig {
  /** Zero value in the round: the day's streak. */
  n: number;
  /** composeRound(n).groups */
  groups: readonly ZeroGroup[];
  width: number;
  height: number;
  insetTop: number;
  insetBottom: number;
  weapon: WeaponDef;
  seed: number;
  reduceMotion: boolean;
}

/** What happened since the last report, sent to the JS thread at most once a frame. */
export interface Report {
  dirty: boolean;
  valueLeft: number;
  shots: number;
  hits: number;
  kills: number;
  armoredKills: number;
  blasts: number;
  bombs: number;
  /** The last zero went this frame. */
  final: boolean;
  /** The fill has landed: show the result sheet. */
  showResult: boolean;
}

export interface GameState {
  n: number;
  width: number;
  height: number;
  /** Zeros bounce between these. */
  top: number;
  bottom: number;
  muzzleX: number;
  muzzleY: number;
  reduceMotion: boolean;
  objectCount: number;
  /** A crowded round: fewer particles per kill. */
  busy: boolean;

  phase: Phase;
  time: number;
  /** Seconds since the phase began. */
  phaseT: number;
  valueLeft: number;

  zeros: Zero[];
  bullets: Pool<Bullet>;
  particles: Pool<Particle>;
  rings: Pool<Ring>;
  beams: Pool<Beam>;
  bolts: Pool<Bolt>;

  glyphs: Glyph[];
  glyphCount: number;
  glyphSize: number;
  /** Seconds from the fill's start until its last glyph lands. */
  fillLen: number;

  weapon: WeaponDef;
  /** Aim angle from the muzzle, radians; straight up is -π/2. */
  aim: number;
  firing: boolean;
  /** Seconds since the last shot. */
  sinceShot: number;

  shake: number;
  flash: number;
  muzzle: number;

  rng: Rng;
  report: Report;
}
