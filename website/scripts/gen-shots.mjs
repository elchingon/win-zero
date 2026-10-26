// The website's copies of the store screenshots and app icons: small WebP files in src/site/shots,
// with a manifest (shots.json) the build reads for each screenshot's caption, used as its alt text.
// The store PNGs (store-shots/, from `npm run gen:store-shots` at the repo root) are gitignored,
// so Cloudflare can't read them: run this after they change, and commit what it writes.
// Needs cwebp (`brew install webp`).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = (/** @type {string} */ relative) => fileURLToPath(new URL(relative, import.meta.url));

const REPO = here('../../');
const OUT = here('../src/site/shots/');
/** The store screenshots' captions and order (the repo's scripts/store-shots/shots.json). */
const CAPTIONS = path.join(REPO, 'scripts/store-shots/shots.json');
/** The App Store 6.9" set: the largest, so every web size is a downscale. */
const TARGET = 'app-store-6.9';

/** The screenshots the website shows, by store-shot slug, in page order. */
export const WEB_SHOTS = {
  free: ['round', 'shield', 'cheer', 'finish'],
  plus: ['goals', 'pick-game', 'catch', 'cheer', 'notification', 'accessibility', 'days', 'themes'],
};
/** Widths written for each screenshot: 1.5× to 3× a gallery card, which is about 240px wide. */
export const SHOT_WIDTHS = [360, 720];
/** App icons show at up to 64px; this covers 3×. */
const ICON_WIDTH = 192;
const ICONS = { free: 'assets/brand/app-store-icon.png', plus: 'assets/brand-plus/app-store-icon.png' };
const QUALITY = '82';

/** A PNG's pixel size, from its IHDR chunk. */
function pngSize(/** @type {string} */ file) {
  const head = Buffer.alloc(24);
  const fd = fs.openSync(file, 'r');
  fs.readSync(fd, head, 0, 24, 0);
  fs.closeSync(fd);
  return { width: head.readUInt32BE(16), height: head.readUInt32BE(20) };
}

function webp(/** @type {string} */ from, /** @type {string} */ to, /** @type {number} */ width) {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  execFileSync('cwebp', ['-quiet', '-q', QUALITY, '-m', '6', '-sharp_yuv', '-resize', String(width), '0', from, '-o', to]);
}

function main() {
  try {
    execFileSync('cwebp', ['-version'], { stdio: 'ignore' });
  } catch {
    throw new Error('cwebp is missing: install it with `brew install webp`');
  }
  /** @type {{ apps: Record<string, { shots: { slug: string; caption: string; sub?: string }[] }> }} */
  const captions = JSON.parse(fs.readFileSync(CAPTIONS, 'utf8'));
  fs.rmSync(OUT, { recursive: true, force: true });

  /** @type {Record<string, { slug: string; caption: string; sub: string | null }[]>} */
  const apps = {};
  /** @type {{ width: number; height: number } | null} */
  let size = null;
  for (const [app, slugs] of Object.entries(WEB_SHOTS)) {
    const dir = path.join(REPO, 'store-shots/final', app, TARGET);
    if (!fs.existsSync(dir)) throw new Error(`${dir} is missing: run \`npm run gen:store-shots\` at the repo root first`);
    const files = fs.readdirSync(dir);
    apps[app] = slugs.map((slug) => {
      const file = files.find((f) => f.endsWith(`-${slug}.png`));
      const shot = captions.apps[app]?.shots.find((s) => s.slug === slug);
      if (!file || !shot) throw new Error(`No ${app} screenshot "${slug}" in ${dir} and shots.json`);
      const from = path.join(dir, file);
      const own = pngSize(from);
      if (size && (own.width !== size.width || own.height !== size.height)) throw new Error(`${from} isn't ${size.width} × ${size.height}`);
      size = own;
      for (const width of SHOT_WIDTHS) webp(from, path.join(OUT, app, `${slug}-${width}.webp`), width);
      return { slug, caption: shot.caption.replace(/\s*\n\s*/g, ' '), sub: shot.sub ?? null };
    });
  }
  for (const [app, from] of Object.entries(ICONS)) webp(path.join(REPO, from), path.join(OUT, 'icons', `${app}.webp`), ICON_WIDTH);

  const manifest = { size, widths: SHOT_WIDTHS, iconWidth: ICON_WIDTH, apps };
  fs.writeFileSync(path.join(OUT, 'shots.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`gen-shots: wrote ${Object.values(apps).flat().length} screenshots and ${Object.keys(ICONS).length} icons to ${path.relative(REPO, OUT)}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
