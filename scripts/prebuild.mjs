// Generate ios/ or android/ for the app being built: Win Zero, or Win Zero Plus when
// EXPO_PUBLIC_APP_VARIANT=plus (app.config.ts). A marker file in the folder records which app it is.
// - ios/: each app keeps its own Xcode project (scripts/ios-workspace.cjs). Switching apps parks the
//   other app's whole folder in .ios-parked/<free|plus>/ and brings this app's back, then refreshes
//   it in place, so its workspace, Pods, signing and build number carry over.
// - android/: refreshed in place, so native builds are reused, unless it was last generated for the
//   other app: then it starts clean, so nothing of the other app (its id, scheme or icons) lingers.
// Run: node scripts/prebuild.mjs ios|android [--no-install]
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { IOS, NAMES, PARK, parkedPath, planIosSwitch, setMarketingVersion, pointVersionsAtSettings } from './ios-workspace.cjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MARKER = '.win-zero-variant';
/** The command that brings each app's Xcode project back. */
const OPEN_IOS = { free: 'npm run open:ios', plus: 'npm run open:ios:plus' };

/** The variant this run builds, checked the same way app.config.ts checks it. */
export function buildVariant() {
  const value = process.env.EXPO_PUBLIC_APP_VARIANT?.trim() ?? '';
  if (value === '' || value === 'free') return 'free';
  if (value === 'plus') return 'plus';
  throw new Error(`EXPO_PUBLIC_APP_VARIANT must be unset, "free" or "plus", not "${value}".`);
}

/** The app a native folder was generated for, or null when there's no folder. */
function variantIn(dir) {
  const marker = path.join(dir, MARKER);
  if (fs.existsSync(marker)) return fs.readFileSync(marker, 'utf8').trim();
  // A folder from before there were two apps is the free app's.
  return fs.existsSync(dir) ? 'free' : null;
}

function expoPrebuild(platform, { clean, install }) {
  execFileSync(
    'npx',
    ['expo', 'prebuild', '--platform', platform, clean ? '--clean' : '--no-clean', ...(install ? [] : ['--no-install'])],
    { cwd: root, stdio: 'inherit' },
  );
}

/**
 * Xcode's General tab shows the app's own version (app.json, or PLUS.version for Plus), and its
 * build number is the one set there, kept from run to run.
 */
function syncVersions(dir, variant) {
  const projects = fs.readdirSync(dir).filter((name) => name.endsWith('.xcodeproj'));
  if (projects.length !== 1) throw new Error(`ios/ should hold one Xcode project, not ${projects.length}.`);
  const name = projects[0].slice(0, -'.xcodeproj'.length);
  const plistFile = path.join(dir, name, 'Info.plist');
  const pbxprojFile = path.join(dir, projects[0], 'project.pbxproj');
  const { plist, version } = pointVersionsAtSettings(fs.readFileSync(plistFile, 'utf8'));
  fs.writeFileSync(plistFile, plist);
  fs.writeFileSync(pbxprojFile, setMarketingVersion(fs.readFileSync(pbxprojFile, 'utf8'), version));
  console.log(`${NAMES[variant]} ${version}. Set its build number in Xcode's General tab: it carries over.`);
}

/** Puts this app's Xcode project in ios/, parking the other app's, and refreshes it. */
function prebuildIos(variant, install) {
  const dir = path.join(root, IOS);
  const parked = { free: fs.existsSync(path.join(root, parkedPath('free'))), plus: fs.existsSync(path.join(root, parkedPath('plus'))) };
  const plan = planIosSwitch({ active: variantIn(dir), parked }, variant);
  for (const { from, to } of plan.moves) {
    fs.mkdirSync(path.dirname(path.join(root, to)), { recursive: true });
    fs.renameSync(path.join(root, from), path.join(root, to));
  }
  if (plan.parked) {
    console.log(
      `${NAMES[plan.parked]}'s Xcode project is parked in ${parkedPath(plan.parked)}/: close it in Xcode if it's open. ` +
        `${OPEN_IOS[plan.parked]} brings it back.`,
    );
  }
  if (plan.restored) console.log(`${NAMES[variant]}'s Xcode project is back in ios/ from ${PARK}/.`);
  // Never --clean: that would throw away this app's signing, build number and Pods.
  expoPrebuild('ios', { clean: false, install });
  fs.writeFileSync(path.join(dir, MARKER), `${variant}\n`);
  syncVersions(dir, variant);
  // A parked project was installed against node_modules as they were then. A switch always got a
  // fresh pod install when it started clean, so it still gets one.
  if (plan.restored && install) {
    try {
      execFileSync('pod', ['install'], { cwd: dir, stdio: 'inherit' });
    } catch (error) {
      console.error('pod install failed. Try: cd ios && pod install --repo-update');
      throw error;
    }
  }
}

function prebuildAndroid(variant, install) {
  const dir = path.join(root, 'android');
  const previous = variantIn(dir);
  const clean = previous !== null && previous !== variant;
  if (clean) console.log(`android/ was generated for ${previous}: starting clean for ${variant}.`);
  expoPrebuild('android', { clean, install });
  fs.writeFileSync(path.join(dir, MARKER), `${variant}\n`);
}

export function prebuild(platform, { install = true } = {}) {
  const variant = buildVariant();
  if (platform === 'ios') prebuildIos(variant, install);
  else prebuildAndroid(variant, install);
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
