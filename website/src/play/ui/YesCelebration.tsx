// The celebration for a Yes (src/game/yes.ts), drawn as the app draws it: over every screen, so it
// carries on while the round opens beneath it. The zero pops out of the button with a burst of
// mini zeros, dark floods out from it, and its hole opens onto the round. The chime plays as it
// starts, and only that under reduced motion. Idle, it isn't there at all.
import { useEffect, useRef, useSyncExternalStore } from 'react';

import { HIGHLIGHT_ALPHA, HIGHLIGHT_INSET, HIGHLIGHT_START, HIGHLIGHT_SWEEP, HIGHLIGHT_WIDTH, ZERO_GLOW } from '@/game/look';
import { ZERO_ASPECT, ZERO_STROKE } from '@/game/sim/sizing';
import { YES_SPARKS, YES_TOTAL_MS, yesFrame, yesOrigin, yesSpark, type Point, type Size, type YesFrame, type YesShow } from '@/game/yes';
import { colors, zeroPalette } from '@/theme/tokens';

import { yesCelebration } from '../celebrate';
import { shadowBlurFor } from '../game/ring';
import { loadSounds, playSound, resumeAudio } from '../platform/audio';
import { prefersReducedMotion } from '../platform/motion';
import { appStore } from '../store';

/** The canvas is drawn at screen density, up to this. */
const MAX_DPR = 2;
/** The zero's glow (a blur sigma), capped so a ring the size of the screen stays cheap. */
const RING_GLOW_MAX = 10;
/** The bright line on the dark's outer edge. */
const RIM_WIDTH = 3;
const RIM_GLOW = 6;
const DEG = Math.PI / 180;

export function YesCelebration() {
  useEffect(
    () =>
      yesCelebration.mount({
        motion: () => !prefersReducedMotion(),
        cue: () => {
          if (!appStore.getState().prefs.sound) return;
          void Promise.all([loadSounds(), resumeAudio()]).then(() => playSound('yes'));
        },
      }),
    [],
  );
  const show = useSyncExternalStore(yesCelebration.subscribe, yesCelebration.current, () => null);
  return show ? <Show key={show.id} show={show} /> : null;
}

function Show({ show }: { show: YesShow }) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext('2d');
    if (!el || !ctx) {
      yesCelebration.end(show.id);
      return;
    }
    const size = { width: window.innerWidth, height: window.innerHeight };
    const dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);
    el.width = Math.round(size.width * dpr);
    el.height = Math.round(size.height * dpr);
    ctx.scale(dpr, dpr);
    const origin = yesOrigin(show.origin, size);
    let start: number | null = null;
    let frame = 0;
    const draw = (now: number) => {
      start ??= now;
      const t = now - start;
      if (t >= YES_TOTAL_MS) {
        yesCelebration.end(show.id);
        return;
      }
      paint(ctx, yesFrame(t, origin, size), t, origin, size);
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [show]);

  // It takes clicks while it plays; screen readers skip it.
  return <canvas ref={canvas} className="yes-celebration" aria-hidden="true" />;
}

/** Adds a zero-shaped oval of vertical radius `ry` centered at (x, y) as its own subpath. */
function addZeroOval(ctx: CanvasRenderingContext2D, x: number, y: number, ry: number): void {
  const rx = ry * ZERO_ASPECT;
  ctx.moveTo(x + rx, y);
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
}

function glow(ctx: CanvasRenderingContext2D, sigma: number, color: string): void {
  ctx.shadowBlur = shadowBlurFor(sigma);
  ctx.shadowColor = color;
}

function paint(ctx: CanvasRenderingContext2D, f: YesFrame, t: number, origin: Point, size: Size): void {
  const amber = zeroPalette[0];
  ctx.clearRect(0, 0, size.width, size.height);
  ctx.save();
  // The dark: between the hole and its outer edge.
  if (f.coverAlpha > 0) {
    ctx.beginPath();
    addZeroOval(ctx, f.x, f.y, f.cover);
    addZeroOval(ctx, f.x, f.y, f.hole);
    ctx.fillStyle = colors.ink;
    ctx.fill('evenodd');
  }
  if (f.rimAlpha > 0) {
    ctx.globalAlpha = f.rimAlpha;
    glow(ctx, RIM_GLOW, amber);
    ctx.beginPath();
    addZeroOval(ctx, f.x, f.y, f.cover);
    ctx.lineWidth = RIM_WIDTH;
    ctx.strokeStyle = amber;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  ctx.shadowBlur = 0;
  // The mini zeros, in the zeros' palette.
  for (let i = 0; i < YES_SPARKS; i++) {
    const s = yesSpark(i, t, origin);
    if (s.alpha <= 0) continue;
    ctx.globalAlpha = s.alpha;
    ctx.beginPath();
    addZeroOval(ctx, s.x, s.y, s.ry * (1 - ZERO_STROKE / 2));
    ctx.lineWidth = s.ry * ZERO_STROKE;
    ctx.strokeStyle = zeroPalette[i % zeroPalette.length] ?? amber;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  // The zero itself, round the hole, drawn like the round's zeros: a glowing ring with a highlight.
  if (f.ring > 0) {
    const ry = f.hole + f.ring;
    glow(ctx, Math.min(RING_GLOW_MAX, ry * ZERO_GLOW), amber);
    ctx.beginPath();
    addZeroOval(ctx, f.x, f.y, f.hole + f.ring / 2);
    ctx.lineWidth = f.ring;
    ctx.strokeStyle = amber;
    ctx.stroke();
    ctx.shadowBlur = 0;
    const hx = Math.max(1, ry * ZERO_ASPECT - f.ring * HIGHLIGHT_INSET);
    const hy = Math.max(1, ry - f.ring * HIGHLIGHT_INSET);
    ctx.beginPath();
    ctx.ellipse(f.x, f.y, hx, hy, 0, HIGHLIGHT_START * DEG, (HIGHLIGHT_START + HIGHLIGHT_SWEEP) * DEG);
    ctx.globalAlpha = HIGHLIGHT_ALPHA;
    ctx.lineWidth = Math.max(1, f.ring * HIGHLIGHT_WIDTH);
    ctx.lineCap = 'round';
    ctx.strokeStyle = colors.fg;
    ctx.stroke();
  }
  ctx.restore();
}
