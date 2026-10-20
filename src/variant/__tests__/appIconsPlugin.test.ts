// The app-icons config plugin (modules/app-icons): MainActivity keeps everything but its launcher
// entry, so links, notification taps and a move from Win Zero (an intent to MainActivity by name)
// all work whichever icon is showing, and each icon's alias opens MainActivity.
import { describe, expect, it } from '@jest/globals';

import {
  alternateIconNames,
  appIconContents,
  checkIcons,
  setAlternateIconSettings,
  setAppIconAliases,
} from '../../../modules/app-icons/plugin/withAppIcons';

type Xml = { $: Record<string, string> } & Record<string, unknown>;
const named = (name: string) => [{ $: { 'android:name': name } }];

/** The manifest prebuild writes for Win Zero Plus before the plugin runs (trimmed). */
function manifest() {
  return {
    manifest: {
      $: { 'xmlns:android': 'http://schemas.android.com/apk/res/android' },
      application: [
        {
          $: { 'android:name': '.MainApplication', 'android:icon': '@mipmap/ic_launcher' },
          activity: [
            {
              $: { 'android:name': '.MainActivity', 'android:exported': 'true', 'android:launchMode': 'singleTask' },
              'intent-filter': [
                { action: named('android.intent.action.MAIN'), category: named('android.intent.category.LAUNCHER') },
                {
                  action: named('android.intent.action.VIEW'),
                  category: [...named('android.intent.category.DEFAULT'), ...named('android.intent.category.BROWSABLE')],
                  data: [{ $: { 'android:scheme': 'winzeroplus' } }],
                },
              ],
            },
            { $: { 'android:name': 'expo.modules.devlauncher.launcher.DevLauncherActivity' } },
          ],
        },
      ],
    },
  };
}

const app = (m: ReturnType<typeof manifest>) => m.manifest.application[0] as unknown as Record<string, Xml[]>;
const main = (m: ReturnType<typeof manifest>) => app(m).activity!.find((a) => a.$['android:name'] === '.MainActivity')!;
const aliases = (m: ReturnType<typeof manifest>) => app(m)['activity-alias'] ?? [];

describe('the Android manifest', () => {
  it('moves only the launcher entry off MainActivity, which stays exported with its links', () => {
    const m = setAppIconAliases(manifest(), ['neon', 'gold']);
    expect(main(m).$['android:exported']).toBe('true');
    expect(main(m).$['android:enabled']).toBeUndefined();
    const links = main(manifest())['intent-filter'] as unknown[];
    expect(main(m)['intent-filter']).toEqual([links[1]]);
  });

  it('gives each icon an alias that opens MainActivity from the launcher, with only the app’s own enabled', () => {
    const m = setAppIconAliases(manifest(), ['neon', 'gold']);
    expect(aliases(m).map((a) => a.$)).toEqual([
      {
        'android:name': '.AppIcon_default',
        'android:enabled': 'true',
        'android:exported': 'true',
        'android:icon': '@mipmap/ic_launcher',
        'android:roundIcon': '@mipmap/ic_launcher_round',
        'android:targetActivity': '.MainActivity',
      },
      {
        'android:name': '.AppIcon_neon',
        'android:enabled': 'false',
        'android:exported': 'true',
        'android:icon': '@mipmap/ic_launcher_neon',
        'android:roundIcon': '@mipmap/ic_launcher_neon_round',
        'android:targetActivity': '.MainActivity',
      },
      {
        'android:name': '.AppIcon_gold',
        'android:enabled': 'false',
        'android:exported': 'true',
        'android:icon': '@mipmap/ic_launcher_gold',
        'android:roundIcon': '@mipmap/ic_launcher_gold_round',
        'android:targetActivity': '.MainActivity',
      },
    ]);
    for (const alias of aliases(m)) {
      expect(alias['intent-filter']).toEqual([
        { action: named('android.intent.action.MAIN'), category: named('android.intent.category.LAUNCHER') },
      ]);
    }
  });

  it('leaves other activities alone, and gives the same manifest when run again', () => {
    const once = setAppIconAliases(manifest(), ['neon']);
    expect(app(once).activity![1]).toEqual(manifest().manifest.application[0]!.activity[1]);
    const twice = setAppIconAliases(setAppIconAliases(manifest(), ['neon']), ['neon']);
    expect(twice).toEqual(once);
  });
});

describe('iOS', () => {
  it('writes each icon set with its dark and tinted versions, as Expo writes the main icon', () => {
    expect(appIconContents()).toEqual({
      images: [
        { filename: 'App-Icon-1024x1024@1x.png', idiom: 'universal', platform: 'ios', size: '1024x1024' },
        {
          filename: 'App-Icon-dark-1024x1024@1x.png',
          idiom: 'universal',
          platform: 'ios',
          size: '1024x1024',
          appearances: [{ appearance: 'luminosity', value: 'dark' }],
        },
        {
          filename: 'App-Icon-tinted-1024x1024@1x.png',
          idiom: 'universal',
          platform: 'ios',
          size: '1024x1024',
          appearances: [{ appearance: 'luminosity', value: 'tinted' }],
        },
      ],
      info: { version: 1, author: 'expo' },
    });
  });

  it('names the alternates only in the app target’s build settings', () => {
    expect(alternateIconNames(['neon', 'gold'])).toBe('AppIcon-neon AppIcon-gold');
    const configs: Record<string, unknown> = {
      app: { buildSettings: { ASSETCATALOG_COMPILER_APPICON_NAME: 'AppIcon', PRODUCT_NAME: 'WinZeroPlus' } },
      project: { buildSettings: { SDKROOT: 'iphoneos' } },
      app_comment: 'Debug',
    };
    setAlternateIconSettings({ pbxXCBuildConfigurationSection: () => configs }, ['neon', 'gold']);
    expect(configs.app).toEqual({
      buildSettings: {
        ASSETCATALOG_COMPILER_APPICON_NAME: 'AppIcon',
        ASSETCATALOG_COMPILER_ALTERNATE_APPICON_NAMES: '"AppIcon-neon AppIcon-gold"',
        ASSETCATALOG_COMPILER_INCLUDE_ALL_APPICON_ASSETS: 'YES',
        PRODUCT_NAME: 'WinZeroPlus',
      },
    });
    expect(configs.project).toEqual({ buildSettings: { SDKROOT: 'iphoneos' } });
  });
});

describe('the options', () => {
  const icon = (name: string) => ({
    name,
    ios: { light: 'l.png', dark: 'd.png', tinted: 't.png' },
    android: { foregroundImage: 'f.png', backgroundImage: 'b.png', monochromeImage: 'm.png' },
  });

  it('takes lowercase names with every image', () => {
    expect(() => checkIcons([icon('neon'), icon('gold2')])).not.toThrow();
  });

  it('refuses what would build a broken icon', () => {
    expect(() => checkIcons([])).toThrow('at least one icon');
    expect(() => checkIcons([icon('Neon')])).toThrow('lowercase');
    expect(() => checkIcons([icon('default')])).toThrow('lowercase');
    expect(() => checkIcons([icon('neon'), icon('neon')])).toThrow('twice');
    expect(() => checkIcons([{ ...icon('neon'), ios: { light: 'l.png', dark: 'd.png' } }])).toThrow('ios.tinted');
    expect(() => checkIcons([{ ...icon('neon'), android: { foregroundImage: 'f.png' } }])).toThrow('android.backgroundImage');
  });
});
