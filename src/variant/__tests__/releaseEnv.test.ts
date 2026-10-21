// What a release build carries from its environment (scripts/release-env.cjs).
import { describe, expect, it } from '@jest/globals';

import { checkReleaseEnv } from '../../../scripts/release-env.cjs';

const PAGES = { EXPO_PUBLIC_PRIVACY_URL: 'https://winzero.app/privacy', EXPO_PUBLIC_SUPPORT_URL: 'https://winzero.app/support' };
const APP_STORE = 'https://apps.apple.com/app/id6740000000';
const PLAY = 'https://play.google.com/store/apps/details?id=com.e7systems.winzeroplus';

describe('checkReleaseEnv', () => {
  it('passes a build with its pages set and no Plus store page, and says the move stays hidden', () => {
    expect(checkReleaseEnv(PAGES, { variant: 'free', platform: 'ios' })).toEqual({
      errors: [],
      notes: ['Win Zero hides Move to Win Zero Plus: EXPO_PUBLIC_PLUS_STORE_URL_IOS is empty.'],
    });
    expect(checkReleaseEnv(PAGES, { variant: 'plus', platform: 'android' })).toEqual({
      errors: [],
      notes: ['Win Zero Plus hides Update Win Zero Plus: EXPO_PUBLIC_PLUS_STORE_URL_ANDROID is empty.'],
    });
  });

  it('stops a build without its privacy and support pages, or with pages that are not https', () => {
    const { errors } = checkReleaseEnv(
      { EXPO_PUBLIC_PRIVACY_URL: 'http://winzero.app/privacy', EXPO_PUBLIC_SUPPORT_URL: '  ' },
      { variant: 'plus', platform: 'ios' },
    );
    expect(errors).toEqual([
      'EXPO_PUBLIC_PRIVACY_URL must be its published https page, not "http://winzero.app/privacy".',
      'EXPO_PUBLIC_SUPPORT_URL must be its published https page, not "".',
    ]);
  });

  it("stops the stand-in store page QA uses, which would send Win Zero's move to the website", () => {
    const { errors } = checkReleaseEnv(
      { ...PAGES, EXPO_PUBLIC_PLUS_STORE_URL_IOS: 'https://winzero.app/' },
      { variant: 'free', platform: 'ios' },
    );
    expect(errors).toEqual([
      'EXPO_PUBLIC_PLUS_STORE_URL_IOS is "https://winzero.app/", which isn\'t Win Zero Plus\'s page on the App Store. ' +
        "Set https://apps.apple.com/app/id<Plus's Apple ID>, or leave it empty.",
    ]);
  });

  it('accepts only Win Zero Plus’s own pages, and checks only the platform being built', () => {
    for (const page of [APP_STORE, 'https://apps.apple.com/us/app/win-zero-plus/id6740000000']) {
      expect(checkReleaseEnv({ ...PAGES, EXPO_PUBLIC_PLUS_STORE_URL_IOS: page }, { variant: 'free', platform: 'ios' }).errors).toEqual([]);
    }
    for (const page of [
      'https://apps.apple.com/app/win-zero-plus',
      'http://apps.apple.com/app/id6740000000',
      'https://play.google.com/store/apps/details?id=com.e7systems.winzero',
    ]) {
      const env = { ...PAGES, EXPO_PUBLIC_PLUS_STORE_URL_IOS: page, EXPO_PUBLIC_PLUS_STORE_URL_ANDROID: page };
      expect(checkReleaseEnv(env, { variant: 'free', platform: 'ios' }).errors).toHaveLength(1);
      expect(checkReleaseEnv(env, { variant: 'free', platform: 'android' }).errors).toHaveLength(1);
    }
    // An iOS build doesn't carry the Android page, so a stand-in there doesn't matter to it.
    const env = { ...PAGES, EXPO_PUBLIC_PLUS_STORE_URL_IOS: APP_STORE, EXPO_PUBLIC_PLUS_STORE_URL_ANDROID: 'https://winzero.app/' };
    expect(checkReleaseEnv(env, { variant: 'free', platform: 'ios' }).errors).toEqual([]);
  });

  it('says when Win Zero will offer the move, which waits until Plus is live', () => {
    const env = { ...PAGES, EXPO_PUBLIC_PLUS_STORE_URL_ANDROID: PLAY };
    expect(checkReleaseEnv(env, { variant: 'free', platform: 'android' }).notes).toEqual([
      `Win Zero offers Move to Win Zero Plus, opening ${PLAY} when Plus isn't installed. ` +
        'Release this build only once Win Zero Plus is live on Google Play.',
    ]);
    expect(checkReleaseEnv(env, { variant: 'plus', platform: 'android' }).notes).toEqual([`Update Win Zero Plus opens ${PLAY}.`]);
  });
});
