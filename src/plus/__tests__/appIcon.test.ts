// The home-screen icon through its one wrapper: the app's own icon is null to the native module, a
// theme's icon is its id, and anything the module reports that the app doesn't know reads as its own.
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import AppIcons from '../../../modules/app-icons';
import { currentIcon, iconSwitching, setIcon } from '../appIcon';

beforeEach(async () => {
  await AppIcons.setIconAsync(null);
});

describe('the app icon wrapper', () => {
  it('starts on the app’s own icon', async () => {
    expect(await currentIcon()).toBe('default');
    expect(await iconSwitching()).toBe(true);
  });

  it('switches to a theme’s icon and back', async () => {
    expect(await setIcon('ember')).toBe('ember');
    expect(AppIcons.setIconAsync).toHaveBeenLastCalledWith('ember');
    expect(await currentIcon()).toBe('ember');
    expect(await setIcon('default')).toBe('default');
    expect(AppIcons.setIconAsync).toHaveBeenLastCalledWith(null);
    expect(await currentIcon()).toBe('default');
  });

  it('reads an icon it doesn’t know as the app’s own', async () => {
    jest.mocked(AppIcons.getIconAsync).mockResolvedValueOnce('spikea');
    expect(await currentIcon()).toBe('default');
  });

  it('passes on a refusal from the phone', async () => {
    jest.mocked(AppIcons.setIconAsync).mockRejectedValueOnce(new Error('no'));
    await expect(setIcon('neon')).rejects.toThrow('no');
    expect(await currentIcon()).toBe('default');
  });
});
