// Fonts load once, after saved settings, in the weight Bold text asks for: the app's switch or
// iOS's own Bold Text.
import { beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { renderHook, waitFor } from '@testing-library/react-native';
import { loadAsync } from 'expo-font';
import { AccessibilityInfo } from 'react-native';

import { appStore } from '@/store';
import { DEFAULT_PERSISTED } from '@/store/migrate';
import { boldFontAssets, fontAssets } from '@/theme/fonts';

import { boldAtLaunch, useAppFonts } from '../useAppFonts';

jest.mock('expo-font', () => ({ loadAsync: jest.fn(() => Promise.resolve()) }));

const load = loadAsync as jest.MockedFunction<typeof loadAsync>;

beforeAll(async () => {
  for (let i = 0; i < 50 && !appStore.getState().hydrated; i++) await new Promise((r) => setTimeout(r, 0));
});

beforeEach(() => {
  load.mockClear();
  appStore.setState({ ...DEFAULT_PERSISTED });
  jest.spyOn(AccessibilityInfo, 'isBoldTextEnabled').mockResolvedValue(false);
});

describe('useAppFonts', () => {
  it('loads the usual weights by default', async () => {
    const { result } = await renderHook(() => useAppFonts());
    await waitFor(() => expect(result.current).toEqual([true, null]));
    expect(load).toHaveBeenCalledTimes(1);
    expect(load).toHaveBeenCalledWith(fontAssets);
    expect(boldAtLaunch()).toBe(false);
  });

  it('loads the heavier set with Bold text on in Settings', async () => {
    appStore.getState().setPref('boldText', true);
    const { result } = await renderHook(() => useAppFonts());
    await waitFor(() => expect(result.current[0]).toBe(true));
    expect(load).toHaveBeenCalledWith(boldFontAssets);
    expect(boldAtLaunch()).toBe(true);
  });

  it("follows iOS's Bold Text too", async () => {
    jest.spyOn(AccessibilityInfo, 'isBoldTextEnabled').mockResolvedValue(true);
    const { result } = await renderHook(() => useAppFonts());
    await waitFor(() => expect(result.current[0]).toBe(true));
    expect(load).toHaveBeenCalledWith(boldFontAssets);
  });

  it('reports a font that failed, so the app goes on with system fonts', async () => {
    load.mockRejectedValueOnce(new Error('no font'));
    const { result } = await renderHook(() => useAppFonts());
    await waitFor(() => expect(result.current[1]?.message).toBe('no font'));
    expect(result.current[0]).toBe(false);
  });
});
