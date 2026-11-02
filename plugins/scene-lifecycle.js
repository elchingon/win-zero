// Both apps adopt UIKit's scene life cycle. An app built with the iOS 27 SDK that still creates its
// window in the app delegate is stopped at launch on iOS 27 (App Review's crash of Plus 1.2.3:
// _UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption). Expo 57 ships the scene delegate
// (ExpoAppSceneDelegate), but its project template still starts React Native in AppDelegate; this
// wires the app up the way the SDK 58 template does:
// - AppDelegate provides the React Native factory and no longer makes a window or starts React Native,
// - SceneDelegate (an ExpoAppSceneDelegate) makes the window from the scene and starts React Native,
// - Info.plist names SceneDelegate in its scene manifest.
// AppDelegate keeps its Linking overrides: ExpoAppSceneDelegate hands scene links to them, and sees
// that they already told React Native, so each link reaches JavaScript once.
// Prebuild never cleans ios/ (scripts/prebuild.mjs), so this runs again on a project it already
// changed, and on the SDK 58 template, and leaves both as they are.
// Plain CommonJS, so the Expo CLI loads it as it is.
const fs = require('node:fs');
const path = require('node:path');

const NAME = 'scene-lifecycle';
const PROVIDER = 'ExpoReactNativeFactoryProvider';
/** The template's class line, before and after. */
const CLASS = /class AppDelegate: ExpoAppDelegate\s*\{/;
const ADOPTED = new RegExp(`class AppDelegate:[^{]*\\b${PROVIDER}\\b`);
/** The SDK 57 template's window and React Native start, and the blank line after it. */
const WINDOW_BLOCK =
  /^[ \t]*#if os\(iOS\) \|\| os\(tvOS\)[ \t]*\n[ \t]*window = UIWindow\(frame: UIScreen\.main\.bounds\)[ \t]*\n[ \t]*factory\.startReactNative\([^)]*\)[ \t]*\n[ \t]*#endif[ \t]*\n(?:[ \t]*\n)?/m;
/** What the SDK 58 template says in its place. */
const WINDOW_NOTE = [
  '    // The window is created and React Native is started by `SceneDelegate` under the',
  '    // scene-based life cycle (required by the iOS 27 SDK).',
  '',
].join('\n');

/** The SDK 58 template's SceneDelegate.swift. */
const SCENE_DELEGATE = `internal import Expo

@objc(SceneDelegate)
class SceneDelegate: ExpoAppSceneDelegate {
  // Extension point for config plugins.
}
`;
const SCENE_DELEGATE_FILE = 'SceneDelegate.swift';

/** The SDK 58 template's scene manifest: one window scene, run by SceneDelegate. */
function sceneManifest() {
  return {
    UIApplicationSupportsMultipleScenes: false,
    UISceneConfigurations: {
      UIWindowSceneSessionRoleApplication: [
        {
          UISceneConfigurationName: 'Default Configuration',
          UISceneDelegateClassName: '$(PRODUCT_MODULE_NAME).SceneDelegate',
        },
      ],
    },
  };
}

/**
 * AppDelegate.swift with the scene delegate starting React Native. Throws on an AppDelegate it
 * doesn't recognize, so prebuild stops rather than build an app that iOS 27 stops at launch, or
 * one that starts React Native twice.
 */
function adoptSceneLifecycle(swift) {
  let out = swift;
  if (!ADOPTED.test(out)) {
    if (!CLASS.test(out)) {
      throw new Error(`${NAME}: AppDelegate.swift has no "class AppDelegate: ExpoAppDelegate {" to add ${PROVIDER} to.`);
    }
    out = out.replace(CLASS, `class AppDelegate: ExpoAppDelegate, ${PROVIDER} {`);
  }
  if (out.includes('startReactNative(')) {
    if (!WINDOW_BLOCK.test(out)) {
      throw new Error(
        `${NAME}: AppDelegate.swift starts React Native in a way this plugin doesn't know. ` +
          'SceneDelegate starts it now: remove the window and startReactNative from didFinishLaunching.',
      );
    }
    out = out.replace(WINDOW_BLOCK, WINDOW_NOTE);
  }
  return out;
}

/** Info.plist with the scene manifest, whatever it said before. */
function setSceneManifest(plist) {
  return { ...plist, UIApplicationSceneManifest: sceneManifest() };
}

/** @param {import('expo/config').ExpoConfig} config */
function withSceneLifecycle(config) {
  // Loaded here, so the pure parts above can be tested without the CLI's dependencies.
  const { IOSConfig, withAppDelegate, withInfoPlist, withXcodeProject } = require('expo/config-plugins');
  config = withAppDelegate(config, (c) => {
    if (c.modResults.language !== 'swift') {
      throw new Error(`${NAME}: expected a Swift AppDelegate, not ${c.modResults.language}.`);
    }
    c.modResults.contents = adoptSceneLifecycle(c.modResults.contents);
    return c;
  });
  config = withInfoPlist(config, (c) => {
    c.modResults = setSceneManifest(c.modResults);
    return c;
  });
  config = withXcodeProject(config, (c) => {
    const { platformProjectRoot, projectName } = c.modRequest;
    fs.writeFileSync(path.join(platformProjectRoot, projectName, SCENE_DELEGATE_FILE), SCENE_DELEGATE);
    // Skips a file the group already has, so a project this ran on before keeps one reference.
    IOSConfig.XcodeUtils.addBuildSourceFileToGroup({
      filepath: path.join(projectName, SCENE_DELEGATE_FILE),
      groupName: projectName,
      project: c.modResults,
    });
    return c;
  });
  return config;
}

module.exports = withSceneLifecycle;
module.exports.adoptSceneLifecycle = adoptSceneLifecycle;
module.exports.setSceneManifest = setSceneManifest;
module.exports.SCENE_DELEGATE = SCENE_DELEGATE;
