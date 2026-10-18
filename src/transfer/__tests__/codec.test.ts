// The move's wire format: what goes in comes out, nothing too big gets in either way, and any
// damage is caught rather than read as different data.
import { describe, expect, it } from '@jest/globals';
import { zlibSync } from 'fflate';

import {
  decodeMove,
  encodeMove,
  fromBase64Url,
  MAX_JSON_BYTES,
  MAX_PAYLOAD_CHARS,
  MOVE_PREFIX,
  MoveCodecError,
  toBase64Url,
  type MoveCodecFailure,
} from '../codec';

function reasonOf(fn: () => unknown): MoveCodecFailure | 'none' | 'other' {
  try {
    fn();
    return 'none';
  } catch (error) {
    return error instanceof MoveCodecError ? error.reason : 'other';
  }
}

/** Bytes that don't compress, from a fixed seed. */
function noise(n: number, seed = 7): Uint8Array {
  const out = new Uint8Array(n);
  let x = seed;
  for (let i = 0; i < n; i++) {
    x = (Math.imul(x, 1103515245) + 12345) >>> 0;
    out[i] = x >>> 24;
  }
  return out;
}

const SAMPLE = JSON.stringify({ goal: 'Stop drinking 🍷 → café', days: Array.from({ length: 200 }, (_, i) => i) });

describe('base64url', () => {
  it('round-trips every length, with no padding', () => {
    for (let n = 0; n < 40; n++) {
      const bytes = noise(n, n + 1);
      const text = toBase64Url(bytes);
      expect(text).toMatch(/^[A-Za-z0-9_-]*$/);
      expect(fromBase64Url(text)).toEqual(bytes);
    }
  });

  it('refuses characters outside the alphabet, and lengths no encoding makes', () => {
    expect(reasonOf(() => fromBase64Url('ab+c'))).toBe('corrupt');
    expect(reasonOf(() => fromBase64Url('ab=='))).toBe('corrupt');
    expect(reasonOf(() => fromBase64Url('abcde'))).toBe('corrupt');
  });
});

describe('encodeMove and decodeMove', () => {
  it('round-trips, emoji and accents included', () => {
    const text = encodeMove(SAMPLE);
    expect(text.startsWith(MOVE_PREFIX)).toBe(true);
    expect(text.slice(MOVE_PREFIX.length)).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeMove(text)).toBe(SAMPLE);
    expect(decodeMove(encodeMove(''))).toBe('');
  });

  it('compresses', () => {
    expect(encodeMove(SAMPLE).length).toBeLessThan(SAMPLE.length);
  });

  it('refuses to encode past either cap', () => {
    expect(reasonOf(() => encodeMove('x'.repeat(MAX_JSON_BYTES + 1)))).toBe('too-large');
    // Incompressible: the encoded text outgrows the link.
    const random = JSON.stringify(toBase64Url(noise(MAX_PAYLOAD_CHARS)));
    expect(reasonOf(() => encodeMove(random))).toBe('too-large');
  });

  it('refuses text that is not a move, or too long to be one', () => {
    expect(reasonOf(() => decodeMove('{"kind":"winzero.move"}'))).toBe('not-a-move');
    expect(reasonOf(() => decodeMove('wz2.abcd'))).toBe('not-a-move');
    expect(reasonOf(() => decodeMove(MOVE_PREFIX + 'A'.repeat(MAX_PAYLOAD_CHARS)))).toBe('too-large');
  });

  it('stops a zip bomb at the cap', () => {
    const bomb = MOVE_PREFIX + toBase64Url(zlibSync(new Uint8Array(MAX_JSON_BYTES + 1), { level: 9 }));
    expect(bomb.length).toBeLessThan(MAX_PAYLOAD_CHARS);
    expect(reasonOf(() => decodeMove(bomb))).toBe('too-large');
  });

  it('catches a change to any character', () => {
    const text = encodeMove(SAMPLE);
    // The last character can carry unused bits, so stop short of it.
    for (let i = MOVE_PREFIX.length; i < text.length - 1; i++) {
      const swapped = text[i] === 'A' ? 'B' : 'A';
      const damaged = text.slice(0, i) + swapped + text.slice(i + 1);
      expect([i, reasonOf(() => decodeMove(damaged))]).toEqual([i, 'corrupt']);
    }
  });

  it('catches truncation, and a missing or broken zlib header', () => {
    const text = encodeMove(SAMPLE);
    for (const cut of [1, 4, 10, Math.floor(text.length / 2)]) {
      expect(reasonOf(() => decodeMove(text.slice(0, text.length - cut)))).toBe('corrupt');
    }
    expect(reasonOf(() => decodeMove(MOVE_PREFIX))).toBe('corrupt');
    const raw = fromBase64Url(text.slice(MOVE_PREFIX.length));
    const headerless = raw.slice();
    headerless[0] = 0x79; // not deflate
    expect(reasonOf(() => decodeMove(MOVE_PREFIX + toBase64Url(headerless)))).toBe('corrupt');
  });
});
