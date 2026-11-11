// Sending the share card (SPEC 9): on Android through the share-image module, with the file's
// content URI and the type; the words instead when the module isn't in the build or the card fails.
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { Platform, Share } from 'react-native';

import { sendCard } from '../share/send';

const mockShare = { module: null as null | { shareAsync: jest.Mock<(uri: string, type: string, title: string) => Promise<void>> } };
jest.mock('../../../modules/share-image', () => ({
  __esModule: true,
  get default() {
    return mockShare.module;
  },
}));
jest.mock('expo-file-system', () => ({
  Paths: { cache: {} },
  File: class {
    uri = 'file:///cache/win-zero-milestone.png';
    contentUri = 'content://com.e7systems.winzeroplus.FileSystemFileProvider/cached_expo_files/win-zero-milestone.png';
    create() {}
    write() {}
  },
}));

const PNG = new Uint8Array([137, 80, 78, 71]);

afterEach(() => {
  jest.restoreAllMocks();
  mockShare.module = null;
});

describe('sendCard on Android', () => {
  it('hands the card to the chooser through the share-image module', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    mockShare.module = { shareAsync: jest.fn(async () => {}) };
    const words = jest.spyOn(Share, 'share');
    expect(await sendCard(PNG, 'Day 7 on Win Zero Plus: 7 zeros down.')).toBe('card');
    expect(mockShare.module.shareAsync).toHaveBeenCalledWith(
      'content://com.e7systems.winzeroplus.FileSystemFileProvider/cached_expo_files/win-zero-milestone.png',
      'image/png',
      'Share your milestone',
    );
    expect(words).not.toHaveBeenCalled();
  });

  it('shares the words in a build without the module, or when the chooser fails', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    const words = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' });
    expect(await sendCard(PNG, 'Day 7 on Win Zero Plus: 7 zeros down.')).toBe('text');
    mockShare.module = { shareAsync: jest.fn(async () => Promise.reject(new Error('no activity'))) };
    expect(await sendCard(PNG, 'Day 7 on Win Zero Plus: 7 zeros down.')).toBe('text');
    expect(words).toHaveBeenCalledTimes(2);
    expect(words).toHaveBeenCalledWith({ message: 'Day 7 on Win Zero Plus: 7 zeros down.' });
  });

  it('shares the words when there is no card', async () => {
    const words = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' });
    expect(await sendCard(null, 'Day 7.')).toBe('text');
    expect(words).toHaveBeenCalledWith({ message: 'Day 7.' });
  });
});
