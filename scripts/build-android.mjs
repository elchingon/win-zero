// Build a release APK (to sideload) and AAB (for Play) on this machine, into build/. The JS is
// bundled in, so the app runs without a dev server; EXPO_PUBLIC_* values come from .env.
// Run: npm run build:android, then npm run install:android with a phone plugged in.
// Win Zero Plus: npm run build:android:plus and npm run install:android:plus (build/win-zero-plus.*),
// signed for upload from .env.signing.plus with npm run build:android:plus:upload.
// Extra args go to Gradle. For a quicker, lighter build for 64-bit phones only (not for Play):
//   npm run build:android -- -PreactNativeArchitectures=arm64-v8a --max-workers=2
// Signs with the debug key prebuild generates. To sign with an upload key (Play only takes that
// one), put ANDROID_UPLOAD_STORE_FILE, ANDROID_UPLOAD_STORE_PASSWORD, ANDROID_UPLOAD_KEY_ALIAS and
// ANDROID_UPLOAD_KEY_PASSWORD in .env.signing (gitignored) and run npm run build:android:upload.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { prebuild } from './prebuild.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const android = path.join(root, 'android');
const outputs = path.join(android, 'app/build/outputs');
const out = path.join(root, 'build');
const KEY_VARS = ['ANDROID_UPLOAD_STORE_FILE', 'ANDROID_UPLOAD_STORE_PASSWORD', 'ANDROID_UPLOAD_KEY_ALIAS', 'ANDROID_UPLOAD_KEY_PASSWORD'];

const run = (cmd, args, cwd = root) => execFileSync(cmd, args, { cwd, stdio: 'inherit' });

// The android/ folder is generated: refresh it from the config so the build matches it. In place,
// so Gradle reuses earlier native builds, unless it was generated for the other app.
const variant = prebuild('android', { install: false });
const name = variant === 'plus' ? 'win-zero-plus' : 'win-zero';

let signing = [];
if (process.env.ANDROID_UPLOAD_STORE_FILE) {
  const missing = KEY_VARS.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    console.error(`Set ${missing.join(', ')} too, or unset ANDROID_UPLOAD_STORE_FILE to sign with the debug key.`);
    process.exit(1);
  }
  const [file, storePassword, alias, keyPassword] = KEY_VARS.map((name) => process.env[name]);
  // Android Studio's signing properties: they override build.gradle, which prebuild rewrites.
  signing = [
    `-Pandroid.injected.signing.store.file=${path.resolve(root, file)}`,
    `-Pandroid.injected.signing.store.password=${storePassword}`,
    `-Pandroid.injected.signing.key.alias=${alias}`,
    `-Pandroid.injected.signing.key.password=${keyPassword}`,
  ];
}

run('./gradlew', ['app:assembleRelease', 'app:bundleRelease', ...signing, ...process.argv.slice(2)], android);

fs.mkdirSync(out, { recursive: true });
const aab = path.join(out, `${name}.aab`);
fs.copyFileSync(path.join(outputs, 'apk/release/app-release.apk'), path.join(out, `${name}.apk`));
fs.copyFileSync(path.join(outputs, 'bundle/release/app-release.aab'), aab);
// The AAB's certificate is the one Play checks: print it to confirm which key signed the build.
const cert = execFileSync('keytool', ['-printcert', '-jarfile', aab], { encoding: 'utf8' });
console.log(`\nSigned by ${cert.match(/Owner: (.*)/)?.[1]}`);
console.log(`  SHA-256 ${cert.match(/SHA256: (.*)/)?.[1]}`);
const install = variant === 'plus' ? 'install:android:plus' : 'install:android';
console.log(`  build/${name}.apk  install with: npm run ${install}`);
console.log(`  build/${name}.aab  upload to Play`);
