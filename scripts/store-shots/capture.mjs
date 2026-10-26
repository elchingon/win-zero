// Stage and capture the raw store screenshots on a simulator or emulator, driving the real
// development build with Maestro (flows/) and the debug tools. Never a phone: Android serials
// must be emulators. See docs/store/screenshots.md for builds, Metro and the full run.
//
//   npm run capture:store-shots -- --app free|plus --device <id> [--from <step>] [--only <step,...>]
//   npm run capture:store-shots -- pick --app free --device <id> <slug> <frame>
//
// Devices are in devices.json. Raw captures go to store-shots/raw/<app>/<device>/<slug>.png, and
// mid-action bursts to …/bursts/<slug>/ to pick a frame from. Then run npm run gen:store-shots.
import { execFile, execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const config = JSON.parse(fs.readFileSync(path.join(here, 'shots.json'), 'utf8'));
const devices = JSON.parse(fs.readFileSync(path.join(here, 'devices.json'), 'utf8'));
const SDK = process.env.ANDROID_HOME ?? path.join(os.homedir(), 'Library/Android/sdk');
const ADB = path.join(SDK, 'platform-tools/adb');
const EMULATOR = path.join(SDK, 'emulator/emulator');
/** Each app's Metro, so both can run at once: `npm start`, and `npm run start:plus -- --port 8082`. */
const METRO_PORTS = { free: 8081, plus: 8082 };
const APP_IDS = { free: 'com.e7systems.winzero', plus: 'com.e7systems.winzeroplus' };
const SCHEMES = { free: 'winzero', plus: 'winzeroplus' };
/** The dev menu stays hidden: no onboarding, no menu at launch, no floating Tools button. */
const IOS_LAUNCH_ARGS = ['-EXDevMenuIsOnboardingFinished', 'YES', '-EXDevMenuShowsAtLaunch', 'NO', '-EXDevMenuShowFloatingActionButton', 'NO'];
/** The cheer line each app's shot waits for (src/ui/copy/cheers.ts). */
const CHEERS = { free: "You kept a promise to yourself today.*", plus: 'Every zero is a day you chose yourself.' };
/** How long the test check-in takes to arrive (src/notifications/schedule.ts), plus slack. */
const TEST_CHECK_IN_MS = 12000;
const BURST_TAIL_MS = 1500;

// ---------------------------------------------------------------------------------------------
// The runs. Each step runs a flow, then captures a shot (a single frame, a burst while the flow
// runs, or the notification). `only` limits a step to one platform.

const STEPS = {
  free: [
    { id: 'setup', flow: 'common/setup.yaml' },
    { id: 'round', flow: 'free/round.yaml' },
    { id: 'fire', burst: 'round', flow: 'common/fire.yaml' },
    { id: 'cheer', flow: 'free/cheer.yaml', env: { CHEER: CHEERS.free }, shot: 'cheer' },
    { id: 'arsenal', flow: 'free/arsenal.yaml', shot: 'arsenal' },
    { id: 'privacy', flow: 'free/privacy.yaml', shot: 'privacy', only: 'ios' },
    { id: 'accessibility', flow: 'common/accessibility.yaml', shot: 'accessibility' },
    { id: 'check-in', flow: 'free/check-in.yaml', shot: 'check-in' },
    { id: 'notification', flow: 'common/notify.yaml', notification: 'notification' },
    { id: 'finish', flow: 'free/finish.yaml', shot: 'finish', only: 'ios' },
    { id: 'calendar', flow: 'free/calendar.yaml', shot: 'calendar', only: 'ios' },
    { id: 'shield', flow: 'free/shield.yaml', shot: 'shield', only: 'ios' },
  ],
  plus: [
    { id: 'setup', flow: 'common/setup.yaml' },
    // Walk after dinner checks in on weekdays: move to a Tuesday or Thursday evening first.
    { id: 'clock', flow: 'plus/clock.yaml', env: () => ({ DAYS: daysToTueOrThu() }) },
    { id: 'walk', flow: 'plus/add-goal.yaml', env: { GOAL: 'Walk after dinner', OFF: 'Sunday,Saturday' } },
    { id: 'days', flow: 'plus/add-goal.yaml', env: { GOAL: 'Stretch', OFF: 'Sunday,Tuesday,Thursday,Saturday', SHOT: '1' }, shot: 'days' },
    { id: 'stretch', flow: 'plus/add.yaml' },
    { id: 'pick-game', flow: 'plus/jump-picker.yaml', env: { DAY: 30 }, shot: 'pick-game' },
    { id: 'goals', flow: 'plus/goals.yaml', shot: 'goals' },
    { id: 'catch', flow: 'plus/catch-round.yaml' },
    { id: 'swipe', burst: 'catch', flow: 'plus/catch.yaml' },
    { id: 'cheer', flow: 'plus/cheer.yaml', env: { CHEER: CHEERS.plus }, shot: 'cheer' },
    { id: 'themes', flow: 'plus/themes.yaml', shot: 'themes', only: 'ios' },
    { id: 'accessibility', flow: 'common/accessibility.yaml', shot: 'accessibility' },
    { id: 'notification', flow: 'common/notify.yaml', notification: 'notification' },
  ],
};

// ---------------------------------------------------------------------------------------------

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? null : args[i + 1];
};
const app = flag('--app');
const deviceId = flag('--device');
if (!APP_IDS[app]) fail('--app must be free or plus');
const device = devices[deviceId];
if (!device) fail(`--device must be one of: ${Object.keys(devices).join(', ')}`);
const appId = APP_IDS[app];
const METRO = `http://localhost:${METRO_PORTS[app]}`;
const outDir = path.join(root, 'store-shots/raw', app, deviceId);
const serial = device.platform === 'android' ? `emulator-${device.port}` : device.udid;
// The user's own phone is attached at times: every adb call names an emulator.
if (device.platform === 'android' && !/^emulator-\d+$/.test(serial)) fail(`Refusing to drive ${serial}: emulators only`);

function fail(message) {
  console.error(message);
  process.exit(1);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const run = (cmd, argv, opts = {}) => execFileSync(cmd, argv, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts });
const adb = (...argv) => run(ADB, ['-s', serial, ...argv]);
const simctl = (...argv) => run('xcrun', ['simctl', ...argv]);

/** A raw capture is named by its slug in shots.json; the composer numbers the exports. */
function shotName(slug) {
  if (!config.apps[app].shots.some((s) => s.slug === slug)) throw new Error(`No ${app} shot "${slug}" in shots.json`);
  return slug;
}

/**
 * Days of "+1 day" after the next 8:00 PM check-in opens (today's, or tomorrow's once it's past
 * 8 PM) that land on a Tuesday or Thursday: Walk after dinner checks in then, and Stretch (Monday,
 * Wednesday, Friday) is up next. Assumes the debug clock starts at real time, as after an erase.
 */
function daysToTueOrThu(now = new Date()) {
  const opens = new Date(now);
  if (now.getHours() >= 20) opens.setDate(opens.getDate() + 1);
  let days = 0;
  while (![2, 4].includes((opens.getDay() + days) % 7)) days += 1;
  return days;
}

// --- Devices -------------------------------------------------------------------------------------

async function prepareIos() {
  const state = simctl('list', 'devices', device.udid);
  if (!state.includes('(Booted)')) simctl('boot', device.udid);
  simctl('bootstatus', device.udid, '-b');
  simctl('ui', device.udid, 'appearance', 'dark');
  simctl('status_bar', device.udid, 'override', '--time', '9:41', '--dataNetwork', 'wifi', '--wifiMode', 'active',
    '--wifiBars', '3', '--cellularMode', 'active', '--cellularBars', '4', '--operatorName', '',
    '--batteryState', 'charged', '--batteryLevel', '100');
  try {
    simctl('get_app_container', device.udid, appId);
  } catch {
    fail(`${appId} isn't installed on ${device.name}: build and install the development build first.`);
  }
}

async function prepareAndroid() {
  const attached = run(ADB, ['devices']);
  if (!attached.includes(`${serial}\tdevice`)) {
    console.log(`Starting ${device.avd} on port ${device.port}…`);
    const child = spawn(EMULATOR, ['-avd', device.avd, '-port', String(device.port), '-gpu', 'host', '-no-snapshot-save', '-no-boot-anim', '-no-window'],
      { detached: true, stdio: 'ignore' });
    child.unref();
    run(ADB, ['-s', serial, 'wait-for-device'], { timeout: 180000 });
  }
  while (adb('shell', 'getprop', 'sys.boot_completed').trim() !== '1') await sleep(1000);
  try {
    adb('shell', 'pm', 'path', appId);
  } catch {
    fail(`${appId} isn't installed on ${serial}: install the development build first.`);
  }
  if (device.honorOrientation) {
    // A landscape tablet ignores the app's portrait lock and letterboxes it: let the app turn the
    // display to portrait instead, as a tablet held upright would show it.
    adb('shell', 'settings', 'put', 'system', 'accelerometer_rotation', '0');
    adb('shell', 'settings', 'put', 'system', 'user_rotation', '0');
    adb('shell', 'cmd', 'window', 'set-ignore-orientation-request', 'false');
  }
  adb('reverse', `tcp:${METRO_PORTS[app]}`, `tcp:${METRO_PORTS[app]}`);
  adb('shell', 'pm', 'grant', appId, 'android.permission.POST_NOTIFICATIONS');
  adb('shell', 'cmd', 'uimode', 'night', 'yes');
  adb('shell', 'cmd', 'overlay', 'enable', 'com.android.internal.systemui.navbar.gestural');
  adb('shell', 'settings', 'put', 'global', 'sysui_demo_allowed', '1');
  const demo = (...extras) => adb('shell', 'am', 'broadcast', '-a', 'com.android.systemui.demo', ...extras);
  demo('-e', 'command', 'enter');
  demo('-e', 'command', 'clock', '-e', 'hhmm', '2141');
  demo('-e', 'command', 'battery', '-e', 'level', '100', '-e', 'plugged', 'false');
  demo('-e', 'command', 'network', '-e', 'wifi', 'show', '-e', 'level', '4', '-e', 'fully', 'true');
  demo('-e', 'command', 'network', '-e', 'mobile', 'hide');
  demo('-e', 'command', 'notifications', '-e', 'visible', 'false');
}

/** Opens the app on Metro from scratch, so no "back to" link or old screen shows. */
async function launch() {
  const url = `${SCHEMES[app]}://expo-development-client/?url=${encodeURIComponent(METRO)}`;
  if (device.platform === 'ios') {
    try {
      simctl('terminate', device.udid, appId);
    } catch {
      // not running
    }
    simctl('launch', device.udid, appId, ...IOS_LAUNCH_ARGS);
  } else {
    adb('shell', 'am', 'force-stop', appId);
    adb('shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d', url);
  }
  await maestro('common/ready.yaml', { PORT: METRO_PORTS[app] });
}

const execFileAsync = promisify(execFile);

/** One frame, checked against the device's size in devices.json. Async, so a burst keeps Maestro's output flowing. */
async function capture(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (device.platform === 'ios') {
    await execFileAsync('xcrun', ['simctl', 'io', device.udid, 'screenshot', '--type=png', file]);
  } else {
    const { stdout } = await execFileAsync(ADB, ['-s', serial, 'exec-out', 'screencap', '-p'], { encoding: 'buffer', maxBuffer: 64 * 1024 * 1024 });
    fs.writeFileSync(file, stdout);
  }
  const png = fs.readFileSync(file);
  const [width, height] = [png.readUInt32BE(16), png.readUInt32BE(20)];
  if (width !== device.size[0] || height !== device.size[1]) {
    throw new Error(`${path.relative(root, file)} is ${width} × ${height}, expected ${device.size.join(' × ')}`);
  }
}

// --- Maestro -------------------------------------------------------------------------------------

function maestro(flow, env = {}) {
  const argv = ['--device', serial, 'test', '-e', `APP_ID=${appId}`];
  for (const [key, value] of Object.entries(env)) argv.push('-e', `${key}=${value}`);
  argv.push(path.join(here, 'flows', flow));
  return new Promise((resolve, reject) => {
    const child = spawn('maestro', argv, { env: { ...process.env, MAESTRO_CLI_NO_ANALYTICS: '1' } });
    let output = '';
    const show = (chunk) => {
      output += chunk;
      for (const line of String(chunk).split('\n')) if (/COMPLETED|FAILED|WARNED/.test(line)) console.log(`    ${line.trim()}`);
    };
    child.stdout.on('data', show);
    child.stderr.on('data', show);
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`${flow} failed:\n${output.slice(-2000)}`))));
  });
}

// --- Steps ---------------------------------------------------------------------------------------

async function burst(slug, flow, env) {
  const dir = path.join(outDir, 'bursts', shotName(slug));
  fs.rmSync(dir, { recursive: true, force: true });
  let done = false;
  const flowRun = maestro(flow, env).finally(() => {
    done = true;
  });
  let n = 0;
  let doneAt = null;
  while (!done || Date.now() - doneAt < BURST_TAIL_MS) {
    if (done && doneAt === null) doneAt = Date.now();
    n += 1;
    await capture(path.join(dir, `f${String(n).padStart(3, '0')}.png`));
  }
  await flowRun;
  console.log(`  ${n} frames in ${path.relative(root, dir)}. Pick one with:\n` +
    `  npm run capture:store-shots -- pick --app ${app} --device ${deviceId} ${shotName(slug)} f0NN`);
}

/**
 * Android's shade lists every app's notifications. Snooze all of them for an hour (other apps' and
 * earlier test check-ins), so the shot shows only the new check-in. Snoozing changes no app.
 */
function snoozeNotifications() {
  const records = adb('shell', 'dumpsys', 'notification', '--noredact').split('\n').filter((l) => /^\s+NotificationRecord\(/.test(l));
  for (const record of records) {
    const key = record.match(/key=([^:]+)/)?.[1];
    if (key) adb('shell', `cmd notification snooze --for 3600000 '${key}'`);
  }
}

async function notification(slug) {
  const file = path.join(outDir, `${shotName(slug)}.png`);
  if (device.platform === 'ios') {
    // The flow long-pressed the banner: its actions are showing.
    await capture(file);
    await launch();
  } else {
    await sleep(TEST_CHECK_IN_MS - 4000);
    adb('shell', 'cmd', 'statusbar', 'expand-notifications');
    await sleep(2500);
    await capture(file);
    adb('shell', 'cmd', 'statusbar', 'collapse');
  }
  console.log(`  ${path.relative(root, file)}`);
}

async function runStep(step) {
  console.log(`\n▸ ${step.id}`);
  if (step.burst) return burst(step.burst, step.flow, step.env);
  if (step.notification && device.platform === 'android') snoozeNotifications();
  await maestro(step.flow, typeof step.env === 'function' ? step.env() : step.env);
  if (step.notification) return notification(step.notification);
  if (step.shot) {
    const file = path.join(outDir, `${shotName(step.shot)}.png`);
    await capture(file);
    console.log(`  ${path.relative(root, file)}`);
  }
}

async function main() {
  if (args[0] === 'pick') {
    const [name, frame] = args.slice(-2);
    const from = path.join(outDir, 'bursts', name, `${frame}.png`);
    if (!fs.existsSync(from)) fail(`No ${path.relative(root, from)}`);
    fs.copyFileSync(from, path.join(outDir, `${name}.png`));
    console.log(`${path.relative(root, path.join(outDir, `${name}.png`))} ← ${frame}`);
    return;
  }
  try {
    await (await fetch(`${METRO}/status`)).text();
  } catch {
    fail(`Metro isn't running on ${METRO}: start it for this app (npm start, or npm run start:plus -- --port 8082).`);
  }
  const from = flag('--from');
  const only = flag('--only')?.split(',');
  let steps = STEPS[app].filter((s) => !s.only || s.only === device.platform);
  if (from) steps = steps.slice(Math.max(0, steps.findIndex((s) => s.id === from)));
  if (only) steps = steps.filter((s) => only.includes(s.id));
  if (!steps.length) fail('No steps to run.');

  await (device.platform === 'ios' ? prepareIos() : prepareAndroid());
  await launch();
  for (const step of steps) await runStep(step);
  console.log(`\nDone: ${path.relative(root, outDir)}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
