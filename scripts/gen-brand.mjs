// Render the existing game identity with Skia and the app's bundled Bungee font.
// No generated artwork or additional dependencies. Run: node scripts/gen-brand.mjs
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import CanvasKitInit from 'canvaskit-wasm';

const require = createRequire(import.meta.url);
const { PNG } = require('pngjs');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'assets/brand');
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

function text(canvas, label, size, x, y, hex, glow = 0) {
  const font = new kit.Font(face, size);
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
const applePath = path.join(out, 'app-store-icon.png');
const apple = PNG.sync.read(fs.readFileSync(applePath));
for (let i = 3; i < apple.data.length; i += 4) {
  if (apple.data[i] !== 255) throw new Error('App Store artwork must be fully opaque');
}
fs.writeFileSync(applePath, PNG.sync.write(apple, { colorType: 2 }));
render('google-play-icon.png', 512, 512, (c) => { backdrop(c, 512, 512); mark(c, 512); });
render('android-foreground.png', 1024, 1024, (c) => mark(c, 1024), true);
render('android-background.png', 1024, 1024, (c) => backdrop(c, 1024, 1024));
render('android-monochrome.png', 1024, 1024, (c) => mark(c, 1024, true), true);
render('favicon.png', 64, 64, (c) => { backdrop(c, 64, 64); mark(c, 64); });
render('splash-mark.png', 1024, 1024, (c) => launchMark(c, 1024), true);

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
  text(c, 'WIN ZERO', 150, 600, 1300, color('fg'));
});
face.delete();
