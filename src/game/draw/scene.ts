'worklet';
// Drawing one frame of the round, as in the prototype's draw(). Sprites come from the baked
// sheet a whole layer per drawAtlas call; nothing here allocates Skia objects.
import type { SkCanvas, SkImage, SkRect } from '@shopify/react-native-skia';

import { MAX_BULLETS, MAX_GLYPHS, MAX_PARTICLES, MAX_ZEROS } from '../sim/constants';
import type { GameState } from '../sim/types';

import { makeBatch } from './batch';
import { drawFill } from './fill';
import { drawBeams, drawBolts, drawBullets, drawParticles, drawRings } from './fx';
import { drawCatch } from './modes/catch';
import { drawOrbit } from './modes/orbit';
import { drawTurret } from './turret';
import type { Kit, Scratch } from './types';
import { paintColor, rect } from './util';
import { drawEnergyBars, drawHitFlashes, drawZeros } from './zeros';

// The bake sizes the turret's base from these.
export { TURRET_BASE_DROP, TURRET_BASE_RADIUS, TURRET_BASE_STROKE } from './turret';

/** The white flash never fully whites out the screen. */
const FLASH_MAX = 0.85;
const FLASH_MIN = 0.02;
/** Every zero a round can hold, and a badge for each. */
const ZERO_BATCH = MAX_ZEROS;

export function makeScratch(): Scratch {
  return {
    zeros: makeBatch(ZERO_BATCH * 2),
    flashes: makeBatch(ZERO_BATCH, true),
    glyphs: makeBatch(MAX_GLYPHS, true),
    bullets: makeBatch(MAX_BULLETS),
    particles: makeBatch(MAX_PARTICLES, true),
    rect: { x: 0, y: 0, width: 0, height: 0 } as SkRect,
    rgba: [0, 0, 0, 1],
    meter: { t: 0, frames: 0, worst: 0 },
  };
}

/** Draw the round as it stands. `atlas` is null until the sprite sheet reaches the GPU. */
export function drawScene(canvas: SkCanvas, s: GameState, kit: Kit, atlas: SkImage | null, sc: Scratch): void {
  canvas.drawPicture(kit.background);
  canvas.save();
  canvas.translate(s.shakeX, s.shakeY);
  if (s.phase === 'fill' || s.phase === 'done') {
    drawFill(canvas, s, kit, atlas, sc);
  } else if (atlas) {
    drawZeros(canvas, s, kit, atlas, sc);
    drawHitFlashes(canvas, s, kit, atlas, sc);
  }
  drawEnergyBars(canvas, s, kit, sc);
  drawBeams(canvas, s, kit, sc);
  drawBolts(canvas, s, kit, sc);
  if (atlas) drawBullets(canvas, s, kit, atlas, sc);
  drawRings(canvas, s, kit, sc);
  if (atlas) drawParticles(canvas, s, kit, atlas, sc);
  if (s.phase === 'play' || s.phase === 'celebrate') {
    // What the player plays with, by mode.
    switch (s.mode) {
      case 'catch':
        drawCatch(canvas, s, kit, sc);
        break;
      case 'orbit':
        drawOrbit(canvas, s, kit, sc);
        break;
      case 'shooter':
      default:
        drawTurret(canvas, s, kit, sc);
    }
  }
  canvas.restore();
  if (s.flash > FLASH_MIN) {
    paintColor(kit.paints.fill, sc, kit.colors.fg, Math.min(FLASH_MAX, s.flash * FLASH_MAX));
    canvas.drawRect(rect(sc, 0, 0, kit.width, kit.height), kit.paints.fill);
  }
}
