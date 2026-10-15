'worklet';
// Tunable numbers for the shooting round, ported from the prototype (docs/prototype/win-zero.html).
// Distances are in points, times in seconds, speeds in points per second. Damage, HP, unlocks
// and the fire rate live in the engine (round.ts, weapons.ts); these are feel and budget.
import { FILL_GLYPH_CAP, FIRE_RATE_HZ } from '@/engine';

// --- Frame -------------------------------------------------------------------------------

/** Longest step the sim takes, so a hitch doesn't teleport anything. */
export const MAX_DT = 0.05;
/** Bullets move in steps no longer than this, so a fast one can't skip over a small zero. */
export const BULLET_SUBSTEP = 1 / 60;

// --- Layout --------------------------------------------------------------------------------

/** Space kept clear for the HUD above the play area, below the safe-area inset. */
export const HUD_TOP = 64;
/** Space kept clear for the turret and HUD buttons at the bottom, above the safe-area inset. */
export const HUD_BOTTOM = 112;
/** The muzzle pivot sits this far above the bottom of the safe area. */
export const TURRET_Y_FROM_BOTTOM = 46;

// --- Zeros ---------------------------------------------------------------------------------

/** Each zero's radius is the round's base radius times 1 ± half of this. */
export const SIZE_JITTER = 0.3;
export const SPEED_BASE = 110;
/** Busier rounds move faster: + this much per zero, up to SPEED_CROWD_MAX. */
export const SPEED_PER_ZERO = 0.5;
export const SPEED_CROWD_MAX = 120;
/** Each zero's speed is scaled by SPEED_JITTER_MIN + random × SPEED_JITTER_RANGE. */
export const SPEED_JITTER_MIN = 0.7;
export const SPEED_JITTER_RANGE = 0.6;
/** Small zeros get a speed boost: × (1 + SMALL_ZERO_BOOST × SMALL_ZERO_REF / radius). */
export const SMALL_ZERO_BOOST = 0.12;
export const SMALL_ZERO_REF = 40;
export const SPEED_MAX = 300;
/** Zeros pop in over the first moments of a round: a random delay up to this. */
export const SPAWN_DELAY_BASE = 0.2;
export const SPAWN_DELAY_PER_ZERO = 0.004;
export const SPAWN_DELAY_MAX = 0.8;
/** Length of the pop-in (easeBack) once a zero's delay is over. */
export const POP_IN = 0.35;
/** Armored zeros are drawn bigger and move slower than the round's standard zeros. */
export const ARMOR_SIZE_SCALE = 1.3;
export const ARMOR_SPEED_SCALE = 0.55;
/** A zero that survives a hit flashes, fading over this long. */
export const HIT_FLASH = 0.18;

// --- Shots ---------------------------------------------------------------------------------

export const BULLET_SPEED = 1500;
/** Rockets and nukes fly slower. */
export const BIG_BULLET_SPEED = 950;
/** Bullets leave this far out from the muzzle pivot. */
export const MUZZLE_OFFSET = 34;
/** Twin Barrel: the two bullets sit this far either side of the aim line. */
export const PARALLEL_OFFSET = 10;
/** Scatter Gun: pellets are this many radians apart, fanned around the aim. */
export const FAN_STEP = 0.11;
/** Bullets are dropped once this far off-screen. */
export const OFFSCREEN_MARGIN = 20;
/** A tap fires at once if at least this long has passed since the last shot. */
export const MIN_TAP_INTERVAL = 0.08;
/** Holding the trigger fires this often. */
export const FIRE_INTERVAL = 1 / FIRE_RATE_HZ;
/** Slack for comparing summed frame times, so ten 1/60 s frames count as 1/6 s. */
export const TIME_EPSILON = 1e-6;
/** Hit test: the zero's ellipse, with small zeros padded up to these radii, plus HIT_PAD. */
export const HIT_MIN_RX = 12;
export const HIT_MIN_RY = 14;
export const HIT_PAD = 6;
/** Splash reaches a zero when its center is within R + ry × this. */
export const SPLASH_MARGIN = 0.6;
/** A bomb reaches a zero when its center is within R + ry × this. */
export const BOMB_MARGIN = 1;
/** A bomb's two shockwaves: radius start (points) and reach (× the bomb radius), seconds, width. */
export const BOMB_RING_OUTER = { start: 10, reach: 1.2, duration: 0.7, width: 30 };
export const BOMB_RING_INNER = { start: 5, reach: 1, duration: 0.9, width: 18 };
/** A splash's shockwave (the prototype's blast ring): starting radius and width, in points, and seconds. */
export const BLAST_RING = { start: 10, duration: 0.45, width: 10 };
/** Rail Laser: beam length as a multiple of the screen diagonal. */
export const BEAM_LENGTH = 1.3;
/** Rail Laser: a zero is on the line when its center is within max(ry, this). */
export const BEAM_MIN_REACH = 14;

// --- Effects -------------------------------------------------------------------------------

export const MAX_BULLETS = 96;
export const MAX_PARTICLES = 600;
export const MAX_RINGS = 48;
export const MAX_BEAMS = 4;
export const MAX_BOLTS = 12;
/** Points in a lightning bolt, ends included. */
export const BOLT_POINTS = 8;
/** Inner bolt points wander up to this far either side of the straight line. */
export const BOLT_JITTER = 11;
export const BOLT_DURATION = 0.3;
export const BEAM_DURATION = 0.28;

/** Palette slots (tokens.zeroPalette), for effects that aren't a zero's own color. */
export const AMBER = 0;
export const FLARE = 1;
export const TEAL = 2;
export const FG = 3;
export const PALETTE_SIZE = 4;

/** Sparks per kill, fewer when the screen is crowded. */
export const KILL_SPARKS = 22;
export const KILL_SPARKS_BUSY = 10;
/** Object count above which a round counts as crowded. */
export const BUSY_OBJECTS = 40;
/** Little spinning "0" fragments per kill. */
export const KILL_FRAGMENTS = 4;
export const KILL_FRAGMENTS_BUSY = 2;
/** Armored kills throw this many times the sparks, and a bigger shockwave. */
export const ARMOR_BURST_SCALE = 2;
/** Sparks thrown by a hit that doesn't kill. */
export const HIT_SPARKS = 6;
/** Confetti and fragment rings in the final-zero celebration. */
export const CONFETTI = 240;
export const CONFETTI_RINGS = 22;
/**
 * Kills stop throwing particles once this many are live, so even a bomb through a full board
 * leaves room in the pool for all of the final zero's confetti.
 */
export const KILL_PARTICLE_CAP = MAX_PARTICLES - CONFETTI - CONFETTI_RINGS;

/** A kill's sparks: speed and size grow with the zero (size / SCALE_REF, at least SCALE_MIN). */
export const SPARK = {
  speedMin: 120,
  speedRange: 360,
  lifeMin: 0.5,
  lifeRange: 0.6,
  sizeMin: 2,
  sizeRange: 3.5,
  scaleRef: 40,
  scaleMin: 0.6,
};
/** A kill's fragments: small "0" rings that tumble and fall. Size is a fraction of the zero's ry. */
export const FRAGMENT = {
  speedMin: 80,
  speedRange: 220,
  lift: 60,
  lifeMin: 0.9,
  lifeRange: 0.5,
  size: 0.32,
  spin: 10,
  gravity: 420,
};
/** A kill's shockwave, in multiples of the zero's ry. */
export const KILL_RING = { start: 0.4, reach: 2.6, duration: 0.4, width: 0.18, minWidth: 2 };
/** Shake per kill: base + ry × perRy, up to SHAKE_KILL_MAX. */
export const SHAKE_KILL_BASE = 2;
export const SHAKE_KILL_PER_RY = 0.06;

export const SHAKE_DECAY = 0.86;
export const FLASH_DECAY = 0.9;
export const MUZZLE_DECAY = 0.7;
export const PARTICLE_DRAG = 0.96;
export const CONFETTI_DRAG = 0.985;
/** Below this, the shake is too small to see and the screen holds still. */
export const SHAKE_MIN = 0.3;
export const SHAKE_KILL_MAX = 7;
export const SHAKE_BLAST = 8;
export const SHAKE_BOMB = 16;
export const SHAKE_FINAL = 24;
export const FLASH_BOMB = 0.6;
export const FLASH_FINAL = 1;
/** Reduce motion: shake is scaled by this, and particle counts by REDUCED_PARTICLES. */
export const REDUCED_SHAKE = 0.17;
export const REDUCED_PARTICLES = 0.5;

// --- Celebration and fill ------------------------------------------------------------------

/** Most glyphs a fill draws (the engine's cap). */
export const MAX_GLYPHS = FILL_GLYPH_CAP;
/** The fill starts this long after the last zero goes. */
export const FILL_DELAY = 0.85;
/** Fill glyphs ripple out from the center over up to FILL_SPREAD_MAX seconds. */
export const FILL_SPREAD_PER_GLYPH = 0.15;
export const FILL_SPREAD_MAX = 1.4;
/** Each fill glyph pops in over this long. */
export const FILL_POP = 0.5;
/** The result sheet shows this long after the last glyph has landed. */
export const RESULT_DELAY = 0.9;
/** Glyph height as a fraction of its grid cell's height, and cell width per glyph height. */
export const GLYPH_CELL_FILL = 0.86;
export const GLYPH_ASPECT = 0.82;
/** Chance per 1/60 s of a sparkle rising off a fill glyph. */
export const FILL_SPARKLE_CHANCE = 0.5;
/** Fill sparkles stop once this many particles are live. */
export const FILL_SPARKLE_CAP = 200;
/** A fill sparkle: where it starts (fraction of the glyph's size from its center), drift, rise, life, size. */
export const FILL_SPARKLE = {
  spreadX: 0.6,
  spreadY: 0.8,
  drift: 30,
  riseMin: 40,
  riseRange: 60,
  life: 0.8,
  sizeMin: 2,
  sizeRange: 3,
};

/** The final zero's three shockwaves: start radius (points), reach (× screen diagonal), seconds, width. */
export const FINAL_RINGS = [
  { start: 20, reach: 1, duration: 0.9, color: AMBER, width: 40 },
  { start: 10, reach: 0.7, duration: 1.1, color: FLARE, width: 24 },
  { start: 5, reach: 0.45, duration: 1.3, color: TEAL, width: 14 },
];
/**
 * Ordinary shockwaves stop here, so a bomb through a full board still leaves room in the pool
 * for the final zero's three.
 */
export const RING_CAP = MAX_RINGS - FINAL_RINGS.length;
/** Celebration confetti strips: speed, lift, life and size ranges, spin, fall. */
export const CONFETTI_PIECE = {
  speedMin: 250,
  speedRange: 900,
  lift: 200,
  lifeMin: 1.4,
  lifeRange: 1.2,
  sizeMin: 5,
  sizeRange: 7,
  spin: 14,
  gravity: 520,
};
/** Celebration fragment rings: big tumbling "0"s. */
export const CONFETTI_FRAGMENT = {
  speedMin: 200,
  speedRange: 600,
  lift: 150,
  lifeMin: 1.6,
  lifeRange: 1,
  sizeMin: 10,
  sizeRange: 16,
  spin: 8,
  gravity: 380,
};
