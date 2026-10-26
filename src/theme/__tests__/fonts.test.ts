// The app's fonts, and their heavier set for Bold text: the same family names, heavier files.
import { describe, expect, it, jest } from '@jest/globals';

import { boldFontAssets, fontAssets, fontAssetsFor } from '../fonts';
import { fonts } from '../tokens';

// Every asset is the number 1 under jest, so each file gets its name here.
jest.mock('@expo-google-fonts/bungee/400Regular', () => ({ Bungee_400Regular: 'Bungee 400' }));
jest.mock('@expo-google-fonts/barlow/400Regular', () => ({ Barlow_400Regular: 'Barlow 400' }));
jest.mock('@expo-google-fonts/barlow/500Medium', () => ({ Barlow_500Medium: 'Barlow 500' }));
jest.mock('@expo-google-fonts/barlow/600SemiBold', () => ({ Barlow_600SemiBold: 'Barlow 600' }));
jest.mock('@expo-google-fonts/barlow/700Bold', () => ({ Barlow_700Bold: 'Barlow 700' }));
jest.mock('@expo-google-fonts/barlow/800ExtraBold', () => ({ Barlow_800ExtraBold: 'Barlow 800' }));
jest.mock('@expo-google-fonts/jetbrains-mono/500Medium', () => ({ JetBrainsMono_500Medium: 'Mono 500' }));
jest.mock('@expo-google-fonts/jetbrains-mono/600SemiBold', () => ({ JetBrainsMono_600SemiBold: 'Mono 600' }));
jest.mock('@expo-google-fonts/jetbrains-mono/700Bold', () => ({ JetBrainsMono_700Bold: 'Mono 700' }));
jest.mock('@expo-google-fonts/jetbrains-mono/800ExtraBold', () => ({ JetBrainsMono_800ExtraBold: 'Mono 800' }));

describe('fonts', () => {
  it('load every family the styles name, either way', () => {
    const names = Object.values(fonts).sort();
    expect(Object.keys(fontAssetsFor(false)).sort()).toEqual(names);
    expect(Object.keys(fontAssetsFor(true)).sort()).toEqual(names);
  });

  it('are the usual weights without Bold text', () => {
    expect(fontAssetsFor(false)).toBe(fontAssets);
    expect(fontAssets).toEqual({
      Bungee_400Regular: 'Bungee 400',
      Barlow_400Regular: 'Barlow 400',
      Barlow_500Medium: 'Barlow 500',
      Barlow_600SemiBold: 'Barlow 600',
      Barlow_700Bold: 'Barlow 700',
      JetBrainsMono_500Medium: 'Mono 500',
      JetBrainsMono_600SemiBold: 'Mono 600',
    });
  });

  it('step each weight up for Bold text, but Bungee, which has only one', () => {
    expect(fontAssetsFor(true)).toBe(boldFontAssets);
    expect(boldFontAssets).toEqual({
      Bungee_400Regular: 'Bungee 400',
      Barlow_400Regular: 'Barlow 600',
      Barlow_500Medium: 'Barlow 700',
      Barlow_600SemiBold: 'Barlow 700',
      Barlow_700Bold: 'Barlow 800',
      JetBrainsMono_500Medium: 'Mono 700',
      JetBrainsMono_600SemiBold: 'Mono 800',
    });
  });
});
