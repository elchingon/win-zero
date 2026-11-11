// The widgets' config plugin (modules/widgets): Android's receivers go in the app's manifest once,
// however often prebuild runs, beside what's there; the iOS extension's Info.plist and entitlements
// put it in the app's App Group, with its versions from its target. (Its Xcode target is checked by
// a prebuild and build of Plus: jest can't load the xcode package.)
import { describe, expect, it } from '@jest/globals';

import {
  appGroupOf,
  entitlementsPlist,
  extensionBundleId,
  infoPlist,
  setWidgetReceivers,
} from '../../../modules/widgets/plugin/withWidgets';

type Receiver = { $: Record<string, string>; 'intent-filter'?: { action: { $: Record<string, string> }[] }[]; 'meta-data'?: { $: Record<string, string> }[] };

function manifest(receivers: Receiver[] = []) {
  return {
    manifest: {
      application: [{ $: { 'android:name': '.MainApplication' }, activity: [{ $: { 'android:name': '.MainActivity' } }], receiver: receivers }],
    },
  };
}
const receiversOf = (m: ReturnType<typeof manifest>) => (m.manifest.application[0]?.receiver ?? []) as Receiver[];

describe('the Android receivers', () => {
  it('adds the two widget providers and the refresh alarm, each once, however often it runs', () => {
    const once = setWidgetReceivers(manifest());
    const twice = setWidgetReceivers(setWidgetReceivers(manifest()));
    expect(twice).toEqual(once);
    expect(receiversOf(once).map((r) => r.$['android:name'])).toEqual([
      'expo.modules.winzerowidgets.SmallWidgetProvider',
      'expo.modules.winzerowidgets.WideWidgetProvider',
      'expo.modules.winzerowidgets.WidgetRefreshReceiver',
    ]);
    for (const r of receiversOf(once)) expect(r.$['android:exported']).toBe('false');
  });

  it('has each provider hear widget updates and the clock changing, and name its widget info', () => {
    const [small, wide] = receiversOf(setWidgetReceivers(manifest()));
    for (const [r, info] of [
      [small, '@xml/winzero_widget_small_info'],
      [wide, '@xml/winzero_widget_wide_info'],
    ] as const) {
      expect(r?.['intent-filter']?.[0]?.action.map((a) => a.$['android:name'])).toEqual([
        'android.appwidget.action.APPWIDGET_UPDATE',
        'android.intent.action.TIME_SET',
        'android.intent.action.TIMEZONE_CHANGED',
      ]);
      expect(r?.['meta-data']).toEqual([{ $: { 'android:name': 'android.appwidget.provider', 'android:resource': info } }]);
    }
  });

  it('keeps the receivers already there', () => {
    const other = { $: { 'android:name': 'expo.modules.notifications.service.NotificationsService' } };
    const names = receiversOf(setWidgetReceivers(manifest([other]))).map((r) => r.$['android:name']);
    expect(names[0]).toBe(other.$['android:name']);
    expect(names).toHaveLength(4);
  });

  it('refuses a manifest without its application', () => {
    expect(() => setWidgetReceivers({ manifest: {} } as never)).toThrow(/no <application>/);
  });
});

describe('the iOS extension', () => {
  const config = { name: 'Win Zero Plus', ios: { bundleIdentifier: 'com.e7systems.winzeroplus', entitlements: { 'com.apple.security.application-groups': ['group.com.e7systems.winzero'] } } };

  it("joins the app's App Group, under the app's bundle id", () => {
    expect(appGroupOf(config)).toBe('group.com.e7systems.winzero');
    expect(extensionBundleId(config)).toBe('com.e7systems.winzeroplus.widgets');
    expect(entitlementsPlist('group.com.e7systems.winzero')).toContain('<string>group.com.e7systems.winzero</string>');
    expect(() => appGroupOf({ ios: {} })).toThrow(/App Group/);
    expect(() => extensionBundleId({ ios: {} })).toThrow(/bundleIdentifier/);
  });

  it('is a WidgetKit extension, with its versions from its target and its group named for the widgets', () => {
    const plist = infoPlist('Win Zero Plus', 'group.com.e7systems.winzero');
    expect(plist).toContain('<string>com.apple.widgetkit-extension</string>');
    expect(plist).toContain('<key>CFBundleShortVersionString</key>\n  <string>$(MARKETING_VERSION)</string>');
    expect(plist).toContain('<key>CFBundleVersion</key>\n  <string>$(CURRENT_PROJECT_VERSION)</string>');
    expect(plist).toContain('<key>WinZeroAppGroup</key>\n  <string>group.com.e7systems.winzero</string>');
    expect(infoPlist('A & B', 'g')).toContain('<string>A &amp; B</string>');
  });
});
