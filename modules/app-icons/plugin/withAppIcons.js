// Win Zero Plus's alternate home-screen icons (SPEC 9): the app's own icon plus the ones named here.
// Android: MainActivity keeps its links and stays enabled and exported (Win Zero hands a move to it
// by name), and gives only its launcher entry to one activity-alias per icon, AppIcon_<name>, which
// the native module switches between. iOS: an AppIcon-<name> set per icon in the asset catalog,
// with its dark and tinted versions, named in the build settings so Xcode lists them as alternates.
// Plain CommonJS, so the Expo CLI loads it as it is.
const fs = require('node:fs');
const path = require('node:path');

const ANDROID_PREFIX = 'AppIcon_';
const IOS_PREFIX = 'AppIcon-';
/** The app's own icon, which is the launcher entry until another is picked. */
const DEFAULT = 'default';
/** Lowercase letters and digits: a valid class name on Android, resource name and asset name. */
const NAME = /^[a-z][a-z0-9]*$/;
const MAIN = 'android.intent.action.MAIN';
const LAUNCHER = 'android.intent.category.LAUNCHER';

const RES = 'android/app/src/main/res';
/** Adaptive layers are 108 dp square and legacy icons (Android 7) 48 dp, as Expo makes the main icon. */
const ADAPTIVE_DP = 108;
const LEGACY_DP = 48;
const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
const IOS_SIZE = 1024;

/** Refuses options that would build an app with a broken icon, naming what's wrong. */
function checkIcons(icons) {
  if (!Array.isArray(icons) || icons.length === 0) throw new Error('app-icons: `icons` must list at least one icon.');
  const seen = new Set();
  for (const icon of icons) {
    const name = icon?.name;
    if (typeof name !== 'string' || !NAME.test(name) || name === DEFAULT) {
      throw new Error(`app-icons: icon names are lowercase letters and digits, not "${DEFAULT}": got ${JSON.stringify(name)}.`);
    }
    if (seen.has(name)) throw new Error(`app-icons: "${name}" is listed twice.`);
    seen.add(name);
    for (const key of ['light', 'dark', 'tinted']) {
      if (typeof icon.ios?.[key] !== 'string') throw new Error(`app-icons: "${name}" has no ios.${key} image.`);
    }
    for (const key of ['foregroundImage', 'backgroundImage', 'monochromeImage']) {
      if (typeof icon.android?.[key] !== 'string') throw new Error(`app-icons: "${name}" has no android.${key}.`);
    }
  }
}

const isLauncher = (filter) =>
  (filter.action ?? []).some((a) => a.$?.['android:name'] === MAIN) &&
  (filter.category ?? []).some((c) => c.$?.['android:name'] === LAUNCHER);

const mipmap = (name) => (name === DEFAULT ? 'ic_launcher' : `ic_launcher_${name}`);

/** The <application> and its .MainActivity, found the way Expo's own plugins find them. */
function mainApplication(manifest) {
  const app = manifest.manifest?.application?.[0];
  if (!app) throw new Error('app-icons: the Android manifest has no <application>.');
  return app;
}
function mainActivity(app) {
  const main = (app.activity ?? []).find((a) => a.$?.['android:name'] === '.MainActivity');
  if (!main) throw new Error('app-icons: the Android manifest has no .MainActivity.');
  return main;
}

/**
 * MainActivity loses only its launcher entry; each icon gets an alias that opens MainActivity, and
 * only the app's own is enabled. Replaces any aliases from an earlier run, so it's safe to repeat.
 */
function setAppIconAliases(manifest, names) {
  const app = mainApplication(manifest);
  const main = mainActivity(app);
  main['intent-filter'] = (main['intent-filter'] ?? []).filter((f) => !isLauncher(f));
  const others = (app['activity-alias'] ?? []).filter((a) => !a.$['android:name'].startsWith(`.${ANDROID_PREFIX}`));
  const aliases = [DEFAULT, ...names].map((name) => ({
    $: {
      'android:name': `.${ANDROID_PREFIX}${name}`,
      'android:enabled': String(name === DEFAULT),
      'android:exported': 'true',
      'android:icon': `@mipmap/${mipmap(name)}`,
      'android:roundIcon': `@mipmap/${mipmap(name)}_round`,
      'android:targetActivity': main.$['android:name'],
    },
    'intent-filter': [{ action: [{ $: { 'android:name': MAIN } }], category: [{ $: { 'android:name': LAUNCHER } }] }],
  }));
  app['activity-alias'] = [...others, ...aliases];
  return manifest;
}

const adaptiveIconXml = (name) => `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@mipmap/${mipmap(name)}_background"/>
    <foreground android:drawable="@mipmap/${mipmap(name)}_foreground"/>
    <monochrome android:drawable="@mipmap/${mipmap(name)}_monochrome"/>
</adaptive-icon>
`;

/** Tells the native module this app has icons, so it checks its launcher entries at startup. */
const ENABLED_XML = `<?xml version="1.0" encoding="utf-8"?>
<resources>
  <bool name="app_icons_enabled">true</bool>
</resources>
`;

/** Each icon's layers at every density, a legacy square and round icon, and the adaptive icon XML. */
async function writeAndroidIcons(projectRoot, icons) {
  const { compositeImagesAsync, generateImageAsync } = require('@expo/image-utils');
  const resize = async (src, px, kind, borderRadius) =>
    (
      await generateImageAsync(
        { projectRoot, cacheType: `app-icons-${kind}` },
        { src: path.resolve(projectRoot, src), width: px, height: px, resizeMode: 'cover', backgroundColor: 'transparent', borderRadius },
      )
    ).source;
  const res = path.join(projectRoot, RES);
  for (const { name, android } of icons) {
    for (const [density, scale] of Object.entries(DENSITIES)) {
      const dir = path.join(res, `mipmap-${density}`);
      await fs.promises.mkdir(dir, { recursive: true });
      const layer = ADAPTIVE_DP * scale;
      const legacy = LEGACY_DP * scale;
      const write = (suffix, bytes) => fs.promises.writeFile(path.join(dir, `${mipmap(name)}${suffix}.png`), bytes);
      await write('_foreground', await resize(android.foregroundImage, layer, 'foreground'));
      await write('_background', await resize(android.backgroundImage, layer, 'background'));
      await write('_monochrome', await resize(android.monochromeImage, layer, 'monochrome'));
      for (const [suffix, radius] of [['', undefined], ['_round', legacy / 2]]) {
        const foreground = await resize(android.foregroundImage, legacy, `legacy-fg${suffix}`, radius);
        const background = await resize(android.backgroundImage, legacy, `legacy-bg${suffix}`, radius);
        await write(suffix, await compositeImagesAsync({ foreground, background }));
      }
    }
    const anydpi = path.join(res, 'mipmap-anydpi-v26');
    await fs.promises.mkdir(anydpi, { recursive: true });
    for (const suffix of ['', '_round']) {
      await fs.promises.writeFile(path.join(anydpi, `${mipmap(name)}${suffix}.xml`), adaptiveIconXml(name));
    }
  }
  await fs.promises.mkdir(path.join(res, 'values'), { recursive: true });
  await fs.promises.writeFile(path.join(res, 'values', 'app_icons.xml'), ENABLED_XML);
}

const IOS_FILES = { light: 'App-Icon-1024x1024@1x.png', dark: 'App-Icon-dark-1024x1024@1x.png', tinted: 'App-Icon-tinted-1024x1024@1x.png' };

/** An icon set's Contents.json: one 1024 image per appearance, as Expo writes the main icon's. */
function appIconContents() {
  return {
    images: Object.entries(IOS_FILES).map(([appearance, filename]) => ({
      filename,
      idiom: 'universal',
      platform: 'ios',
      size: `${IOS_SIZE}x${IOS_SIZE}`,
      ...(appearance === 'light' ? {} : { appearances: [{ appearance: 'luminosity', value: appearance }] }),
    })),
    info: { version: 1, author: 'expo' },
  };
}

/** The alternate icon sets Xcode compiles in, by asset name. */
const alternateIconNames = (names) => names.map((n) => IOS_PREFIX + n).join(' ');

/** Names the alternates in the app target's build settings (the configurations that name its AppIcon). */
function setAlternateIconSettings(project, names) {
  for (const config of Object.values(project.pbxXCBuildConfigurationSection())) {
    if (typeof config !== 'object' || !config.buildSettings?.ASSETCATALOG_COMPILER_APPICON_NAME) continue;
    config.buildSettings.ASSETCATALOG_COMPILER_ALTERNATE_APPICON_NAMES = `"${alternateIconNames(names)}"`;
    config.buildSettings.ASSETCATALOG_COMPILER_INCLUDE_ALL_APPICON_ASSETS = 'YES';
  }
  return project;
}

/** Each icon's set, copied as it is: the art is already 1024 px with the formats iOS wants. */
async function writeIosIcons(projectRoot, platformProjectRoot, projectName, icons) {
  const catalog = path.join(platformProjectRoot, projectName, 'Images.xcassets');
  for (const { name, ios } of icons) {
    const dir = path.join(catalog, `${IOS_PREFIX}${name}.appiconset`);
    await fs.promises.rm(dir, { recursive: true, force: true });
    await fs.promises.mkdir(dir, { recursive: true });
    for (const [appearance, filename] of Object.entries(IOS_FILES)) {
      await fs.promises.copyFile(path.resolve(projectRoot, ios[appearance]), path.join(dir, filename));
    }
    await fs.promises.writeFile(path.join(dir, 'Contents.json'), JSON.stringify(appIconContents(), null, 2) + '\n');
  }
}

/** @param {import('expo/config').ExpoConfig} config */
function withAppIcons(config, { icons } = {}) {
  // Loaded here, so the pure parts above can be tested without the CLI's dependencies.
  const { withAndroidManifest, withDangerousMod, withXcodeProject } = require('expo/config-plugins');
  checkIcons(icons);
  const names = icons.map((i) => i.name);
  config = withAndroidManifest(config, (c) => {
    setAppIconAliases(c.modResults, names);
    return c;
  });
  config = withDangerousMod(config, [
    'android',
    async (c) => {
      await writeAndroidIcons(c.modRequest.projectRoot, icons);
      return c;
    },
  ]);
  config = withDangerousMod(config, [
    'ios',
    async (c) => {
      await writeIosIcons(c.modRequest.projectRoot, c.modRequest.platformProjectRoot, c.modRequest.projectName, icons);
      return c;
    },
  ]);
  config = withXcodeProject(config, (c) => {
    setAlternateIconSettings(c.modResults, names);
    return c;
  });
  return config;
}

module.exports = { withAppIcons, setAppIconAliases, appIconContents, alternateIconNames, setAlternateIconSettings, checkIcons };
