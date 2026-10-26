// Ask the Expo CLI for both apps' configs, as EAS will see them (app.config.ts over app.json), and
// check each one's identity and art: Win Zero and Win Zero Plus must never share a bundle id or a
// URL scheme, and every icon and splash file either names must exist. Both must be in the App
// Group a move between them goes through on iPhone (SPEC 9), and only Plus has alternate icons.
// Only Plus pins its variant in its Xcode project (plugins/xcode-variant.js), so an Xcode build of
// Plus bundles Plus's JavaScript.
// Run: npm run check:variants
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const APP_GROUP = 'group.com.e7systems.winzero';

const ICON_PLUGIN = './modules/app-icons/app.plugin.js';
const VARIANT_PLUGIN = './plugins/xcode-variant.js';
const EXPECTED = {
  free: { name: 'Win Zero', id: 'com.e7systems.winzero', scheme: 'winzero', brand: './assets/brand/', icons: 0, pinned: false },
  plus: { name: 'Win Zero Plus', id: 'com.e7systems.winzeroplus', scheme: 'winzeroplus', brand: './assets/brand-plus/', icons: 7, pinned: true },
};

/** The alternate icons a config gives the app-icons plugin: none without it. */
function alternateIcons(c) {
  const entry = (c.plugins ?? []).find((p) => Array.isArray(p) && p[0] === ICON_PLUGIN);
  return entry ? entry[1].icons.map((i) => i.name) : [];
}

function config(variant) {
  const env = { ...process.env, EXPO_PUBLIC_APP_VARIANT: variant };
  const out = execFileSync('npx', ['expo', 'config', '--type', 'public', '--json'], { cwd: root, env, encoding: 'utf8' });
  return JSON.parse(out);
}

function assetPaths(value, found = []) {
  if (typeof value === 'string') {
    if (value.startsWith('./assets/')) found.push(value);
  } else if (Array.isArray(value)) {
    for (const v of value) assetPaths(v, found);
  } else if (value && typeof value === 'object') {
    for (const v of Object.values(value)) assetPaths(v, found);
  }
  return found;
}

const problems = [];
for (const [variant, want] of Object.entries(EXPECTED)) {
  const c = config(variant);
  const check = (label, got, expected) => {
    if (got !== expected) problems.push(`${variant}: ${label} is ${JSON.stringify(got)}, expected ${JSON.stringify(expected)}`);
  };
  check('name', c.name, want.name);
  check('scheme', c.scheme, want.scheme);
  check('ios.bundleIdentifier', c.ios?.bundleIdentifier, want.id);
  check('android.package', c.android?.package, want.id);
  const groups = c.ios?.entitlements?.['com.apple.security.application-groups'] ?? [];
  if (!groups.includes(APP_GROUP)) problems.push(`${variant}: ios.entitlements has no App Group ${APP_GROUP}`);
  const icons = alternateIcons(c);
  check('alternate icons', icons.length, want.icons);
  const pinned = (c.plugins ?? []).some((p) => (Array.isArray(p) ? p[0] : p) === VARIANT_PLUGIN);
  check(`${VARIANT_PLUGIN} in plugins`, pinned, want.pinned);
  const assets = assetPaths(c);
  if (assets.length === 0) problems.push(`${variant}: no art found in the config`);
  for (const p of assets) {
    if (!p.startsWith(want.brand)) problems.push(`${variant}: ${p} is outside ${want.brand}`);
    if (!fs.existsSync(path.join(root, p))) problems.push(`${variant}: ${p} is missing`);
  }
  console.log(`${variant}: ${c.name} · ${c.ios?.bundleIdentifier} · ${c.scheme}:// · ${assets.length} art files · ${icons.length} alternate icons`);
}

if (problems.length > 0) {
  console.error(problems.join('\n'));
  process.exit(1);
}
