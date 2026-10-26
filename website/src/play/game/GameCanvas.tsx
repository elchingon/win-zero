// The shooting round's canvas on the web. The shared sim (src/game/sim) and drawing
// (src/game/draw) run in a requestAnimationFrame loop: each frame steps the round, draws it
// through the Canvas 2D stand-in for Skia, and hands a copy of the frame's report to the screen.
// Pointer input goes straight to the sim. The play area's size is fixed when the round starts;
// if the window changes size, the canvas scales to fit rather than restarting the round.
import {
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type Ref,
} from 'react';

import type { FillPlan, WeaponDef, ZeroGroup } from '@/engine';
import { drawScene, makeScratch } from '@/game/draw/scene';
import { dropBomb } from '@/game/sim/bomb';
import { finishAll } from '@/game/sim/finish';
import { moveAim, pressFire, releaseFire, setReduceMotion, setWeapon } from '@/game/sim/input';
import { resetReport } from '@/game/sim/report';
import { createGame } from '@/game/sim/spawn';
import { step } from '@/game/sim/step';
import type { GameState, Report } from '@/game/sim/types';

import { bakeRound, DISPLAY_FONT, type BakedRound } from './bake';
import { Canvas2D } from './skia/canvas';

/** The canvas is drawn at screen density, up to this. */
export const MAX_PIXEL_RATIO = 2;
/** When frames average slower than this over a second, the canvas steps down in resolution... */
const SLOW_FRAME_MS = 22;
/** ...by this much, to no lower than this. Sprites keep their baked detail; edges soften a little. */
const PIXEL_RATIO_STEP = 0.5;
const MIN_PIXEL_RATIO = 1;
/** Frames longer than this (a tab coming back from the background) don't count as slow. */
const STALL_MS = 250;
/** The frame meter reports this often, in seconds. */
const METER_WINDOW = 0.5;
/** Assumed for the first frame, which has no previous one. */
const FIRST_FRAME_MS = 1000 / 60;

export interface FrameStats {
  fps: number;
  /** The slowest frame in the window, in ms. */
  worstMs: number;
  /** The canvas's current pixels per point. */
  pixelRatio: number;
}

/** What identifies a round. The weapon and reduce motion can change mid-round. */
export interface RoundSetup {
  n: number;
  groups: readonly ZeroGroup[];
  fill: FillPlan;
  seed: number;
}

export interface GameHandle {
  /** Blast the middle of the play area. The screen has already paid for it. */
  dropBomb: () => void;
  /** Clear every zero left and end the round (Finish round). */
  finishAll: () => void;
}

interface Size {
  width: number;
  height: number;
}

/**
 * The safe-area insets (a phone's notch and home bar), read through CSS env(). The round starts
 * below the site bar, which sits over the notch, so only the bottom one reaches the play area.
 */
function safeArea(): { top: number; bottom: number } {
  const probe = document.createElement('div');
  probe.className = 'safe-area-probe';
  document.body.appendChild(probe);
  const style = getComputedStyle(probe);
  const insets = { top: 0, bottom: parseFloat(style.paddingBottom) || 0 };
  probe.remove();
  return insets;
}

/** Bungee draws the badges, fill glyphs and big number. A blocked font falls back after a wait. */
function fontReady(): Promise<unknown> {
  try {
    return document.fonts.load(`100px ${DISPLAY_FONT}`).catch(() => undefined);
  } catch {
    return Promise.resolve();
  }
}

export function GameCanvas(props: {
  round: RoundSetup;
  weapon: WeaponDef;
  reduceMotion: boolean;
  onReport: (report: Report) => void;
  /** Practice rounds: frame rate and the slowest frame, twice a second. */
  onFrameStats?: (stats: FrameStats) => void;
  ref?: Ref<GameHandle>;
}) {
  const { round, weapon, reduceMotion, onReport, onFrameStats, ref } = props;
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const state = useRef<GameState | null>(null);
  // The play area, measured when the screen opens.
  const [size, setSize] = useState<Size | null>(null);
  const [baked, setBaked] = useState<BakedRound | null>(null);
  // Fixed at the start of each round, without making either restart it when it changes.
  const live = useRef({ weapon, reduceMotion, onReport, onFrameStats });
  useEffect(() => {
    live.current = { weapon, reduceMotion, onReport, onFrameStats };
  }, [weapon, reduceMotion, onReport, onFrameStats]);

  useLayoutEffect(() => {
    const el = box.current;
    if (el) setSize({ width: el.clientWidth, height: el.clientHeight });
  }, []);

  // The sprite sheet, once Bungee is ready. Replays reuse it: it depends on the round's zeros
  // and the size, not on the seed.
  const { n, groups, fill, seed } = round;
  useEffect(() => {
    const ctx = canvas.current?.getContext('2d');
    if (!size || !ctx) return;
    let cancelled = false;
    void fontReady().then(() => {
      if (cancelled) return;
      const pixelRatio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
      setBaked(bakeRound({ ctx, n, groups, fill, width: size.width, height: size.height, pixelRatio }));
    });
    return () => {
      cancelled = true;
    };
  }, [size, n, groups, fill]);

  // A new round: start the sim and the frame loop.
  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext('2d');
    if (!size || !baked || !el || !ctx) return;
    let pixelRatio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
    const resize = () => {
      el.width = Math.round(size.width * pixelRatio);
      el.height = Math.round(size.height * pixelRatio);
    };
    resize();
    const insets = safeArea();
    const s = createGame({
      n,
      groups,
      fill,
      seed,
      width: size.width,
      height: size.height,
      insetTop: insets.top,
      insetBottom: insets.bottom,
      weapon: live.current.weapon,
      reduceMotion: live.current.reduceMotion,
    });
    state.current = s;
    const painter = new Canvas2D(ctx, baked.tints);
    const scratch = makeScratch();
    let frame = 0;
    let last = 0;
    // A second of frame times, to notice a device that can't keep up.
    const pace = { t: 0, frames: 0, windows: 0 };

    const tick = (t: number) => {
      const dtMs = last ? t - last : FIRST_FRAME_MS;
      last = t;
      if (dtMs < STALL_MS) {
        pace.t += dtMs;
        pace.frames++;
        if (pace.t >= 1000) {
          // The first second includes the round's setup; judge from the second on.
          if (pace.windows++ > 0 && pace.t / pace.frames > SLOW_FRAME_MS && pixelRatio > MIN_PIXEL_RATIO) {
            pixelRatio = Math.max(MIN_PIXEL_RATIO, pixelRatio - PIXEL_RATIO_STEP);
            resize();
          }
          pace.t = 0;
          pace.frames = 0;
        }
      }
      step(s, dtMs / 1000);
      ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      drawScene(painter, s, baked.kit, baked.atlas, scratch);
      if (s.report.dirty) {
        live.current.onReport({ ...s.report }); // a copy, so it can be reset straight after
        resetReport(s.report);
      }
      const meterOut = live.current.onFrameStats;
      if (meterOut) {
        const m = scratch.meter;
        m.t += dtMs / 1000;
        m.frames++;
        if (dtMs > m.worst) m.worst = dtMs;
        if (m.t >= METER_WINDOW) {
          meterOut({ fps: m.frames / m.t, worstMs: m.worst, pixelRatio });
          m.t = 0;
          m.frames = 0;
          m.worst = 0;
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      if (state.current === s) state.current = null;
    };
  }, [size, baked, n, groups, fill, seed]);

  useEffect(() => {
    if (state.current) setWeapon(state.current, weapon);
  }, [weapon]);

  useEffect(() => {
    if (state.current) setReduceMotion(state.current, reduceMotion);
  }, [reduceMotion]);

  useImperativeHandle(
    ref,
    () => ({
      dropBomb: () => {
        if (state.current) dropBomb(state.current);
      },
      finishAll: () => {
        if (state.current) finishAll(state.current);
      },
    }),
    [],
  );

  // Keep the round's shape when the window changes: scale the canvas to fit, centered.
  const [fit, setFit] = useState(1);
  useEffect(() => {
    if (!size) return;
    const el = box.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      setFit(Math.min(el.clientWidth / size.width, el.clientHeight / size.height));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [size]);

  /** A pointer's position in the play area's points. */
  const toPoints = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const w = size?.width ?? rect.width;
    const h = size?.height ?? rect.height;
    return { x: ((e.clientX - rect.left) * w) / rect.width, y: ((e.clientY - rect.top) * h) / rect.height };
  };

  // Let go of the trigger if the window loses focus mid-press.
  useEffect(() => {
    const release = () => {
      if (state.current) releaseFire(state.current);
    };
    window.addEventListener('blur', release);
    return () => window.removeEventListener('blur', release);
  }, []);

  return (
    <div ref={box} className="game">
      <canvas
        ref={canvas}
        className="game-canvas"
        style={size ? { width: size.width * fit, height: size.height * fit } : undefined}
        aria-label="Play area. The round is visual; Finish round clears it."
        role="img"
        onPointerDown={(e) => {
          if (!e.isPrimary || !state.current) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          const p = toPoints(e);
          pressFire(state.current, p.x, p.y);
        }}
        onPointerMove={(e) => {
          if (!e.isPrimary || !state.current) return;
          const p = toPoints(e);
          moveAim(state.current, p.x, p.y);
        }}
        onPointerUp={(e) => {
          if (e.isPrimary && state.current) releaseFire(state.current);
        }}
        onPointerCancel={() => {
          if (state.current) releaseFire(state.current);
        }}
        onLostPointerCapture={() => {
          if (state.current) releaseFire(state.current);
        }}
        onContextMenu={(e) => e.preventDefault()}
      />
    </div>
  );
}
