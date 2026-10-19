// Render the existing game identity with Skia and the app's bundled Bungee font.
// No generated artwork or additional dependencies. Run: node scripts/gen-brand.mjs
// `--variant plus` delegates to the Gold Edition generator in gen-brand-plus.mjs.
// assets/brand/ is the free app's, and the website publishes from it: the free set never changes.
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import CanvasKitInit from 'canvaskit-wasm';

const require = createRequire(import.meta.url);
const { PNG } = require('pngjs');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const flag = process.argv.indexOf('--variant');
const variant = flag === -1 ? 'free' : process.argv[flag + 1];
if (variant !== 'free' && variant !== 'plus') throw new Error(`Unknown variant: ${variant}`);
const plus = variant === 'plus';
if (plus) {
  await import('./gen-brand-plus.mjs');
  process.exit(0);
}
const out = path.join(root, 'assets/brand');
const TITLE = 'WIN ZERO';
fs.mkdirSync(out, { recursive: true });
const kit = await CanvasKitInit({ locateFile: (name) => path.join(path.dirname(require.resolve('canvaskit-wasm')), name) });
// Read the palette from its source so regenerated assets follow the app theme.
const tokens = fs.readFileSync(path.join(root, 'src/theme/tokens.ts'), 'utf8');
const color = (name) => tokens.match(new RegExp(`${name}: '(#[A-Fa-f0-9]+)'`))[1];
const palette = ['amber', 'flare', 'teal', 'fg'].map(color);
const face = kit.Typeface.MakeTypefaceFromData(fs.readFileSync(path.join(root, 'node_modules/@expo-google-fonts/bungee/400Regular/Bungee_400Regular.ttf')));

function paint(hex, opacity = 1) {
  const p = new kit.Paint();
  p.setAntiAlias(true);
  p.setColor(kit.parseColorString(hex));
  p.setAlphaf(opacity);
  return p;
}

/** The ink bounds of `label` set in Bungee at `size`, relative to its origin. */
function measure(font, label) {
  const ids = font.getGlyphIDs(label);
  const bounds = font.getGlyphBounds(ids);
  const widths = font.getGlyphWidths(ids);
  let advance = 0;
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
  ids.forEach((_, i) => {
    left = Math.min(left, advance + bounds[i * 4]);
    top = Math.min(top, bounds[i * 4 + 1]);
    right = Math.max(right, advance + bounds[i * 4 + 2]);
    bottom = Math.max(bottom, bounds[i * 4 + 3]);
    advance += widths[i];
  });
  return { left, top, right, bottom };
}

/** The largest size, up to `size`, at which `label` is no wider than `width`. */
function fit(label, size, width) {
  const font = new kit.Font(face, size);
  const { left, right } = measure(font, label);
  font.delete();
  return Math.min(size, Math.floor((size * width) / (right - left)));
}

function text(canvas, label, size, x, y, hex, glow = 0) {
  const font = new kit.Font(face, size);
  const { left, top, right, bottom } = measure(font, label);
  const p = paint(hex);
  if (glow) {
    const blur = kit.MaskFilter.MakeBlur(kit.BlurStyle.Solid, glow, true);
    p.setMaskFilter(blur);
    canvas.drawText(label, x - (left + right) / 2, y - (top + bottom) / 2, p, font);
    p.setMaskFilter(null);
    blur.delete();
  }
  canvas.drawText(label, x - (left + right) / 2, y - (top + bottom) / 2, p, font);
  p.delete();
  font.delete();
}

function render(name, width, height, draw, transparent = false) {
  const surface = kit.MakeSurface(width, height);
  if (!surface) throw new Error('Could not allocate brand canvas');
  const canvas = surface.getCanvas();
  canvas.clear(transparent ? kit.TRANSPARENT : kit.parseColorString(color('ink')));
  draw(canvas);
  surface.flush();
  const image = surface.makeImageSnapshot();
  fs.writeFileSync(path.join(out, name), image.encodeToBytes());
  image.delete();
  surface.delete();
  console.log(`${name}: ${width} × ${height}`);
}

/** Store artwork that can't have an alpha channel: check every pixel is opaque, then drop it. */
function opaque(name, colorType = 2) {
  const file = path.join(out, name);
  const png = PNG.sync.read(fs.readFileSync(file));
  for (let i = 3; i < png.data.length; i += 4) {
    if (png.data[i] !== 255) throw new Error(`${name} must be fully opaque`);
  }
  // The tinted icon uses a grayscale PNG with a Gray Gamma 2.2 transfer curve.
  if (colorType === 0) png.gamma = 1 / 2.2;
  fs.writeFileSync(file, PNG.sync.write(png, { colorType }));
}

function backdrop(canvas, width, height) {
  const p = paint(color('ink'));
  const shader = kit.Shader.MakeRadialGradient([width / 2, height * 0.42], height * 0.7,
    [kit.parseColorString(color('panel')), kit.parseColorString(color('ink'))], [0, 1], kit.TileMode.Clamp);
  p.setShader(shader);
  canvas.drawRect(kit.XYWHRect(0, 0, width, height), p);
  p.delete();
  shader.delete();
}

function mark(canvas, size, monochrome = false) {
  // Use the exact squared Bungee zero and flare red from the celebration splash.
  text(canvas, '0', size * 0.74, size / 2, size / 2,
    monochrome ? '#FFFFFF' : color('flare'), monochrome ? 0 : size * 0.008);
}

function launchMark(canvas, size, monochrome = false) {
  // Same proportions, stroke and highlight as game/ZeroRing.tsx.
  const ry = size * 0.285, rx = ry * 0.72, stroke = ry * 0.3;
  const oval = kit.XYWHRect(size / 2 - rx + stroke / 2, size / 2 - ry + stroke / 2,
    2 * rx - stroke, 2 * ry - stroke);
  const p = paint(monochrome ? '#FFFFFF' : color('amber'));
  p.setStyle(kit.PaintStyle.Stroke);
  p.setStrokeWidth(stroke);
  if (!monochrome) {
    const blur = kit.MaskFilter.MakeBlur(kit.BlurStyle.Solid, ry * 0.1, true);
    p.setMaskFilter(blur);
    canvas.drawOval(oval, p);
    p.setMaskFilter(null);
    blur.delete();
  }
  canvas.drawOval(oval, p);
  if (!monochrome) {
    const hx = rx - stroke * 0.75, hy = ry - stroke * 0.75;
    p.setColor(kit.parseColorString(color('fg')));
    p.setAlphaf(0.35);
    p.setStrokeWidth(stroke * 0.18);
    p.setStrokeCap(kit.StrokeCap.Round);
    canvas.drawArc(kit.XYWHRect(size / 2 - hx, size / 2 - hy, hx * 2, hy * 2), 198, 63, false, p);
  }
  p.delete();
}

render('icon.png', 1024, 1024, (c) => { backdrop(c, 1024, 1024); mark(c, 1024); });
// Store listings use full square artwork; each store supplies its own corner mask.
render('app-store-icon.png', 1024, 1024, (c) => { backdrop(c, 1024, 1024); mark(c, 1024); });
// Remove the alpha channel entirely for Apple's flat App Store icon.
opaque('app-store-icon.png');
// iOS 18 appearance variants keep the same glyph, scale and optical center.
// Dark artwork lets the system's own dark background show through.
render('ios-icon-dark.png', 1024, 1024, (c) => mark(c, 1024), true);
// A white glyph on black supplies luminance for the user's chosen Home Screen tint.
render('ios-icon-tinted.png', 1024, 1024, (c) => {
  c.clear(kit.parseColorString('#000000'));
  mark(c, 1024, true);
});
opaque('ios-icon-tinted.png', 0);
render('google-play-icon.png', 512, 512, (c) => { backdrop(c, 512, 512); mark(c, 512); });
render('android-foreground.png', 1024, 1024, (c) => mark(c, 1024), true);
render('android-background.png', 1024, 1024, (c) => backdrop(c, 1024, 1024));
render('android-monochrome.png', 1024, 1024, (c) => mark(c, 1024, true), true);
render('favicon.png', 64, 64, (c) => { backdrop(c, 64, 64); mark(c, 64); });
render('splash-mark.png', 1024, 1024, (c) => launchMark(c, 1024), true);
// The Android status-bar icon: the same white zero, filling the canvas so it reads at 24 dp
// (the adaptive monochrome layer leaves room for launcher masks, so it shows up small there).
render('notification-icon.png', 96, 96, (c) => {
  text(c, '0', 96 * 1.12, 48, 48, '#FFFFFF');
}, true);

render('splash.png', 1200, 2600, (c) => {
  backdrop(c, 1200, 2600);
  // 78 Bungee zeros, arranged like the end-of-round celebration fill.
  for (let row = 0; row < 13; row++) {
    for (let col = 0; col < 6; col++) {
      text(c, '0', 211, (col + 0.5) * 200, (row + 0.5) * 200, palette[(row * 6 + col) % 4], 2);
    }
  }
  const panel = kit.RRectXY(kit.XYWHRect(106, 1140, 988, 320), 38, 38);
  const p = paint(color('ink'), 0.98);
  c.drawRRect(panel, p);
  p.setStyle(kit.PaintStyle.Stroke);
  p.setStrokeWidth(3);
  p.setColor(kit.parseColorString(color('amber')));
  p.setAlphaf(0.65);
  c.drawRRect(panel, p);
  p.delete();
  text(c, TITLE, fit(TITLE, 150, 900), 600, 1300, color('fg'));
});
// The Google Play feature graphic: a strip of the celebration fill with the title plate.
render('play-feature-graphic.png', 1024, 500, (c) => {
  backdrop(c, 1024, 500);
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 10; col++) {
      text(c, '0', 108, (col + 0.5) * 102.4, (row + 0.5) * 100, palette[(row * 10 + col) % 4], 1);
    }
  }
  const panel = kit.RRectXY(kit.XYWHRect(212, 170, 600, 160), 22, 22);
  const p = paint(color('ink'), 0.98);
  c.drawRRect(panel, p);
  p.setStyle(kit.PaintStyle.Stroke);
  p.setStrokeWidth(2);
  p.setColor(kit.parseColorString(color('amber')));
  p.setAlphaf(0.65);
  c.drawRRect(panel, p);
  p.delete();
  text(c, TITLE, fit(TITLE, 84, 552), 512, 250, color('fg'));
});
// Play wants a 24-bit PNG here, with no alpha.
opaque('play-feature-graphic.png');
face.delete();
