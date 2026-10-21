'worklet';
// The round's state. It lives on the UI thread and is mutated in place every frame, so
// everything is plain data: fixed pools of reusable objects, palette slots instead of color
// strings, and the random number generator's state inside it. Every game mode shares these
// fields; what only one mode needs lives in `modeState`.
import type { FillPlan, ModeId, WeaponDef, ZeroGroup, ZeroKind } from '@/engine';

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
  /** Which ×V badge it wears (an index into armorBadges), or -1. */
  badge: number;
  energyBar: boolean;
  /** Seconds after the round starts before it pops in. Bullets pass through until then. */
  delay: number;
  age: number;
  /** 1 right after a hit it survived, fading to 0. */
  hitFlash: number;
  /** Scratch mark for picking chain targets without allocating. */
  mark: number;
  /** Seconds before it can be caught or cut again (Catch, Slice). Always 0 in the Shooter. */
  cooldown: number;
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

/** The player's finger, as the canvas last reported it. */
export interface Pointer {
  down: boolean;
  x: number;
  y: number;
}

/** The Shooter keeps everything it needs in the shared fields. */
export interface ShooterState {
  mode: 'shooter';
}

/** What draws zeros toward Catch's cups: nothing, a magnet near them, the Vacuum Beam's column, or the Black Hole's whole board. */
export type CatchPull = 'none' | 'magnet' | 'vacuum' | 'hole';

/** Catch (SPEC 9): zeros fall and bounce, and cups at the bottom catch them. Per-zero arrays are indexed like `zeros`. */
export interface CatchState {
  mode: 'catch';
  /** The middle of the cups, and where the finger wants it: the board's middle until it's touched. */
  cupX: number;
  targetX: number;
  /** A cup's half-width for this round's zeros, before the power-up widens it. */
  baseHalf: number;
  /** This frame's catchers, from the power-up: how many cups, each one's half-width, the space between their middles, and what pulls zeros in. */
  cups: number;
  half: number;
  gap: number;
  pull: CatchPull;
  /** The Vacuum Beam is drawing zeros down: the finger is on the board. */
  pulling: boolean;
  /** How slowly each zero flies: about 1, armored zeros slower. Its gravity is divided by the square, so it flies the same arcs in slow motion. */
  pace: number[];
}

/**
 * Orbit (SPEC 9): the turret sits in the middle and zeros circle it, each on its own oval track.
 * Per-zero arrays are indexed like `zeros`, spare slots for split pieces included.
 */
export interface OrbitState {
  mode: 'orbit';
  /** Where each zero is around its track (radians), and how fast it goes round (radians a second, either way). */
  angle: number[];
  spin: number[];
  /** Each zero's track: its size as a share of its reach, and its reach across and down from the middle. */
  track: number[];
  reachX: number[];
  reachY: number[];
  /** The first slot past the round's own zeros, kept free for the pieces armored zeros split into. */
  spareFrom: number;
  /** Where the pieces' badges start in the atlas, and the piece values they show, in that order. */
  badgeBase: number;
  pieceValues: number[];
}

/** A point on Slice's blade: where the finger passed, how long ago, and which stroke it belongs to. */
export interface TrailPoint {
  x: number;
  y: number;
  age: number;
  stroke: number;
}

/**
 * Slice (SPEC 9): zeros are tossed up from the bottom edge and the finger's swipe cuts them.
 * Per-zero arrays are indexed like `zeros`.
 */
export interface SliceState {
  mode: 'slice';
  /** The blade's recent path, a fixed ring of points: `count` of them, the newest at `head`. */
  trail: TrailPoint[];
  head: number;
  count: number;
  /** Which stroke the finger is on: a new one each touch-down, so strokes don't join up. */
  stroke: number;
  /** Where the blade last was: each move cuts from here, however long the finger rested. */
  lastX: number;
  lastY: number;
  /** How far the finger has swept since the last swish. */
  swing: number;
  /** Seconds before the next toss may go, and where the queue looks next. */
  tossIn: number;
  cursor: number;
  /** This frame's blade, from the power-up: how many blades, how far past a zero's edge they reach, and how long the trail keeps cutting. */
  blades: number;
  reach: number;
  linger: number;
  /** Late in the round: tosses float and the blade reaches further. */
  assist: boolean;
  /** Whether each zero is in the air, rather than waiting on the bottom edge for its toss. */
  launched: boolean[];
  /** Times each zero has been cut: each cut juggles it higher. */
  cuts: number[];
}

/** One of Breaker's balls. */
export interface Ball {
  /** In play: flying, or held on the paddle. */
  live: boolean;
  /** Sitting on the paddle, waiting to serve. */
  held: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Seconds before a held ball serves itself. */
  serve: number;
  /** Its speed: the board's, up a little with each paddle hit until it drops. */
  speed: number;
  /** Times it has come back to the paddle without touching a brick. */
  returns: number;
}

/** How Breaker's balls look, by power-up. */
export type BallLook = 'plain' | 'fire' | 'lightning' | 'mega';

/** Breaker (SPEC 9): the zeros are bricks, and balls off a paddle break them. */
export interface BreakerState {
  mode: 'breaker';
  /** The paddle's middle and half-width, and where the finger wants it: the board's middle until it's touched. */
  paddleX: number;
  targetX: number;
  half: number;
  /** A fixed set of balls; `balls` of them in play for this power-up. */
  ball: Ball[];
  balls: number;
  /** This frame's balls, from the power-up: their radius and look, and whether they burn through bricks they break. */
  radius: number;
  look: BallLook;
  pierce: boolean;
  /** The paddle fires the Rail Laser while the finger is down. */
  laser: boolean;
  /** The board's ball speed, in points a second. */
  speed: number;
  /** Late in the round: balls head for the bricks. */
  assist: boolean;
}

/** What the round's mode keeps beyond the shared fields. Each mode adds its own. */
export type ModeState = ShooterState | CatchState | OrbitState | SliceState | BreakerState;

/** What the screen hands the sim to start a round. Computed on the JS thread. */
export interface GameConfig {
  /** Zero value in the round: the day's streak. */
  n: number;
  /** composeRound(n).groups */
  groups: readonly ZeroGroup[];
  /** fillPlan(n): glyphs in the celebration fill, and whether the full number goes on top. */
  fill: FillPlan;
  width: number;
  height: number;
  insetTop: number;
  insetBottom: number;
  weapon: WeaponDef;
  seed: number;
  reduceMotion: boolean;
  /** The game mode. Unset, or a mode whose round isn't built, plays the Shooter. */
  mode?: ModeId;
  /** Auto-fire (Settings › Accessibility): after the first touch, firing keeps going. Off when unset. */
  autoFire?: boolean;
}

/** What happened since the last report, sent to the JS thread at most once a frame. */
export interface Report {
  /** The round it's about: a replay starts a new seed, so late reports from the old one can be ignored. */
  seed: number;
  dirty: boolean;
  valueLeft: number;
  shots: number;
  hits: number;
  kills: number;
  armoredKills: number;
  blasts: number;
  bombs: number;
  /** Catches, and balls off the paddle and bricks: a game mode's bounce sound. */
  bounces: number;
  /** Swings of Slice's blade. */
  swishes: number;
  /** The last zero went this frame. */
  final: boolean;
  /** The fill has landed: show the result sheet. */
  showResult: boolean;
}

export interface GameState {
  /** The game mode this round plays: always one whose round is built (engine PLAYABLE_MODES). */
  mode: ModeId;
  modeState: ModeState;
  n: number;
  seed: number;
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
  /** Seconds since the phase began. The fill and done phases share one clock, from the fill's start. */
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
  /** Fill glyph height, in points. */
  glyphSize: number;
  /** Too many zeros to draw: the full number goes on top of the fill. */
  overlayNumber: boolean;
  /** Seconds from the fill's start until its last glyph lands. */
  fillLen: number;

  weapon: WeaponDef;
  pointer: Pointer;
  /** Aim angle from the muzzle, radians; straight up is -π/2. */
  aim: number;
  firing: boolean;
  /** Auto-fire: lifting the finger doesn't stop firing, so touches only aim. */
  autoFire: boolean;
  /** Seconds since the last shot. */
  sinceShot: number;
  /** Seconds since a zero last took damage, so a mode can help with the last few. */
  sinceDamage: number;

  shake: number;
  /** This frame's shake offset, drawn from the seeded generator. */
  shakeX: number;
  shakeY: number;
  flash: number;
  /** Seconds since a full-screen flash started; flashes within one frame merge. */
  sinceFlash: number;
  muzzle: number;

  rng: Rng;
  report: Report;
}
