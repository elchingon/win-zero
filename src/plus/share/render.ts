// The share card as a PNG (SPEC 9), drawn on the JS thread with Skia: the round's sprite sheet
// baked at the card's own density, the celebration fill landed and still, and the panel's words.
// It's the round's own bake and drawing code, so the card looks like the end of the round, in the
// round's theme.
import { ImageFormat, Skia, TileMode, vec, type SkFont } from '@shopify/react-native-skia';

import { composeRound, fillPlan, weaponById } from '@/engine';
import { bakeSprites, makeKit } from '@/game/bake/kit';
import { drawFill } from '@/game/draw/fill';
import { makeScratch } from '@/game/draw/scene';
import { buildGame } from '@/game/sim/spawn';
import type { ThemeLook } from '@/theme/themes';
import { colors, withAlpha } from '@/theme/tokens';

import { CARD, cardLayout, type CardColor, type CardFont } from './layout';
import type { CardWords } from './words';

/** The fill fades into the panel over this many points. */
const FADE = 36;
const COLORS: Readonly<Record<CardColor, string>> = { amber: colors.amber, fg: colors.fg, muted: colors.muted };

/** The card's three faces, loaded at any size: Bungee, Barlow and JetBrains Mono. */
export type CardFonts = Readonly<Record<CardFont, SkFont>>;

/** The card for a Day `n` round in `look`, as PNG bytes, or null when Skia can't make a surface. */
export function renderCard(n: number, look: ThemeLook, fonts: CardFonts, words: CardWords): Uint8Array | null {
  const { width, height, scale, fill: fillHeight } = CARD;
  const groups = composeRound(n).groups;
  const fill = fillPlan(n);
  const baked = bakeSprites({ groups, fill, width, height: fillHeight, font: fonts.display, look, pixelRatio: scale });
  const sheet = Skia.Surface.Make(baked.sheet.width, baked.sheet.height);
  const surface = Skia.Surface.Make(width * scale, height * scale);
  if (!sheet || !surface) return null;
  sheet.getCanvas().drawPicture(baked.picture);
  const atlas = sheet.makeImageSnapshot();
  const kit = makeKit(width, fillHeight, baked.sheet, { n, fill, font: fonts.display, look });
  // The fill as the round leaves it: every zero landed, held still.
  const round = buildGame(
    { n, groups, fill, width, height: fillHeight, insetTop: 0, insetBottom: 0, weapon: weaponById('pea'), seed: 1, reduceMotion: true },
    'shooter',
  );
  round.phase = 'done';
  round.phaseT = round.fillLen + 1;

  const canvas = surface.getCanvas();
  canvas.scale(scale, scale);
  const ink = Skia.Paint();
  ink.setColor(Skia.Color(colors.ink));
  canvas.drawRect(Skia.XYWHRect(0, 0, width, height), ink);
  canvas.drawPicture(kit.background);
  drawFill(canvas, round, kit, atlas, makeScratch());
  const fade = Skia.Paint();
  fade.setShader(
    Skia.Shader.MakeLinearGradient(
      vec(0, fillHeight - FADE),
      vec(0, fillHeight),
      [Skia.Color(withAlpha(colors.ink, 0)), Skia.Color(colors.ink)],
      null,
      TileMode.Clamp,
    ),
  );
  canvas.drawRect(Skia.XYWHRect(0, fillHeight - FADE, width, FADE), fade);

  const sized = (font: CardFont, size: number) => Skia.Font(fonts[font].getTypeface() ?? undefined, size);
  for (const line of cardLayout(words, (text, font, size) => sized(font, size).measureText(text).width)) {
    const paint = Skia.Paint();
    paint.setColor(Skia.Color(COLORS[line.color]));
    canvas.drawText(line.text, line.x, line.y, paint, sized(line.font, line.size));
  }
  return surface.makeImageSnapshot().encodeToBytes(ImageFormat.PNG, 100);
}
