// Android: the move goes in the link, by an intent aimed at the other app's own activity, and a
// refused launch means it isn't installed.
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { startActivityAsync } from 'expo-intent-launcher';

import { LAUNCH_SETTLE_MS, transport } from '../transport.android';

jest.mock('expo-intent-launcher', () => ({ startActivityAsync: jest.fn() }));
const launch = jest.mocked(startActivityAsync);

const ID = 'aaaa-1111';
const PAYLOAD = 'wz1.eJyrVkrOz0nLs1K-AQA';

afterEach(() => {
  launch.mockReset();
  jest.useRealTimers();
});

describe('sending (Win Zero)', () => {
  it('hands the move to Plus’s own activity, in a task of its own', async () => {
    launch.mockResolvedValue({ resultCode: 0 });
    expect(await transport.send(ID, PAYLOAD)).toBe('opened');
    expect(launch).toHaveBeenCalledWith('android.intent.action.VIEW', {
      packageName: 'com.e7systems.winzeroplus',
      className: 'com.e7systems.winzeroplus.MainActivity',
      data: `winzeroplus://import?t=${ID}&d=${PAYLOAD}`,
      flags: 0x10000000,
    });
  });

  it('reads a refused launch as Plus not installed', async () => {
    launch.mockRejectedValue(new Error('No Activity found to handle Intent'));
    expect(await transport.send(ID, PAYLOAD)).toBe('not-installed');
  });

  it('doesn’t wait on a launch that never answers', async () => {
    jest.useFakeTimers();
    launch.mockReturnValue(new Promise(() => {}));
    const sent = transport.send(ID, PAYLOAD);
    await jest.advanceTimersByTimeAsync(LAUNCH_SETTLE_MS);
    expect(await sent).toBe('opened');
  });
});

describe('receiving (Win Zero Plus)', () => {
  it('takes the move from the link, with nothing left to clear away', () => {
    expect(transport.receive({ t: ID, d: PAYLOAD })).toBe(PAYLOAD);
    expect(transport.receive({ t: ID, d: null })).toBeNull();
    expect(transport.handedOver(ID)).toBe(true);
  });

  it('tells the other app the move arrived, the same way', async () => {
    launch.mockRejectedValue(new Error('gone'));
    await expect(transport.acknowledge(ID)).resolves.toBeUndefined();
    expect(launch.mock.calls[0]?.[1]).toMatchObject({ data: `winzeroplus://moved?t=${ID}` });
  });
});
