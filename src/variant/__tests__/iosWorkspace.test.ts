// Each app keeps its own Xcode project (scripts/ios-workspace.cjs, used by scripts/prebuild.mjs):
// both build in ios/, and the one not being built waits, untouched, in .ios-parked/.
import { describe, expect, it } from '@jest/globals';

import { planIosSwitch, setMarketingVersion, pointVersionsAtSettings } from '../../../scripts/ios-workspace.cjs';

const none = { free: false, plus: false };

describe('planIosSwitch', () => {
  it('starts from nothing: prebuild makes the first project', () => {
    expect(planIosSwitch({ active: null, parked: none }, 'free')).toEqual({ moves: [], parked: null, restored: false });
    expect(planIosSwitch({ active: null, parked: none }, 'plus')).toEqual({ moves: [], parked: null, restored: false });
  });

  it('leaves the same app where it is', () => {
    expect(planIosSwitch({ active: 'plus', parked: none }, 'plus')).toEqual({ moves: [], parked: null, restored: false });
    expect(planIosSwitch({ active: 'free', parked: { free: false, plus: true } }, 'free')).toEqual({
      moves: [],
      parked: null,
      restored: false,
    });
  });

  it("parks the other app's project when this app has none yet", () => {
    // Today's layout before the first switch: Plus in ios/, nothing parked.
    expect(planIosSwitch({ active: 'plus', parked: none }, 'free')).toEqual({
      moves: [{ from: 'ios', to: '.ios-parked/plus' }],
      parked: 'plus',
      restored: false,
    });
  });

  it("parks the other app's project, then brings this app's back", () => {
    expect(planIosSwitch({ active: 'free', parked: { free: false, plus: true } }, 'plus')).toEqual({
      moves: [
        { from: 'ios', to: '.ios-parked/free' },
        { from: '.ios-parked/plus', to: 'ios' },
      ],
      parked: 'free',
      restored: true,
    });
  });

  it('brings a parked project back when ios/ is gone', () => {
    expect(planIosSwitch({ active: null, parked: { free: true, plus: false } }, 'free')).toEqual({
      moves: [{ from: '.ios-parked/free', to: 'ios' }],
      parked: null,
      restored: true,
    });
  });

  it('never renames over a project', () => {
    // ios/ is Win Zero, and an older Win Zero project is already parked.
    expect(() => planIosSwitch({ active: 'free', parked: { free: true, plus: true } }, 'plus')).toThrow(
      "ios/ holds Win Zero's Xcode project, and so does .ios-parked/free/",
    );
    // ios/ is already Plus, and so is .ios-parked/plus.
    expect(() => planIosSwitch({ active: 'plus', parked: { free: false, plus: true } }, 'plus')).toThrow(
      "Both ios/ and .ios-parked/plus/ hold Win Zero Plus's Xcode project",
    );
  });

  it('refuses a folder marked for neither app', () => {
    expect(() => planIosSwitch({ active: 'pro', parked: none }, 'free')).toThrow('ios/ is marked as "pro"');
    expect(() => planIosSwitch({ active: null, parked: none }, 'pro' as 'free')).toThrow('No app called "pro"');
  });
});

/** Info.plist as prebuild writes it for Win Zero Plus (trimmed). */
const PLIST = [
  '<dict>',
  '\t<key>CFBundleDisplayName</key>',
  '\t<string>Win Zero Plus</string>',
  '\t<key>CFBundleShortVersionString</key>',
  '\t<string>1.0.3</string>',
  '\t<key>CFBundleURLTypes</key>',
  '\t<array><dict><key>CFBundleURLSchemes</key><array><string>winzeroplus</string></array></dict></array>',
  '\t<key>CFBundleVersion</key>',
  '\t<string>1</string>',
  '</dict>',
].join('\n');

/** The app target's two build configs in project.pbxproj (trimmed). */
const PBXPROJ = ['Debug', 'Release']
  .map((name) =>
    [
      '\t\t\tbuildSettings = {',
      '\t\t\t\tCURRENT_PROJECT_VERSION = 7;',
      '\t\t\t\tDEVELOPMENT_TEAM = UPCQA84MG4;',
      '\t\t\t\tMARKETING_VERSION = 1.0;',
      '\t\t\t};',
      `\t\t\tname = ${name};`,
    ].join('\n'),
  )
  .join('\n');

describe('pointVersionsAtSettings', () => {
  it("points the version and build number at Xcode's build settings", () => {
    const { plist, version } = pointVersionsAtSettings(PLIST);
    expect(version).toBe('1.0.3');
    expect(plist).toContain('<key>CFBundleShortVersionString</key>\n\t<string>$(MARKETING_VERSION)</string>');
    expect(plist).toContain('<key>CFBundleVersion</key>\n\t<string>$(CURRENT_PROJECT_VERSION)</string>');
    // Nothing else changes.
    expect(plist.replace('$(MARKETING_VERSION)', '1.0.3').replace('$(CURRENT_PROJECT_VERSION)', '1')).toBe(PLIST);
  });

  it("refuses a plist prebuild didn't just write, which would point the version at itself", () => {
    const { plist } = pointVersionsAtSettings(PLIST);
    expect(() => pointVersionsAtSettings(plist)).toThrow('$(MARKETING_VERSION)');
  });

  it('fails loudly if the template stops naming them', () => {
    expect(() => pointVersionsAtSettings('<dict></dict>')).toThrow('CFBundleShortVersionString');
    expect(() => pointVersionsAtSettings(PLIST.replace('CFBundleVersion', 'CFBundleBuild'))).toThrow('CFBundleVersion');
  });
});

describe('setMarketingVersion', () => {
  it('sets the version in every config and leaves the build number alone', () => {
    const out = setMarketingVersion(PBXPROJ, '1.1.3');
    expect(out.match(/MARKETING_VERSION = 1\.1\.3;/g)).toHaveLength(2);
    expect(out.match(/CURRENT_PROJECT_VERSION = 7;/g)).toHaveLength(2);
    expect(out.replaceAll('MARKETING_VERSION = 1.1.3;', 'MARKETING_VERSION = 1.0;')).toBe(PBXPROJ);
    expect(setMarketingVersion(out, '1.1.3')).toBe(out);
  });

  it('quotes a version pbxproj would otherwise misread', () => {
    expect(setMarketingVersion(PBXPROJ, '1.2.0 beta')).toContain('MARKETING_VERSION = "1.2.0 beta";');
  });

  it('fails loudly without a MARKETING_VERSION', () => {
    expect(() => setMarketingVersion('buildSettings = {};', '1.1.3')).toThrow('MARKETING_VERSION');
  });
});
