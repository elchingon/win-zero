// Win Zero Plus's widgets (SPEC 9). iOS: a WidgetKit extension target, WinZeroWidgets, built from
// modules/widgets/extension, embedded in the app, in the app's App Group, signed by its team, its
// versions the app's. Android: the two widget providers and their refresh alarm, declared in the
// app's manifest (the module's own manifest declares none, so Win Zero, which never runs this
// plugin, has no widgets). Safe to run again on a project it already changed: the files are
// written over, the target and receivers are added once, and the target's settings are set every
// time. Plain CommonJS, so the Expo CLI loads it as it is.
const fs = require('node:fs');
const path = require('node:path');

const TARGET = 'WinZeroWidgets';
const SOURCES = ['WinZeroWidgets.swift', 'WidgetSnapshot.swift', 'WidgetViews.swift'];
const INFO_PLIST = `${TARGET}-Info.plist`;
const ENTITLEMENTS = `${TARGET}.entitlements`;
const GROUP_KEY = 'com.apple.security.application-groups';
const ANDROID_PACKAGE = 'expo.modules.winzerowidgets';
const APPWIDGET_UPDATE = 'android.appwidget.action.APPWIDGET_UPDATE';
/** The widgets change with the clock: their providers hear it change. */
const CLOCK_ACTIONS = ['android.intent.action.TIME_SET', 'android.intent.action.TIMEZONE_CHANGED'];

/** The App Group the app is in (app.json), which the extension joins to read the snapshot. */
function appGroupOf(config) {
  const group = config.ios?.entitlements?.[GROUP_KEY]?.[0];
  if (typeof group !== 'string' || !group) throw new Error('widgets: the app has no App Group in ios.entitlements.');
  return group;
}

/** The extension's bundle id: the app's, then `.widgets`. */
function extensionBundleId(config) {
  const id = config.ios?.bundleIdentifier;
  if (typeof id !== 'string' || !id) throw new Error('widgets: the app has no ios.bundleIdentifier.');
  return `${id}.widgets`;
}

const xml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** The extension's Info.plist: its versions are its target's, which this plugin keeps the app's. */
function infoPlist(displayName, group) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDevelopmentRegion</key>
  <string>$(DEVELOPMENT_LANGUAGE)</string>
  <key>CFBundleDisplayName</key>
  <string>${xml(displayName)}</string>
  <key>CFBundleExecutable</key>
  <string>$(EXECUTABLE_NAME)</string>
  <key>CFBundleIdentifier</key>
  <string>$(PRODUCT_BUNDLE_IDENTIFIER)</string>
  <key>CFBundleInfoDictionaryVersion</key>
  <string>6.0</string>
  <key>CFBundleName</key>
  <string>$(PRODUCT_NAME)</string>
  <key>CFBundlePackageType</key>
  <string>$(PRODUCT_BUNDLE_PACKAGE_TYPE)</string>
  <key>CFBundleShortVersionString</key>
  <string>$(MARKETING_VERSION)</string>
  <key>CFBundleVersion</key>
  <string>$(CURRENT_PROJECT_VERSION)</string>
  <key>NSExtension</key>
  <dict>
    <key>NSExtensionPointIdentifier</key>
    <string>com.apple.widgetkit-extension</string>
  </dict>
  <key>WinZeroAppGroup</key>
  <string>${xml(group)}</string>
</dict>
</plist>
`;
}

function entitlementsPlist(group) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>${GROUP_KEY}</key>
  <array>
    <string>${xml(group)}</string>
  </array>
</dict>
</plist>
`;
}

// --- Android ---------------------------------------------------------------------------------

const receiverName = (cls) => `${ANDROID_PACKAGE}.${cls}`;
const actions = (names) => names.map((name) => ({ $: { 'android:name': name } }));

/** The receivers the widgets need, as the manifest's XML-as-JSON has them. */
function widgetReceivers() {
  const provider = (cls, info, label) => ({
    $: { 'android:name': receiverName(cls), 'android:exported': 'false', 'android:label': `@string/${label}` },
    'intent-filter': [{ action: actions([APPWIDGET_UPDATE, ...CLOCK_ACTIONS]) }],
    'meta-data': [{ $: { 'android:name': 'android.appwidget.provider', 'android:resource': `@xml/${info}` } }],
  });
  return [
    provider('SmallWidgetProvider', 'winzero_widget_small_info', 'winzero_widget_small_label'),
    provider('WideWidgetProvider', 'winzero_widget_wide_info', 'winzero_widget_wide_label'),
    { $: { 'android:name': receiverName('WidgetRefreshReceiver'), 'android:exported': 'false' } },
  ];
}

/** Put the widgets' receivers in the app's <application>, each once, as this plugin last wrote it. */
function setWidgetReceivers(manifest) {
  const app = manifest.manifest?.application?.[0];
  if (!app) throw new Error('widgets: the Android manifest has no <application>.');
  const ours = widgetReceivers();
  const names = new Set(ours.map((r) => r.$['android:name']));
  app.receiver = [...(app.receiver ?? []).filter((r) => !names.has(r.$?.['android:name'])), ...ours];
  return manifest;
}

// --- iOS -------------------------------------------------------------------------------------

const unquote = (s) => (typeof s === 'string' ? s.replace(/^"(.*)"$/, '$1') : s);

/** The native target named `name`, or null. */
function findTarget(project, name) {
  const section = project.pbxNativeTargetSection();
  for (const [uuid, target] of Object.entries(section)) {
    if (uuid.endsWith('_comment') || typeof target !== 'object') continue;
    if (unquote(target.name) === name) return { uuid, target };
  }
  return null;
}

/** A target's build configurations (Debug and Release), by its configuration list. */
function configurationsOf(project, target) {
  const lists = project.pbxXCConfigurationList();
  const list = lists[target.buildConfigurationList];
  const all = project.pbxXCBuildConfigurationSection();
  return (list?.buildConfigurations ?? []).map((ref) => all[ref.value]).filter(Boolean);
}

/** The settings the extension takes from the app as it is now: its team, versions, deployment target and devices. */
const FROM_APP = ['DEVELOPMENT_TEAM', 'MARKETING_VERSION', 'CURRENT_PROJECT_VERSION', 'IPHONEOS_DEPLOYMENT_TARGET', 'TARGETED_DEVICE_FAMILY', 'SWIFT_VERSION'];

function extensionSettings(bundleId, app, version) {
  const settings = {
    PRODUCT_NAME: `"${TARGET}"`,
    PRODUCT_BUNDLE_IDENTIFIER: `"${bundleId}"`,
    INFOPLIST_FILE: `"${TARGET}/${INFO_PLIST}"`,
    CODE_SIGN_ENTITLEMENTS: `"${TARGET}/${ENTITLEMENTS}"`,
    CODE_SIGN_STYLE: 'Automatic',
    GENERATE_INFOPLIST_FILE: 'NO',
    APPLICATION_EXTENSION_API_ONLY: 'YES',
    SKIP_INSTALL: 'YES',
    LD_RUNPATH_SEARCH_PATHS: '"$(inherited) @executable_path/Frameworks @executable_path/../../Frameworks"',
    SWIFT_EMIT_LOC_STRINGS: 'YES',
  };
  for (const key of FROM_APP) if (app[key] !== undefined) settings[key] = app[key];
  // The app's own version, as its Info.plist has it; scripts/prebuild.mjs sets both to it again.
  if (version) settings.MARKETING_VERSION = /^[\w.]+$/.test(version) ? version : JSON.stringify(version);
  settings.SWIFT_VERSION = settings.SWIFT_VERSION ?? '5.0';
  return settings;
}

/**
 * Add the extension's target to the app's Xcode project once, embedded in the app, and set its
 * build settings from the app's every time. Returns the target's uuid.
 */
function setWidgetTarget(project, { bundleId, version }) {
  const objects = project.hash.project.objects;
  // A fresh project may have no dependencies yet; the target's own needs these sections.
  objects.PBXTargetDependency = objects.PBXTargetDependency ?? {};
  objects.PBXContainerItemProxy = objects.PBXContainerItemProxy ?? {};
  const app = project.getFirstTarget();
  let found = findTarget(project, TARGET);
  if (!found) {
    const group = project.addPbxGroup([...SOURCES, INFO_PLIST, ENTITLEMENTS], TARGET, TARGET);
    project.addToPbxGroup(group.uuid, project.getFirstProject().firstProject.mainGroup);
    const target = project.addTarget(TARGET, 'app_extension', TARGET, bundleId);
    project.addBuildPhase(SOURCES, 'PBXSourcesBuildPhase', 'Sources', target.uuid);
    project.addBuildPhase([], 'PBXResourcesBuildPhase', 'Resources', target.uuid);
    project.addBuildPhase([], 'PBXFrameworksBuildPhase', 'Frameworks', target.uuid);
    found = { uuid: target.uuid, target: target.pbxNativeTarget };
  }
  const appSettings = configurationsOf(project, app.firstTarget)[0]?.buildSettings ?? {};
  for (const config of configurationsOf(project, found.target)) {
    const debug = unquote(config.name) === 'Debug';
    config.buildSettings = {
      ...config.buildSettings,
      ...extensionSettings(bundleId, appSettings, version),
      ...(debug ? { SWIFT_OPTIMIZATION_LEVEL: '"-Onone"', DEBUG_INFORMATION_FORMAT: 'dwarf' } : { SWIFT_OPTIMIZATION_LEVEL: '"-O"' }),
    };
  }
  return found.uuid;
}

/** Copy the extension's sources and write its Info.plist and entitlements, over whatever is there. */
async function writeExtensionFiles(projectRoot, platformProjectRoot, displayName, group) {
  const dir = path.join(platformProjectRoot, TARGET);
  const sources = path.join(projectRoot, 'modules', 'widgets', 'extension');
  await fs.promises.mkdir(dir, { recursive: true });
  for (const file of SOURCES) await fs.promises.copyFile(path.join(sources, file), path.join(dir, file));
  await fs.promises.writeFile(path.join(dir, INFO_PLIST), infoPlist(displayName, group));
  await fs.promises.writeFile(path.join(dir, ENTITLEMENTS), entitlementsPlist(group));
}

/** @param {import('expo/config').ExpoConfig} config */
function withWidgets(config) {
  // Loaded here, so the pure parts above can be tested without the CLI's dependencies.
  const { withAndroidManifest, withDangerousMod, withXcodeProject } = require('expo/config-plugins');
  const group = appGroupOf(config);
  const bundleId = extensionBundleId(config);
  config = withAndroidManifest(config, (c) => {
    setWidgetReceivers(c.modResults);
    return c;
  });
  config = withDangerousMod(config, [
    'ios',
    async (c) => {
      await writeExtensionFiles(c.modRequest.projectRoot, c.modRequest.platformProjectRoot, c.name, group);
      return c;
    },
  ]);
  config = withXcodeProject(config, (c) => {
    setWidgetTarget(c.modResults, { bundleId, version: c.version });
    return c;
  });
  return config;
}

module.exports = {
  withWidgets,
  setWidgetReceivers,
  setWidgetTarget,
  widgetReceivers,
  infoPlist,
  entitlementsPlist,
  appGroupOf,
  extensionBundleId,
  TARGET,
};
