// Generate ios/ or android/ for the app being built: Win Zero, or Win Zero Plus when
// EXPO_PUBLIC_APP_VARIANT=plus (app.config.ts). In place, so native builds are reused, unless the
// folder was last generated for the other app: then it starts clean, so nothing of the other app
// (its bundle id, scheme or icons) lingers. A marker file in the folder records which app it is.
// Run: node scripts/prebuild.mjs ios|android [--no-install]
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MARKER = '.win-zero-variant';

/** The variant this run builds, checked the same way app.config.ts checks it. */
export function buildVariant() {
  const value = process.env.EXPO_PUBLIC_APP_VARIANT?.trim() ?? '';
  if (value === '' || value === 'free') return 'free';
  if (value === 'plus') return 'plus';
  throw new Error(`EXPO_PUBLIC_APP_VARIANT must be unset, "free" or "plus", not "${value}".`);
}

export function prebuild(platform, { install = true } = {}) {
  const variant = buildVariant();
  const dir = path.join(root, platform);
  const marker = path.join(dir, MARKER);
  // A folder from before there were two apps is the free app's.
  const previous = fs.existsSync(marker) ? fs.readFileSync(marker, 'utf8').trim() : fs.existsSync(dir) ? 'free' : null;
  const clean = previous !== null && previous !== variant;
  if (clean) console.log(`${platform}/ was generated for ${previous}: starting clean for ${variant}.`);
  execFileSync(
    'npx',
    ['expo', 'prebuild', '--platform', platform, clean ? '--clean' : '--no-clean', ...(install ? [] : ['--no-install'])],
    { cwd: root, stdio: 'inherit' },
  );
  fs.writeFileSync(marker, `${variant}\n`);
  return variant;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const platform = process.argv[2];
  if (platform !== 'ios' && platform !== 'android') {
    console.error('Usage: node scripts/prebuild.mjs ios|android [--no-install]');
    process.exit(1);
  }
  prebuild(platform, { install: !process.argv.includes('--no-install') });
}
