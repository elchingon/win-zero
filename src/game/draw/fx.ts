'worklet';
// Shots and effects, drawn additively over the zeros like the prototype's 'lighter' passes.
import type { SkCanvas, SkImage, SkRSXform, SkRect } from '@shopify/react-native-skia';

import type { GameState } from '../sim/types';

import { beginBatch, endBatch, pushSprite } from './batch';
import type { Kit, Scratch } from './types';

/** Bullets: a baked streak per kind, turned to face where each one is going. */
export function drawBullets(canvas: SkCanvas, s: GameState, kit: Kit, atlas: SkImage, sc: Scratch): void {
  const batch = sc.bullets;
  const kinds = kit.sheet.bullets;
  beginBatch(batch);
  for (let i = 0; i < s.bullets.count; i++) {
    const b = s.bullets.items[i];
    if (!b) continue;
    const w = b.weapon;
    // Rockets and nukes are big flare bolts, the zapper's are teal, the rest amber.
    const sprite = w.splash ? kinds[2] : w.chain ? kinds[1] : kinds[0];
    if (!sprite) continue;
    pushSprite(batch, sprite, b.x, b.y, 1 / sprite.ry, Math.atan2(b.vy, b.vx));
  }
  endBatch(batch);
  if (batch.count === 0) return;
  canvas.drawAtlas(atlas, batch.srcs as unknown as SkRect[], batch.dsts as unknown as SkRSXform[], kit.paints.spriteAdd);
}
