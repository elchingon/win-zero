// Links from outside, before the router: a move's links wait in the inbox for the app they're
// meant for, a move link for the other app lands on Home, and every other link goes on as it came.
import { afterEach, describe, expect, it, jest } from '@jest/globals';

type Intent = typeof import('@/app/+native-intent');
type Inbox = typeof import('../inbox');

const saved = process.env.EXPO_PUBLIC_APP_VARIANT;
afterEach(() => {
  if (saved === undefined) delete process.env.EXPO_PUBLIC_APP_VARIANT;
  else process.env.EXPO_PUBLIC_APP_VARIANT = saved;
});

/** The app as `variant` builds it, with its own inbox. */
function load(variant: 'free' | 'plus'): { redirect: Intent['redirectSystemPath']; inbox: Inbox; deliver: jest.Mock } {
  process.env.EXPO_PUBLIC_APP_VARIANT = variant;
  let intent: Intent | undefined;
  let inbox: Inbox | undefined;
  jest.isolateModules(() => {
    inbox = require('../inbox');
    intent = require('@/app/+native-intent');
  });
  const deliver = jest.spyOn(inbox!, 'deliver') as unknown as jest.Mock;
  return { redirect: (e) => intent!.redirectSystemPath(e), inbox: inbox!, deliver };
}

const ID = 'aaaa-1111-bbbb';
const IMPORT = `winzeroplus://import?t=${ID}&d=wz1.eJyrVkrOz0nLs1K-AQA`;
const MOVED = `winzero://moved?t=${ID}`;

describe('in Win Zero Plus', () => {
  it('takes a move in at /import, leaving the move itself out of the route', () => {
    const { redirect, inbox } = load('plus');
    expect(redirect({ path: IMPORT, initial: true })).toBe('/import');
    expect(inbox.importDelivery()).toMatchObject({ t: ID, d: 'wz1.eJyrVkrOz0nLs1K-AQA' });
  });

  it('sends a confirmation meant for Win Zero Home, without acting on it', () => {
    const { redirect, deliver } = load('plus');
    expect(redirect({ path: MOVED, initial: false })).toBe('/');
    expect(deliver).not.toHaveBeenCalled();
  });
});

describe('in Win Zero', () => {
  it('leaves Plus’s confirmation for the app, and opens Home', () => {
    const { redirect, deliver } = load('free');
    expect(redirect({ path: MOVED, initial: false })).toBe('/');
    expect(deliver).toHaveBeenCalledWith({ kind: 'moved', t: ID });
  });

  it('sends a move meant for Plus Home, without taking it in', () => {
    const { redirect, inbox } = load('free');
    expect(redirect({ path: IMPORT, initial: true })).toBe('/');
    expect(inbox.importDelivery()).toBeNull();
  });
});

describe('every other link', () => {
  it('goes on as it came, whichever app', () => {
    for (const variant of ['free', 'plus'] as const) {
      const { redirect, deliver } = load(variant);
      for (const path of ['winzero://play?practice=60', '/notice?goal=g1', 'winzeroplus://import?t=../x', '']) {
        expect(redirect({ path, initial: true })).toBe(path);
      }
      expect(deliver).not.toHaveBeenCalled();
    }
  });
});
