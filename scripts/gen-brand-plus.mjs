// Reproducible Win Zero Plus Gold Edition assets. Run: npm run gen:brand:plus
// Deliberately writes only to assets/brand-plus; the free app's renderer stays separate.
// `--out <dir>` renders only the theme icons and their review sheet into <dir>, to look at them
// without touching assets/.
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
const outFlag = process.argv.indexOf('--out');
const preview = outFlag === -1 ? null : path.resolve(process.argv[outFlag + 1]);
const out = preview ?? path.join(root, 'assets/brand-plus');
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

function text(c, label, width, cx, cy, hex, glow = null) {
  const b = bounds(label), scale = width / b.width;
  const p = paint(hex);
  if (glow) {
    // A blurred copy behind the glyph; the sigma is in output pixels, whatever the scale.
    p.setAlphaf(glow.alpha);
    p.setMaskFilter(kit.MaskFilter.MakeBlur(kit.BlurStyle.Normal, glow.sigma / scale, true));
  }
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
  markIn(c, cx, cy, width, appearance === 'mono' ? colors.white : colors.gold, appearance === 'light' ? colors.navy : colors.white);
}

/** The 0 + mark in any two colors; with `glow`, only the zero's soft glow, to draw beneath it. */
function markIn(c, cx, cy, width, zeroHex, plusHex, glow = null) {
  const height = width / markAspect;
  const zeroWidth = height * zeroAspect, plusWidth = height * plusRatio;
  const left = cx - width / 2;
  text(c, '0', zeroWidth, left + zeroWidth / 2, cy, zeroHex, glow);
  if (!glow) text(c, '+', plusWidth, cx + width / 2 - plusWidth / 2, cy, plusHex);
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
  fs.mkdirSync(path.dirname(path.join(out, name)), { recursive: true });
  fs.writeFileSync(path.join(out, name), bytes);
  files.push({ name, width, height, colorType, sha256: hash(bytes) });
  console.log(`${name}: ${width} × ${height}${transparent ? ' · transparent' : gray ? ' · grayscale' : rgba ? ' · opaque RGBA' : ' · opaque RGB'}`);
}

function icon(c, size) {
  backdrop(c, size, size);
  mark(c, size / 2, size / 2, size * 0.73);
}

// Square masters have no baked-in corner mask or shadow; each store/OS supplies its own.
if (!preview) {
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
}

// Theme icons (SPEC 9): Settings › App icon offers one per theme. Every one keeps the 0 + mark, so
// none passes for Win Zero's icon. These are each theme's colors from src/theme/themes.ts
// (THEME_LOOKS: the zero is palette[0], the plus palette[2], the glow fillGlow), and
// src/theme/__tests__/iconArt.test.ts checks manifest.json against it, so a theme's colors can't
// change without its icon being rendered again.
const THEME_ICONS = {
  classic: { zero: '#FFB52E', plus: '#3FDCCB', glow: ['#FFB52E', '#FF4F6D'] },
  neon: { zero: '#FF3DCB', plus: '#2EE6FF', glow: ['#FF3DCB', '#2EE6FF'] },
  mono: { zero: '#39FF6E', plus: '#8CFFAE', glow: ['#39FF6E', '#1FB85A'] },
  pastel: { zero: '#FFC7A6', plus: '#A6EBD6', glow: ['#FFC7A6', '#FF9EBD'] },
  ember: { zero: '#FF8A1F', plus: '#FFD447', glow: ['#FF8A1F', '#FF3B30'] },
  aurora: { zero: '#4DFFB4', plus: '#6AA9FF', glow: ['#4DFFB4', '#8B5CFF'] },
  // Gold Year, the year's prize, is a gold field (palette[3] → palette[0] → the glow's edge) with a
  // navy mark, the brand's mark for light backgrounds, so it can't pass for the navy Plus icon.
  gold: { zero: '#FFD24D', plus: '#F3E3B0', glow: ['#FFD24D', '#B9770A'], field: ['#FFFDF4', '#FFD24D', '#B9770A'] },
};
/** The fill's glow behind the mark, like the round's celebration: alphas at the middle and edge, and its reach. */
const FILL_GLOW_MIDDLE = 0.34;
const FILL_GLOW_EDGE = 0.14;
const FILL_GLOW_RADIUS = 0.62;
/** The zero's own glow, as in the round: a blur sigma as a fraction of the mark's width, and its alpha. */
const ZERO_GLOW = { sigma: 0.045, alpha: 0.75 };
/** The mark's width on a full tile (as the Plus icon) and on an Android foreground (inside the safe circle). */
const TILE_MARK = 0.73;
const ADAPTIVE_MARK = 0.54;
/** Gold Year's field: where its three colors sit, and how far it reaches from the middle. */
const FIELD_STOPS = [0, 0.45, 1];
const FIELD_RADIUS = 0.775;

function withAlpha(hex, alpha) {
  const color = kit.parseColorString(hex);
  color[3] = alpha;
  return color;
}

function field(c, size, hexes) {
  const p = new kit.Paint();
  p.setAntiAlias(true);
  const shader = kit.Shader.MakeRadialGradient([size / 2, size / 2], size * FIELD_RADIUS,
    hexes.map((hex) => kit.parseColorString(hex)), FIELD_STOPS, kit.TileMode.Clamp);
  p.setShader(shader);
  c.drawRect(kit.XYWHRect(0, 0, size, size), p);
  p.delete();
  shader.delete();
}

/** The full-bleed layer: navy with the theme's fill glow, or Gold Year's field; plus the zero's glow where the mark sits. */
function themeBackground(c, size, look, markWidth) {
  if (look.field) {
    field(c, size, look.field);
    return;
  }
  backdrop(c, size, size);
  const [mid, edge] = look.glow;
  const p = new kit.Paint();
  p.setAntiAlias(true);
  const shader = kit.Shader.MakeRadialGradient([size / 2, size / 2], size * FILL_GLOW_RADIUS,
    [withAlpha(mid, FILL_GLOW_MIDDLE), withAlpha(edge, FILL_GLOW_EDGE), withAlpha(edge, 0)], [0, 0.55, 1], kit.TileMode.Clamp);
  p.setShader(shader);
  c.drawRect(kit.XYWHRect(0, 0, size, size), p);
  p.delete();
  shader.delete();
  markIn(c, size / 2, size / 2, markWidth, look.zero, look.plus, { sigma: markWidth * ZERO_GLOW.sigma, alpha: ZERO_GLOW.alpha });
}

/** The crisp mark on a theme's tile: the theme's colors, or navy on Gold Year's field. */
function themeMark(c, size, look, markWidth) {
  markIn(c, size / 2, size / 2, markWidth, look.field ? colors.navy : look.zero, look.field ? colors.navy : look.plus);
}

for (const [id, look] of Object.entries(THEME_ICONS)) {
  const dir = `icons/${id}`;
  render(`${dir}/app-store-icon.png`, 1024, 1024, (c) => {
    themeBackground(c, 1024, look, 1024 * TILE_MARK);
    themeMark(c, 1024, look, 1024 * TILE_MARK);
  });
  // iOS lays the dark icon on its own dark backdrop: the mark in the theme's colors, with the zero's glow.
  render(`${dir}/ios-icon-dark.png`, 1024, 1024, (c) => {
    const width = 1024 * TILE_MARK;
    markIn(c, 512, 512, width, look.zero, look.plus, { sigma: width * ZERO_GLOW.sigma, alpha: ZERO_GLOW.alpha });
    markIn(c, 512, 512, width, look.zero, look.plus);
  }, { transparent: true });
  // iOS tints by brightness alone, so every theme's tinted icon is the Plus icon's.
  render(`${dir}/ios-icon-tinted.png`, 1024, 1024, (c) => {
    c.clear(kit.parseColorString('#000000'));
    mark(c, 512, 512, 1024 * TILE_MARK, 'mono');
  }, { gray: true });
  render(`${dir}/android-background.png`, 1024, 1024, (c) => themeBackground(c, 1024, look, 1024 * ADAPTIVE_MARK));
  render(`${dir}/android-foreground.png`, 1024, 1024, (c) => themeMark(c, 1024, look, 1024 * ADAPTIVE_MARK), { transparent: true });
  // Themed icons use the shape alone, so this is the Plus icon's monochrome layer too.
  render(`${dir}/android-monochrome.png`, 1024, 1024, (c) => mark(c, 512, 512, 1024 * ADAPTIVE_MARK, 'mono'), { transparent: true });
}

// The review sheet: each icon as iOS and Android launchers show it, beside the Plus icon.
function drawLayers(c, layers, x, y, size, { radius, scale = 1, tint = null, base = null }) {
  const rect = kit.XYWHRect(x, y, size, size);
  c.save();
  c.clipRRect(kit.RRectXY(rect, radius, radius), kit.ClipOp.Intersect, true);
  if (base) {
    const p = paint(base);
    c.drawRect(rect, p);
    p.delete();
  }
  const drawn = size * scale;
  const dst = kit.XYWHRect(x + (size - drawn) / 2, y + (size - drawn) / 2, drawn, drawn);
  for (const name of layers) {
    const img = kit.MakeImageFromEncoded(fs.readFileSync(path.join(out, name)));
    if (!img) throw new Error(`Could not decode ${name}`);
    const p = new kit.Paint();
    if (tint) p.setColorFilter(kit.ColorFilter.MakeBlend(kit.parseColorString(tint), kit.BlendMode.SrcIn));
    c.drawImageRectOptions(img, kit.XYWHRect(0, 0, img.width(), img.height()), dst, kit.FilterMode.Linear, kit.MipmapMode.None, p);
    p.delete();
    img.delete();
  }
  c.restore();
}
const SHEET_TILE = 150;
const SHEET_GAP = 40;
const SHEET_LABEL = 300;
const SHEET_SMALL = 64;
const ANDROID_CROP = 108 / 72; // launchers show the middle 72 dp of a 108 dp layer
/** Sheet captions at one cap height, whatever their length. */
function caption(c, label, left, cy, height) {
  const width = (height * bounds(label).width) / bounds(label).height;
  text(c, label, width, left + width / 2, cy, colors.navy);
}
// The Plus icon's own files sit in assets/; a preview copies them in to sit beside the themes.
const plusSource = path.join(root, 'assets/brand-plus');
if (preview) {
  for (const name of ['app-store-icon.png', 'ios-icon-dark.png', 'ios-icon-tinted.png', 'android-background.png', 'android-foreground.png', 'android-monochrome.png']) {
    fs.copyFileSync(path.join(plusSource, name), path.join(out, name));
  }
  fs.copyFileSync(path.join(root, 'assets/brand/app-store-icon.png'), path.join(out, 'win-zero-icon.png'));
}
const sheetRows = [['PLUS', '']].concat(Object.keys(THEME_ICONS).map((id) => [id.toUpperCase(), `icons/${id}/`]));
const smallRow = 140 + sheetRows.length * (SHEET_TILE + SHEET_GAP);
const sheetHeight = smallRow + SHEET_SMALL + 120;
const sheetWidth = SHEET_LABEL + 6 * (SHEET_TILE + SHEET_GAP);
render('icons-preview.png', sheetWidth, sheetHeight, (c) => {
  c.clear(kit.parseColorString('#E9EBF2'));
  const at = (i) => SHEET_LABEL + i * (SHEET_TILE + SHEET_GAP);
  ['IOS', 'ANDROID', 'ROUND', 'DARK', 'TINTED', 'THEMED'].forEach((label, i) => caption(c, label, at(i), 70, 26));
  sheetRows.forEach(([label, prefix], row) => {
    const y = 120 + row * (SHEET_TILE + SHEET_GAP);
    caption(c, label, 30, y + SHEET_TILE / 2, 30);
    const r = SHEET_TILE * 0.225;
    drawLayers(c, [`${prefix}app-store-icon.png`], at(0), y, SHEET_TILE, { radius: r });
    drawLayers(c, [`${prefix}android-background.png`, `${prefix}android-foreground.png`], at(1), y, SHEET_TILE, { radius: SHEET_TILE * 0.3, scale: ANDROID_CROP });
    drawLayers(c, [`${prefix}android-background.png`, `${prefix}android-foreground.png`], at(2), y, SHEET_TILE, { radius: SHEET_TILE / 2, scale: ANDROID_CROP });
    drawLayers(c, [`${prefix}ios-icon-dark.png`], at(3), y, SHEET_TILE, { radius: r, base: '#1C1C1E' });
    drawLayers(c, [`${prefix}ios-icon-tinted.png`], at(4), y, SHEET_TILE, { radius: r });
    drawLayers(c, [`${prefix}android-monochrome.png`], at(5), y, SHEET_TILE, { radius: SHEET_TILE / 2, scale: ANDROID_CROP, tint: '#23406A', base: '#D3E3FD' });
  });
  // At home-screen size, beside Win Zero's own icon (previews only: assets/ keeps one brand per folder).
  caption(c, 'SMALL', 30, smallRow + SHEET_SMALL / 2, 30);
  const small = (preview ? ['win-zero-icon.png'] : []).concat(sheetRows.map(([, prefix]) => `${prefix}app-store-icon.png`));
  small.forEach((name, i) => drawLayers(c, [name], SHEET_LABEL + i * (SHEET_SMALL + 30), smallRow, SHEET_SMALL, { radius: SHEET_SMALL * 0.225 }));
}, { rgba: true });

// Validate the delivered files, including native mask safety and required PNG encodings.
for (const file of files) {
  const bytes = fs.readFileSync(path.join(out, file.name));
  const png = PNG.sync.read(bytes);
  if (png.width !== file.width || png.height !== file.height || bytes[25] !== file.colorType) {
    throw new Error(`${file.name}: unexpected PNG dimensions or color type`);
  }
  if (/(^|\/)(android-foreground|android-monochrome|splash-mark)\.png$/.test(file.name)) {
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
if (!preview && fs.statSync(path.join(out, 'google-play-icon.png')).size > 1024 * 1024) throw new Error('Google Play icon exceeds 1 MB');
for (const [name, digest] of regularBefore) {
  if (hash(fs.readFileSync(path.join(regularBrand, name))) !== digest) throw new Error(`Regular Win Zero asset changed: ${name}`);
}
if (fs.readdirSync(regularBrand).length !== regularBefore.size) throw new Error('Regular Win Zero asset list changed');
if (!preview) {
  fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify({ variant: 'plus', palette: colors, icons: THEME_ICONS, assets: files }, null, 2) + '\n');
}
font.delete();
face.delete();
console.log(`Validated ${files.length} Plus images. Regular Win Zero assets unchanged (${regularBefore.size} SHA-256 checks).`);
