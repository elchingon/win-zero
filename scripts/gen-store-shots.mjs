// Compose the store screenshots: each raw capture, scaled down (never stretched or enlarged) under
// its caption on the app's backdrop, at every store size in scripts/store-shots/shots.json.
// Raw captures come from `npm run capture:store-shots` (see docs/store/screenshots.md).
// Reads store-shots/raw/<app>/<device>/<slug>.png and writes store-shots/final/<app>/<target>/NN-slug.png,
// numbered in that store's upload order (shots.json), plus a contact sheet per target. Run: npm run gen:store-shots [-- --app free|plus] [--strict]
import { Buffer } from 'node:buffer';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import CanvasKitInit from 'canvaskit-wasm';

const require = createRequire(import.meta.url);
const { PNG } = require('pngjs');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const config = JSON.parse(fs.readFileSync(path.join(root, 'scripts/store-shots/shots.json'), 'utf8'));
const devices = JSON.parse(fs.readFileSync(path.join(root, 'scripts/store-shots/devices.json'), 'utf8'));
const rawDir = path.join(root, 'store-shots/raw');
const finalDir = path.join(root, 'store-shots/final');

const arg = (name) => {
  const i = process.argv.indexOf(name);
  return i === -1 ? null : process.argv[i + 1];
};
const apps = arg('--app') ? [arg('--app')] : Object.keys(config.apps);
for (const app of apps) if (!config.apps[app]) throw new Error(`Unknown app: ${app}`);
// --strict fails when any capture is missing; otherwise the missing ones are listed and skipped.
const strict = process.argv.includes('--strict');

/** Play's limits for phone and tablet screenshots, and the largest file either store takes. */
const PLAY_MIN_SIDE = 1080;
const PLAY_MAX_SIDE = 7680;
const MAX_BYTES = 8 * 1024 * 1024;
/** Play asks for captions in at most 20% of the image. */
const MAX_CAPTION_SHARE = 0.2;

// Layout, as fractions of the canvas width (W) or height (H).
const SIDE = 0.07; // W: side margin for the caption and the capture
const BAND = 0.15; // H: the caption band, the same on every image so the captures line up
const BAND_PAD = 0.02; // H: the least room above the caption block
const CAPTION_SIZE = 0.064; // W: Bungee caption
const SUB_SIZE = 0.036; // W: Barlow subline
const SUB_GAP = 0.3; // of the caption size, between caption and subline
const BELOW_CAPTION = 0.02; // H: between the caption band and the capture
const BOTTOM = 0.035; // H: under the capture
const SHADOW = 0.02; // W: the capture's drop shadow blur

if (BAND > MAX_CAPTION_SHARE) throw new Error('The caption band is over Play\'s 20%');

const SHEET_HEIGHT = 900;
const SHEET_GAP = 36;

const kit = await CanvasKitInit({ locateFile: (name) => path.join(path.dirname(require.resolve('canvaskit-wasm')), name) });
const tokens = fs.readFileSync(path.join(root, 'src/theme/tokens.ts'), 'utf8');
const color = (name) => tokens.match(new RegExp(`${name}: '(#[A-Fa-f0-9]+)'`))[1];
const fonts = kit.TypefaceFontProvider.Make();
const font = (pkg, file) => fs.readFileSync(path.join(root, 'node_modules/@expo-google-fonts', pkg, file));
fonts.registerFont(font('bungee', '400Regular/Bungee_400Regular.ttf'), 'Bungee');
fonts.registerFont(font('barlow', '600SemiBold/Barlow_600SemiBold.ttf'), 'Barlow');

function paint(hex, opacity = 1) {
  const p = new kit.Paint();
  p.setAntiAlias(true);
  p.setColor(kit.parseColorString(hex));
  p.setAlphaf(opacity);
  return p;
}

function backdrop(canvas, width, height) {
  const p = paint(color('ink'));
  const shader = kit.Shader.MakeRadialGradient([width / 2, height * 0.3], height * 0.75,
    [kit.parseColorString(color('panel')), kit.parseColorString(color('ink'))], [0, 1], kit.TileMode.Clamp);
  p.setShader(shader);
  canvas.drawRect(kit.XYWHRect(0, 0, width, height), p);
  p.delete();
  shader.delete();
}

/** A centered paragraph laid out at `width`. The caller deletes it. */
function paragraph(text, family, size, hex, width, lineHeight) {
  const style = new kit.ParagraphStyle({
    textStyle: { color: kit.parseColorString(hex), fontFamilies: [family], fontSize: size, heightMultiplier: lineHeight },
    textAlign: kit.TextAlign.Center,
  });
  const builder = kit.ParagraphBuilder.MakeFromFontProvider(style, fonts);
  builder.addText(text);
  const p = builder.build();
  builder.delete();
  p.layout(width);
  return p;
}

/** Draws the caption and its subline, centered in the caption band. */
function caption(canvas, shot, width, height) {
  const textWidth = width * (1 - 2 * SIDE);
  const captionSize = width * CAPTION_SIZE;
  const title = paragraph(shot.caption, 'Bungee', captionSize, color('fg'), textWidth, 1.05);
  if (title.getLineMetrics().length > 2) throw new Error(`"${shot.caption}" runs past two lines`);
  const sub = shot.sub ? paragraph(shot.sub, 'Barlow', width * SUB_SIZE, color('amber'), textWidth, 1.2) : null;
  const gap = sub ? captionSize * SUB_GAP : 0;
  const block = title.getHeight() + gap + (sub?.getHeight() ?? 0);
  if (block > height * (BAND - BAND_PAD)) throw new Error(`"${shot.caption}" doesn't fit the caption band at ${width} × ${height}`);
  let y = (height * BAND - block) / 2;
  canvas.drawParagraph(title, width * SIDE, y);
  y += title.getHeight() + gap;
  if (sub) canvas.drawParagraph(sub, width * SIDE, y);
  title.delete();
  sub?.delete();
}

/** The capture, scaled to fit under the caption band, with its screen's rounded corners. */
function capture(canvas, image, device, width, height) {
  const boxTop = height * (BAND + BELOW_CAPTION);
  const boxWidth = width * (1 - 2 * SIDE);
  const boxHeight = height * (1 - BOTTOM) - boxTop;
  const scale = Math.min(boxWidth / image.width(), boxHeight / image.height(), 1);
  const w = image.width() * scale;
  const h = image.height() * scale;
  const rect = kit.XYWHRect((width - w) / 2, boxTop + (boxHeight - h) / 2, w, h);
  const radius = w * device.corner;
  const rrect = kit.RRectXY(rect, radius, radius);

  const shadow = paint('#000000', 0.55);
  const blur = kit.MaskFilter.MakeBlur(kit.BlurStyle.Normal, width * SHADOW, true);
  shadow.setMaskFilter(blur);
  canvas.drawRRect(rrect, shadow);
  shadow.delete();
  blur.delete();

  canvas.save();
  canvas.clipRRect(rrect, kit.ClipOp.Intersect, true);
  // Mitchell cubic: a clean downscale of UI text without mipmap blur.
  canvas.drawImageRectCubic(image, kit.XYWHRect(0, 0, image.width(), image.height()), rect, 1 / 3, 1 / 3, null);
  canvas.restore();

  const edge = paint(color('edge'), 0.45);
  edge.setStyle(kit.PaintStyle.Stroke);
  edge.setStrokeWidth(Math.max(2, width * 0.0018));
  canvas.drawRRect(rrect, edge);
  edge.delete();
  return scale;
}

/** Store artwork can't have an alpha channel: check every pixel is opaque, then drop it. */
function writeOpaque(file, bytes) {
  const png = PNG.sync.read(Buffer.from(bytes));
  for (let i = 3; i < png.data.length; i += 4) {
    if (png.data[i] !== 255) throw new Error(`${file} must be fully opaque`);
  }
  const out = PNG.sync.write(png, { colorType: 2 });
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, out);
  return out.length;
}

function render(width, height, draw) {
  const surface = kit.MakeSurface(width, height);
  if (!surface) throw new Error(`Could not allocate a ${width} × ${height} canvas`);
  const canvas = surface.getCanvas();
  const result = draw(canvas);
  surface.flush();
  const snapshot = surface.makeImageSnapshot();
  const bytes = snapshot.encodeToBytes();
  snapshot.delete();
  surface.delete();
  return { bytes, result };
}

function checkSize(name, store, [width, height]) {
  if (store !== 'play') return;
  if (width * 16 !== height * 9) throw new Error(`${name}: Play wants 9:16, not ${width} × ${height}`);
  if (Math.min(width, height) < PLAY_MIN_SIDE || Math.max(width, height) > PLAY_MAX_SIDE) {
    throw new Error(`${name}: each side must be ${PLAY_MIN_SIDE}–${PLAY_MAX_SIDE} px`);
  }
}

/** One row of every export for a target, for reviewing captions and frames side by side. */
function contactSheet(files, file) {
  const images = files.map((f) => kit.MakeImageFromEncoded(fs.readFileSync(f)));
  const widths = images.map((img) => Math.round((img.width() * SHEET_HEIGHT) / img.height()));
  const width = widths.reduce((sum, w) => sum + w, 0) + SHEET_GAP * (images.length + 1);
  const { bytes } = render(width, SHEET_HEIGHT + 2 * SHEET_GAP, (canvas) => {
    canvas.clear(kit.parseColorString(color('ink2')));
    let x = SHEET_GAP;
    images.forEach((img, i) => {
      const rect = kit.XYWHRect(x, SHEET_GAP, widths[i], SHEET_HEIGHT);
      canvas.drawImageRectOptions(img, kit.XYWHRect(0, 0, img.width(), img.height()), rect, kit.FilterMode.Linear, kit.MipmapMode.Linear, null);
      x += widths[i] + SHEET_GAP;
    });
  });
  images.forEach((img) => img.delete());
  writeOpaque(file, bytes);
}

const missing = [];
for (const app of apps) {
  const { shots, order } = config.apps[app];
  for (const [target, { store, device: deviceId, size }] of Object.entries(config.targets)) {
    const device = devices[deviceId];
    const [width, height] = size;
    checkSize(target, store, size);
    // Start clean, so an export dropped from the order doesn't linger.
    fs.rmSync(path.join(finalDir, app, target), { recursive: true, force: true });
    const written = [];
    // A shot not captured on this device is skipped, and the rest keep their order.
    const ready = order[store].filter((slug) => {
      const captured = fs.existsSync(path.join(rawDir, app, deviceId, `${slug}.png`));
      if (!captured) missing.push(path.relative(root, path.join(rawDir, app, deviceId, `${slug}.png`)));
      return captured;
    });
    ready.forEach((slug, i) => {
      const shot = shots.find((s) => s.slug === slug);
      if (!shot) throw new Error(`${app}: no shot "${slug}" in shots.json`);
      const name = `${String(i + 1).padStart(2, '0')}-${slug}.png`;
      const source = path.join(rawDir, app, deviceId, `${slug}.png`);
      const image = kit.MakeImageFromEncoded(fs.readFileSync(source));
      if (!image) throw new Error(`Could not read ${source}`);
      if (image.width() !== device.size[0] || image.height() !== device.size[1]) {
        throw new Error(`${path.relative(root, source)} is ${image.width()} × ${image.height()}, expected ${device.size.join(' × ')}`);
      }
      const { bytes, result } = render(width, height, (canvas) => {
        backdrop(canvas, width, height);
        caption(canvas, shot, width, height);
        return capture(canvas, image, device, width, height);
      });
      image.delete();
      const file = path.join(finalDir, app, target, name);
      const length = writeOpaque(file, bytes);
      if (length > MAX_BYTES) throw new Error(`${path.relative(root, file)} is ${(length / 1048576).toFixed(1)} MB`);
      written.push(file);
      console.log(`${path.relative(root, file)}: ${width} × ${height}, capture at ${Math.round(result * 100)}%`);
    });
    if (written.length) contactSheet(written, path.join(finalDir, app, `${target}-contact.png`));
  }
}

if (missing.length) {
  console.log(`\nMissing ${missing.length} capture(s):\n  ${missing.join('\n  ')}`);
  if (strict) process.exit(1);
}
