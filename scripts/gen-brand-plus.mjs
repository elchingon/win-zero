// Reproducible Win Zero Plus Gold Edition assets. Run: npm run gen:brand:plus
// Deliberately writes only to assets/brand-plus; the free app's renderer stays separate.
import { createHash } from 'node:crypto';
import { Buffer } from 'node:buffer';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import CanvasKitInit from 'canvaskit-wasm';

const require = createRequire(import.meta.url);
const { PNG } = require('pngjs');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'assets/brand-plus');
const regularBrand = path.join(root, 'assets/brand');
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const regularBefore = new Map(fs.readdirSync(regularBrand).map((name) => [name, hash(fs.readFileSync(path.join(regularBrand, name)))]));
fs.mkdirSync(out, { recursive: true });

const kit = await CanvasKitInit({ locateFile: (name) => path.join(path.dirname(require.resolve('canvaskit-wasm')), name) });
const face = kit.Typeface.MakeTypefaceFromData(fs.readFileSync(path.join(root, 'node_modules/@expo-google-fonts/bungee/400Regular/Bungee_400Regular.ttf')));
if (!face) throw new Error('Could not load the bundled Bungee font');
const font = new kit.Font(face, 1000);
const colors = { navy: '#0D1130', panel: '#151A44', gold: '#FFB52E', white: '#FFFFFF' };
const files = [];

function paint(hex) {
  const p = new kit.Paint();
  p.setAntiAlias(true);
  p.setColor(kit.parseColorString(hex));
  return p;
}

// All glyph placement uses actual ink bounds so 0 and + share a horizontal centerline.
const boundsCache = new Map();
function bounds(label) {
  if (boundsCache.has(label)) return boundsCache.get(label);
  const ids = font.getGlyphIDs(label);
  const boxes = font.getGlyphBounds(ids);
  const advances = font.getGlyphWidths(ids);
  let advance = 0, left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
  for (let i = 0; i < ids.length; i++) {
    left = Math.min(left, advance + boxes[i * 4]);
    top = Math.min(top, boxes[i * 4 + 1]);
    right = Math.max(right, advance + boxes[i * 4 + 2]);
    bottom = Math.max(bottom, boxes[i * 4 + 3]);
    advance += advances[i];
  }
  const result = { left, top, right, bottom, width: right - left, height: bottom - top };
  boundsCache.set(label, result);
  return result;
}

function text(c, label, width, cx, cy, hex) {
  const b = bounds(label), scale = width / b.width;
  const p = paint(hex);
  c.save();
  c.translate(cx, cy);
  c.scale(scale, scale);
  c.drawText(label, -(b.left + b.right) / 2, -(b.top + b.bottom) / 2, p, font);
  c.restore();
  p.delete();
}

const zeroAspect = bounds('0').width / bounds('0').height;
const plusRatio = 0.5;
const gapRatio = 0.08;
const markAspect = zeroAspect + gapRatio + plusRatio;

function mark(c, cx, cy, width, appearance = 'dark') {
  const height = width / markAspect;
  const zeroWidth = height * zeroAspect, plusWidth = height * plusRatio;
  const left = cx - width / 2;
  text(c, '0', zeroWidth, left + zeroWidth / 2, cy, appearance === 'mono' ? colors.white : colors.gold);
  text(c, '+', plusWidth, cx + width / 2 - plusWidth / 2, cy, appearance === 'light' ? colors.navy : colors.white);
}

function lockup(c, cx, cy, width, appearance = 'dark') {
  const markWidth = width * 0.72;
  const markHeight = markWidth / markAspect;
  const titleHeight = width * bounds('WIN ZERO').height / bounds('WIN ZERO').width;
  const plusWidth = width * 0.55;
  const plusHeight = plusWidth * bounds('PLUS').height / bounds('PLUS').width;
  const firstGap = width * 0.075, secondGap = width * 0.04;
  const height = markHeight + firstGap + titleHeight + secondGap + plusHeight;
  const top = cy - height / 2;
  mark(c, cx, top + markHeight / 2, markWidth, appearance);
  text(c, 'WIN ZERO', width, cx, top + markHeight + firstGap + titleHeight / 2, appearance === 'light' ? colors.navy : colors.white);
  text(c, 'PLUS', plusWidth, cx, top + markHeight + firstGap + titleHeight + secondGap + plusHeight / 2, colors.gold);
}

function backdrop(c, width, height) {
  const p = paint(colors.navy);
  const shader = kit.Shader.MakeRadialGradient([width / 2, height / 2], Math.max(width, height) * 0.65,
    [kit.parseColorString(colors.panel), kit.parseColorString(colors.navy)], [0, 1], kit.TileMode.Clamp);
  p.setShader(shader);
  c.drawRect(kit.XYWHRect(0, 0, width, height), p);
  p.delete();
  shader.delete();
}

function render(name, width, height, draw, { transparent = false, gray = false, rgba = false } = {}) {
  const surface = kit.MakeSurface(width, height);
  if (!surface) throw new Error(`Could not allocate ${name}`);
  const c = surface.getCanvas();
  c.clear(transparent ? kit.TRANSPARENT : kit.parseColorString(colors.navy));
  draw(c);
  surface.flush();
  const snapshot = surface.makeImageSnapshot();
  const png = PNG.sync.read(Buffer.from(snapshot.encodeToBytes()));
  snapshot.delete();
  surface.delete();
  if (!transparent) {
    for (let i = 3; i < png.data.length; i += 4) {
      if (png.data[i] !== 255) throw new Error(`${name}: opaque artwork has transparency`);
    }
  }
  if (gray) png.gamma = 1 / 2.2;
  const colorType = gray ? 0 : transparent || rgba ? 6 : 2;
  const bytes = PNG.sync.write(png, { colorType });
  fs.writeFileSync(path.join(out, name), bytes);
  files.push({ name, width, height, colorType, sha256: hash(bytes) });
  console.log(`${name}: ${width} × ${height}${transparent ? ' · transparent' : gray ? ' · grayscale' : rgba ? ' · opaque RGBA' : ' · opaque RGB'}`);
}

function icon(c, size) {
  backdrop(c, size, size);
  mark(c, size / 2, size / 2, size * 0.73);
}

// Square masters have no baked-in corner mask or shadow; each store/OS supplies its own.
render('icon.png', 1024, 1024, (c) => icon(c, 1024));
render('app-store-icon.png', 1024, 1024, (c) => icon(c, 1024));
render('google-play-icon.png', 512, 512, (c) => icon(c, 512), { rgba: true });
render('ios-icon-dark.png', 1024, 1024, (c) => mark(c, 512, 512, 1024 * 0.73), { transparent: true });
render('ios-icon-tinted.png', 1024, 1024, (c) => {
  c.clear(kit.parseColorString('#000000'));
  mark(c, 512, 512, 1024 * 0.73, 'mono');
}, { gray: true });
render('android-background.png', 1024, 1024, (c) => backdrop(c, 1024, 1024));
// Keep all foreground ink inside Android's 66/108 safe circle, including the plus.
render('android-foreground.png', 1024, 1024, (c) => mark(c, 512, 512, 1024 * 0.54), { transparent: true });
render('android-monochrome.png', 1024, 1024, (c) => mark(c, 512, 512, 1024 * 0.54, 'mono'), { transparent: true });
render('notification-icon.png', 96, 96, (c) => mark(c, 48, 48, 88, 'mono'), { transparent: true });
render('favicon.png', 64, 64, (c) => icon(c, 64));

// Native splash uses the mark within the OS mask; LaunchSplash shows the full stacked logo.
render('splash-mark.png', 1024, 1024, (c) => mark(c, 512, 512, 1024 * 0.54), { transparent: true });
function splash(c, width, height) {
  backdrop(c, width, height);
  lockup(c, width / 2, height / 2, width * 0.66);
}
render('splash.png', 1200, 2600, (c) => splash(c, 1200, 2600));
render('splash-ios.png', 1320, 2868, (c) => splash(c, 1320, 2868));
render('splash-android.png', 1080, 2400, (c) => splash(c, 1080, 2400));

// The light logo's plus is SOLID NAVY; wordmarks are centered beneath 0 + in both versions.
for (const appearance of ['light', 'dark']) {
  render(`mark-${appearance}.png`, 1024, 1024, (c) => mark(c, 512, 512, 1024 * 0.8, appearance), { transparent: true });
  render(`logo-${appearance}.png`, 1600, 1400, (c) => {
    if (appearance === 'light') c.clear(kit.parseColorString(colors.white));
    else backdrop(c, 1600, 1400);
    lockup(c, 800, 700, 1100, appearance);
  });
  render(`logo-${appearance}-transparent.png`, 1600, 1400, (c) => lockup(c, 800, 700, 1100, appearance), { transparent: true });
}
render('play-feature-graphic.png', 1024, 500, (c) => {
  backdrop(c, 1024, 500);
  lockup(c, 512, 250, 380);
});

// A review sheet made from the actual export files, rather than concept artwork.
function thumbnail(c, name, x, y, width, height, rounded = false) {
  const img = kit.MakeImageFromEncoded(fs.readFileSync(path.join(out, name)));
  if (!img) throw new Error(`Could not decode ${name}`);
  const scale = Math.min(width / img.width(), height / img.height());
  const w = img.width() * scale, h = img.height() * scale;
  const rect = kit.XYWHRect(x + (width - w) / 2, y + (height - h) / 2, w, h);
  c.save();
  if (rounded) c.clipRRect(kit.RRectXY(rect, width * 0.22, width * 0.22), kit.ClipOp.Intersect, true);
  c.drawImageRectOptions(img, kit.XYWHRect(0, 0, img.width(), img.height()), rect, kit.FilterMode.Linear, kit.MipmapMode.None, null);
  c.restore();
  img.delete();
}
render('brand-preview.png', 1800, 1200, (c) => {
  c.clear(kit.parseColorString(colors.white));
  text(c, 'WIN ZERO PLUS', 830, 900, 100, colors.navy);
  thumbnail(c, 'app-store-icon.png', 80, 310, 400, 400, true);
  thumbnail(c, 'app-store-icon.png', 240, 780, 80, 80, true);
  thumbnail(c, 'logo-light.png', 520, 290, 650, 650);
  thumbnail(c, 'splash.png', 1260, 210, 420, 910, true);
  text(c, 'APP ICON', 220, 280, 1020, colors.navy);
  text(c, 'LIGHT LOGO', 270, 845, 1020, colors.navy);
  text(c, 'SPLASH', 200, 1470, 1140, colors.navy);
});

// Validate the delivered files, including native mask safety and required PNG encodings.
for (const file of files) {
  const bytes = fs.readFileSync(path.join(out, file.name));
  const png = PNG.sync.read(bytes);
  if (png.width !== file.width || png.height !== file.height || bytes[25] !== file.colorType) {
    throw new Error(`${file.name}: unexpected PNG dimensions or color type`);
  }
  if (['android-foreground.png', 'android-monochrome.png', 'splash-mark.png'].includes(file.name)) {
    const radius = png.width * 33 / 108;
    for (let y = 0; y < png.height; y++) {
      for (let x = 0; x < png.width; x++) {
        if (png.data[(y * png.width + x) * 4 + 3] > 0 && Math.hypot(x + 0.5 - png.width / 2, y + 0.5 - png.height / 2) > radius) {
          throw new Error(`${file.name}: foreground ink outside Android's safe circle at ${x},${y}`);
        }
      }
    }
  }
}
if (fs.statSync(path.join(out, 'google-play-icon.png')).size > 1024 * 1024) throw new Error('Google Play icon exceeds 1 MB');
for (const [name, digest] of regularBefore) {
  if (hash(fs.readFileSync(path.join(regularBrand, name))) !== digest) throw new Error(`Regular Win Zero asset changed: ${name}`);
}
if (fs.readdirSync(regularBrand).length !== regularBefore.size) throw new Error('Regular Win Zero asset list changed');
fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify({ variant: 'plus', palette: colors, assets: files }, null, 2) + '\n');
font.delete();
face.delete();
console.log(`Validated ${files.length} Plus images. Regular Win Zero assets unchanged (${regularBefore.size} SHA-256 checks).`);
