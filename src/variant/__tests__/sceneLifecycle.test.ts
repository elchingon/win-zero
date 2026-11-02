// The scene-lifecycle config plugin (plugins/scene-lifecycle.js): both apps start React Native from
// SceneDelegate, since iOS 27 stops an app built with its SDK that makes its window in AppDelegate.
import { describe, expect, it } from '@jest/globals';

import { adoptSceneLifecycle, SCENE_DELEGATE, setSceneManifest } from '../../../plugins/scene-lifecycle';

/** The AppDelegate.swift the Expo SDK 57 template writes, which both ios/ projects started from. */
const TEMPLATE = `internal import Expo
import React
import ReactAppDependencyProvider

@main
class AppDelegate: ExpoAppDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ExpoReactNativeFactoryDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  public override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    let delegate = ReactNativeDelegate()
    let factory = ExpoReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

#if os(iOS) || os(tvOS)
    window = UIWindow(frame: UIScreen.main.bounds)
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)
#endif

    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  // Linking API
  public override func application(
    _ app: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey: Any] = [:]
  ) -> Bool {
    return super.application(app, open: url, options: options) || RCTLinkingManager.application(app, open: url, options: options)
  }

  // Universal Links
  public override func application(
    _ application: UIApplication,
    continue userActivity: NSUserActivity,
    restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void
  ) -> Bool {
    let result = RCTLinkingManager.application(application, continue: userActivity, restorationHandler: restorationHandler)
    return super.application(application, continue: userActivity, restorationHandler: restorationHandler) || result
  }
}

class ReactNativeDelegate: ExpoReactNativeFactoryDelegate {
  // Extension point for config-plugins

  override func sourceURL(for bridge: RCTBridge) -> URL? {
    // needed to return the correct URL for expo-dev-client.
    bridge.bundleURL ?? bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    return RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: ".expo/.virtual-metro-entry")
#else
    return Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}
`;

const MANIFEST = {
  UIApplicationSupportsMultipleScenes: false,
  UISceneConfigurations: {
    UIWindowSceneSessionRoleApplication: [
      { UISceneConfigurationName: 'Default Configuration', UISceneDelegateClassName: '$(PRODUCT_MODULE_NAME).SceneDelegate' },
    ],
  },
};

describe('adoptSceneLifecycle', () => {
  const out = adoptSceneLifecycle(TEMPLATE);

  it('gives SceneDelegate the factory, and leaves it to make the window and start React Native', () => {
    expect(out).toContain('class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {');
    expect(out).not.toContain('UIWindow(frame:');
    expect(out).not.toContain('startReactNative');
    expect(out).toContain('started by `SceneDelegate`');
    expect(out).toContain('    reactNativeFactory = factory\n\n    // The window');
    expect(out).toContain('scene-based life cycle (required by the iOS 27 SDK).\n    return super.application(application, didFinishLaunchingWithOptions');
  });

  it('keeps the factory, its window property, the Linking overrides and the bundle URL', () => {
    expect(out).toContain('var window: UIWindow?');
    expect(out).toContain('let factory = ExpoReactNativeFactory(delegate: delegate)');
    expect(out).toContain('delegate.dependencyProvider = RCTAppDependencyProvider()');
    expect(out).toContain('RCTLinkingManager.application(app, open: url, options: options)');
    expect(out).toContain('RCTLinkingManager.application(application, continue: userActivity');
    expect(out).toContain('#if DEBUG');
  });

  it('changes nothing it already changed, however often prebuild runs', () => {
    expect(adoptSceneLifecycle(out)).toBe(out);
    expect(adoptSceneLifecycle(adoptSceneLifecycle(out))).toBe(out);
  });

  it('stops on an AppDelegate it does not recognize', () => {
    expect(() => adoptSceneLifecycle(TEMPLATE.replace('class AppDelegate: ExpoAppDelegate {', 'class AppDelegate: RCTAppDelegate {'))).toThrow(
      /scene-lifecycle/,
    );
    const moved = TEMPLATE.replace('window = UIWindow(frame: UIScreen.main.bounds)', 'window = makeWindow()');
    expect(() => adoptSceneLifecycle(moved)).toThrow(/startReactNative/);
  });
});

describe('setSceneManifest', () => {
  it('names SceneDelegate for the one window scene, keeping every other key', () => {
    const plist = { CFBundleDisplayName: 'Win Zero Plus', UIRequiresFullScreen: false };
    const out = setSceneManifest(plist);
    expect(out.UIApplicationSceneManifest).toEqual(MANIFEST);
    expect(out).toMatchObject(plist);
    expect(plist).not.toHaveProperty('UIApplicationSceneManifest');
  });

  it('replaces an old manifest, and says the same thing twice over', () => {
    const once = setSceneManifest({ UIApplicationSceneManifest: { UIApplicationSupportsMultipleScenes: true } });
    expect(once.UIApplicationSceneManifest).toEqual(MANIFEST);
    expect(setSceneManifest(once)).toEqual(once);
  });
});

describe('SCENE_DELEGATE', () => {
  it('is the Objective-C class the manifest names, built on Expo’s scene delegate', () => {
    expect(SCENE_DELEGATE).toContain('@objc(SceneDelegate)');
    expect(SCENE_DELEGATE).toContain('class SceneDelegate: ExpoAppSceneDelegate {');
  });
});
