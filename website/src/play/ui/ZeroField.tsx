// The slow field of drifting zeros behind every screen, like the app's ZeroField and the
// prototype's attract mode. The glow, dot grid and wash are CSS (app.css); this draws the faint
// zeros on a canvas between them. Still under reduce motion; hidden behind the round.
import { useEffect, useRef } from 'react';

import {
  FIELD_ALPHA,
  FIELD_DRIFT_SPEED,
  FIELD_MAX_STEP_S,
  FIELD_SIZE_AS_IF,
  FIELD_SIZE_JITTER,
  FIELD_ZEROS,
} from '@/game/look';
import { ZERO_ASPECT } from '@/game/sim/sizing';
import { zeroRadius } from '@/game/sim/sizing';
import { colors, zeroPalette } from '@/theme/tokens';

import { drawRing, ringReach } from '../game/ring';
import { useReduceMotion } from '../platform/motion';

/** The canvas is drawn at screen density, up to this. */
const MAX_DPR = 2;

interface Drift {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rx: number;
  ry: number;
  sprite: HTMLCanvasElement;
}

function ringSprite(ry: number, color: string, dpr: number): HTMLCanvasElement {
  const reach = ringReach(ry);
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil((ry * ZERO_ASPECT + reach) * 2 * dpr);
  canvas.height = Math.ceil((ry + reach) * 2 * dpr);
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.scale(dpr, dpr);
    drawRing(ctx, canvas.width / dpr / 2, canvas.height / dpr / 2, ry, color);
  }
  return canvas;
}

function seed(width: number, height: number, dpr: number): Drift[] {
  const base = zeroRadius(FIELD_SIZE_AS_IF, width, height);
  return Array.from({ length: FIELD_ZEROS }, (_, i) => {
    const ry = base * (1 - FIELD_SIZE_JITTER / 2 + Math.random() * FIELD_SIZE_JITTER);
    const rx = ry * ZERO_ASPECT;
    const speed = FIELD_DRIFT_SPEED * (0.7 + Math.random() * 0.6) * (1 + (40 / Math.max(ry, 10)) * 0.12);
    const angle = Math.random() * Math.PI * 2;
    return {
      x: rx + Math.random() * Math.max(1, width - 2 * rx),
      y: ry + Math.random() * Math.max(1, height - 2 * ry),
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      rx,
      ry,
      sprite: ringSprite(ry, zeroPalette[i % zeroPalette.length] ?? colors.amber, dpr),
    };
  });
}

function move(z: Drift, dt: number, width: number, height: number): void {
  z.x += z.vx * dt;
  z.y += z.vy * dt;
  if (z.x < z.rx) {
    z.x = z.rx;
    z.vx = Math.abs(z.vx);
  } else if (z.x > width - z.rx) {
    z.x = width - z.rx;
    z.vx = -Math.abs(z.vx);
  }
  if (z.y < z.ry) {
    z.y = z.ry;
    z.vy = Math.abs(z.vy);
  } else if (z.y > height - z.ry) {
    z.y = height - z.ry;
    z.vy = -Math.abs(z.vy);
  }
}

export function ZeroField({ hidden }: { hidden: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const reduceMotion = useReduceMotion();

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || hidden) return;
    let width = 0;
    let height = 0;
    let dpr = 1;
    let zeros: Drift[] = [];
    let frame = 0;
    let last = 0;

    const draw = () => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      ctx.globalAlpha = FIELD_ALPHA;
      for (const z of zeros) {
        const w = z.sprite.width / dpr;
        const h = z.sprite.height / dpr;
        ctx.drawImage(z.sprite, z.x - w / 2, z.y - h / 2, w, h);
      }
    };

    const size = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      zeros = seed(width, height, dpr);
      draw();
    };

    const tick = (t: number) => {
      const dt = last ? Math.min(FIELD_MAX_STEP_S, (t - last) / 1000) : 0;
      last = t;
      for (const z of zeros) move(z, dt, width, height);
      draw();
      frame = requestAnimationFrame(tick);
    };

    size();
    window.addEventListener('resize', size);
    if (!reduceMotion) frame = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener('resize', size);
      cancelAnimationFrame(frame);
    };
  }, [hidden, reduceMotion]);

  return (
    <div className="zero-field" aria-hidden="true" hidden={hidden}>
      <canvas ref={ref} />
    </div>
  );
}
