// The celebration for a Yes, as numbers: a zero pops out of the button with a burst of mini zeros,
// dark floods out from it over Home, then its hole opens past the screen's corners onto the round,
// as if flying through the zero. Pure arithmetic (worklets, for the app's UI thread), so the app's
// Skia overlay and the website's canvas draw the same thing. Also the small controller both use:
// a Yes tap arms it, and Home asks it how long to hold the round back while the show plays.
import { ZERO_ASPECT, ZERO_STROKE } from './sim/sizing';

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

/** The zero pops out of the button. */
export const YES_POP_MS = 240;
/** Dark floods out from it until the screen is covered, and the round opens underneath. */
export const YES_FLOOD_MS = 300;
/** The hole opens past the corners, onto the round. */
export const YES_OPEN_MS = 360;
export const YES_TOTAL_MS = YES_POP_MS + YES_FLOOD_MS + YES_OPEN_MS;
/** When the round opens: the moment the screen is covered. */
export const YES_ROUTE_MS = YES_POP_MS + YES_FLOOD_MS;

/** The zero's vertical radius once popped, in points. */
export const YES_ZERO_RY = 34;
/** How far it floats up from the tap as it pops: clear of the button, which is amber like the zero. */
export const YES_RISE = 64;
/** How much its hole swells while the dark floods out. */
export const YES_HOLE_SWELL = 1.3;
/** The ring's thickness once the hole has opened past the corners. */
export const YES_OPEN_RING = 22;
/** The dark's edge and the open hole each end this far past the farthest corner. */
export const YES_COVER_MARGIN = 1.08;
export const YES_OPEN_MARGIN = 1.12;
/** With no tap point (a screen reader's double tap), the zero starts here, as fractions of the screen. */
export const YES_DEFAULT_AT = { x: 0.5, y: 0.62 };

/** The mini zeros that burst out of the tap: how many (a cap), how big, how far, how long. */
export const YES_SPARKS = 12;
export const YES_SPARK_RY = 8;
export const YES_SPARK_REACH = 96;
export const YES_SPARK_MS = 480;
/** Every other spark flies this much less far, and this far round, so the burst isn't a ring. */
export const YES_SPARK_SHORT = 0.7;
export const YES_SPARK_TWIST = 0.3;

/** One moment of the show. Ovals have the zeros' shape: horizontal radius = ZERO_ASPECT x vertical. */
export interface YesFrame {
  /** The zero's center (its hole's, and the dark's). */
  x: number;
  y: number;
  /** The hole's vertical radius: the zero's inside, where the screen beneath shows through. */
  hole: number;
  /** The zero's ring round the hole: its thickness. */
  ring: number;
  /** The dark's outer edge (vertical radius) and opacity; nothing before the flood. */
  cover: number;
  coverAlpha: number;
  /** The bright rim on the dark's outer edge, fading as it leaves the screen. */
  rimAlpha: number;
}

export interface YesSpark {
  x: number;
  y: number;
  ry: number;
  alpha: number;
}

const clamp01 = (v: number) => {
  'worklet';
  return v < 0 ? 0 : v > 1 ? 1 : v;
};
const easeOutCubic = (p: number) => {
  'worklet';
  return 1 - (1 - p) ** 3;
};
const easeInQuad = (p: number) => {
  'worklet';
  return p * p;
};
const easeInOutCubic = (p: number) => {
  'worklet';
  return p < 0.5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2;
};
/** Overshoots a little, then settles: the pop. */
const easeOutBack = (p: number) => {
  'worklet';
  const c1 = 1.70158;
  return 1 + (c1 + 1) * (p - 1) ** 3 + c1 * (p - 1) ** 2;
};

/** The vertical radius a zero-shaped oval centered at (x, y) needs to take in the whole screen. */
export function reachOf(x: number, y: number, size: Size): number {
  'worklet';
  const dx = Math.max(x, size.width - x) / ZERO_ASPECT;
  const dy = Math.max(y, size.height - y);
  return Math.sqrt(dx * dx + dy * dy);
}

/** Where the show starts: the tap, or low in the middle when there's none. */
export function yesOrigin(at: Point | null, size: Size): Point {
  'worklet';
  return at ?? { x: size.width * YES_DEFAULT_AT.x, y: size.height * YES_DEFAULT_AT.y };
}

/** The show `t` ms in, from `origin` on a screen of `size`. */
export function yesFrame(t: number, origin: Point, size: Size): YesFrame {
  'worklet';
  const hole0 = YES_ZERO_RY * (1 - ZERO_STROKE);
  const ring0 = YES_ZERO_RY * ZERO_STROKE;
  const top = { x: origin.x, y: origin.y - YES_RISE };
  if (t < YES_POP_MS) {
    const p = clamp01(t / YES_POP_MS);
    const s = Math.max(0, easeOutBack(p));
    return {
      x: origin.x,
      y: origin.y - YES_RISE * easeOutCubic(p),
      hole: hole0 * s,
      ring: ring0 * s,
      cover: 0,
      coverAlpha: 0,
      rimAlpha: 0,
    };
  }
  const center = { x: size.width / 2, y: size.height / 2 };
  const holeF = hole0 * YES_HOLE_SWELL;
  const ringF = ring0 * YES_HOLE_SWELL;
  if (t < YES_ROUTE_MS) {
    const f = clamp01((t - YES_POP_MS) / YES_FLOOD_MS);
    const m = easeInOutCubic(f);
    const x = top.x + (center.x - top.x) * m;
    const y = top.y + (center.y - top.y) * m;
    const swell = 1 + (YES_HOLE_SWELL - 1) * f;
    const hole = hole0 * swell;
    const ring = ring0 * swell;
    const from = hole + ring;
    // Reaching from where it set out covers the screen from anywhere on its way to the middle.
    const to = reachOf(top.x, top.y, size) * YES_COVER_MARGIN;
    return { x, y, hole, ring, cover: from + (to - from) * easeOutCubic(f), coverAlpha: 1, rimAlpha: 1 - f };
  }
  const g = clamp01((t - YES_ROUTE_MS) / YES_OPEN_MS);
  const e = easeInQuad(g);
  const reach = reachOf(center.x, center.y, size);
  const hole = holeF + (reach * YES_OPEN_MARGIN - holeF) * e;
  const ring = ringF + (YES_OPEN_RING - ringF) * e;
  return {
    x: center.x,
    y: center.y,
    hole,
    ring,
    cover: Math.max(reachOf(top.x, top.y, size) * YES_COVER_MARGIN, hole + ring),
    coverAlpha: 1,
    rimAlpha: 0,
  };
}

/** Mini zero `i` (of YES_SPARKS) `t` ms in, bursting from `origin`; gone (alpha 0) after YES_SPARK_MS. */
export function yesSpark(i: number, t: number, origin: Point): YesSpark {
  'worklet';
  const s = clamp01(t / YES_SPARK_MS);
  const odd = i % 2 === 1;
  const angle = (i / YES_SPARKS) * 2 * Math.PI + (odd ? YES_SPARK_TWIST : 0) - Math.PI / 2;
  const d = YES_ZERO_RY * 0.5 + YES_SPARK_REACH * (odd ? YES_SPARK_SHORT : 1) * easeOutCubic(s);
  return {
    x: origin.x + Math.cos(angle) * d,
    y: origin.y + Math.sin(angle) * d,
    ry: YES_SPARK_RY * (1 - 0.5 * s),
    alpha: t >= YES_SPARK_MS ? 0 : 1 - s * s,
  };
}

/** What draws the show: whether to move at all (not under reduced motion), and the chime and haptic. */
export interface YesStage {
  motion: () => boolean;
  cue: () => void;
}

/** A show playing: where it started (null: no tap point), and which one it is. */
export interface YesShow {
  origin: Point | null;
  id: number;
}

/**
 * The celebration's state, one per app. The Yes button runs its answer inside `armed(at, …)`; an
 * accepted Yes opens the round straight away (routing.ts), and Home asks `begin()` how long to
 * hold it. Only an armed tap with a stage mounted plays: a turned-down answer, a notification's
 * Yes and Play now don't.
 */
export function createYesCelebration() {
  let armed: Point | null | undefined;
  let stage: YesStage | null = null;
  let show: YesShow | null = null;
  let seq = 0;
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const l of listeners) l();
  };

  return {
    /** Runs `answer` as the Yes tapped at `at` (null: no tap point). */
    armed<T>(at: Point | null, answer: () => T): T {
      armed = at;
      try {
        return answer();
      } finally {
        armed = undefined;
      }
    },
    /** The round is about to open: start the show if a Yes tap armed it. Returns ms to hold the round back. */
    begin(): number {
      const at = armed;
      armed = undefined;
      if (at === undefined || !stage) return 0;
      stage.cue();
      if (!stage.motion()) return 0;
      show = { origin: at, id: ++seq };
      notify();
      return YES_ROUTE_MS;
    },
    /** Just the cue, the chime and its haptic, with no show: for good news away from a Yes. */
    cue() {
      stage?.cue();
    },
    /** The overlay that draws the show; returns the unmount. */
    mount(s: YesStage): () => void {
      stage = s;
      return () => {
        if (stage === s) stage = null;
      };
    },
    current: (): YesShow | null => show,
    /** Show `id` has finished. */
    end(id: number) {
      if (show?.id !== id) return;
      show = null;
      notify();
    },
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export type YesCelebration = ReturnType<typeof createYesCelebration>;
