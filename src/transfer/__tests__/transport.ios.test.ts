// iPhone: the move waits in the shared folder and the link names only its id; with no shared
// folder, only a development build puts the move in the link.
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Linking } from 'react-native';

import { transport } from '../transport.ios';

/** An in-memory stand-in for expo-file-system's shared folders. */
const mockFs: { files: Map<string, string>; containers: Record<string, { uri: string }> } = {
  files: new Map(),
  containers: {},
};
jest.mock('expo-file-system', () => {
  class File {
    uri: string;
    constructor(dir: { uri: string }, name: string) {
      this.uri = `${dir.uri}/${name}`;
    }
    get exists() {
      return mockFs.files.has(this.uri);
    }
    create(opts?: { overwrite?: boolean }) {
      if (mockFs.files.has(this.uri) && !opts?.overwrite) throw new Error('exists');
      mockFs.files.set(this.uri, '');
    }
    write(text: string) {
      mockFs.files.set(this.uri, text);
    }
    textSync() {
      const text = mockFs.files.get(this.uri);
      if (text === undefined) throw new Error('missing');
      return text;
    }
    delete() {
      if (!mockFs.files.delete(this.uri)) throw new Error('missing');
    }
  }
  return { File, Paths: { get appleSharedContainers() { return mockFs.containers; } } };
});

const ID = 'aaaa-1111';
const PAYLOAD = 'wz1.eJyrVkrOz0nLs1K-AQA';
const GROUP = { 'group.com.e7systems.winzero': { uri: 'file:///shared' } };
const FILE = `file:///shared/move-${ID}.wz1`;
const dev = __DEV__;
/** Runs the code as a release build would (`__DEV__` is read when each call runs). */
const setDev = (value: boolean) => {
  (globalThis as unknown as { __DEV__: boolean }).__DEV__ = value;
};

beforeEach(() => {
  mockFs.files.clear();
  mockFs.containers = GROUP;
});

afterEach(() => {
  jest.restoreAllMocks();
  setDev(dev);
});

describe('sending (Win Zero)', () => {
  it('leaves the move in the shared folder and opens Plus with only its id', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    expect(await transport.send(ID, PAYLOAD)).toBe('opened');
    expect(open).toHaveBeenCalledWith(`winzeroplus://import?t=${ID}`);
    expect(mockFs.files.get(FILE)).toBe(PAYLOAD);
    expect(transport.handedOver(ID)).toBe(false);
  });

  it('writes over a move left from an earlier try', async () => {
    jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    mockFs.files.set(FILE, 'wz1.older');
    await transport.send(ID, PAYLOAD);
    expect(mockFs.files.get(FILE)).toBe(PAYLOAD);
  });

  it('takes the move back when Plus isn’t installed', async () => {
    jest.spyOn(Linking, 'openURL').mockRejectedValue(new Error('Unable to open URL'));
    expect(await transport.send(ID, PAYLOAD)).toBe('not-installed');
    expect(mockFs.files.has(FILE)).toBe(false);
  });

  it('without the shared folder, sends the move in the link in development only', async () => {
    mockFs.containers = {};
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    expect(await transport.send(ID, PAYLOAD)).toBe('opened');
    expect(open).toHaveBeenCalledWith(`winzeroplus://import?t=${ID}&d=${PAYLOAD}`);

    setDev(false);
    open.mockClear();
    expect(await transport.send(ID, PAYLOAD)).toBe('failed');
    expect(open).not.toHaveBeenCalled();
  });
});

describe('receiving (Win Zero Plus)', () => {
  it('reads the move its link names, and counts it handed over once cleared away', () => {
    mockFs.files.set(FILE, PAYLOAD);
    expect(transport.receive({ t: ID, d: null })).toBe(PAYLOAD);
    expect(transport.receive({ t: 'bbbb-2222', d: null })).toBeNull();
    transport.discard(ID);
    expect(transport.handedOver(ID)).toBe(true);
    transport.discard(ID); // nothing left: no harm
  });

  it('takes a move in the link in development only', () => {
    expect(transport.receive({ t: ID, d: PAYLOAD })).toBe(PAYLOAD);
    setDev(false);
    expect(transport.receive({ t: ID, d: PAYLOAD })).toBeNull();
    mockFs.files.set(FILE, 'wz1.fromTheFolder');
    expect(transport.receive({ t: ID, d: PAYLOAD })).toBe('wz1.fromTheFolder');
  });

  it('tells Win Zero the move arrived, and shrugs off a failure', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockRejectedValue(new Error('no'));
    await expect(transport.acknowledge(ID)).resolves.toBeUndefined();
    // Tests run as Win Zero, whose other app is Plus: the scheme is the other app's.
    expect(open).toHaveBeenCalledWith(`winzeroplus://moved?t=${ID}`);
  });
});
