// The move's wire format (SPEC 9): "wz1.", then the JSON compressed with zlib and written in
// base64url, short enough for a link on Android and a small file on iPhone. Both sizes are
// capped, the text and what it expands to, so a hostile link can't run the phone out of memory.
// fflate drops zlib's checksum unread, so this reads the header and the Adler-32 itself.
import { Inflate, strFromU8, strToU8, zlibSync } from 'fflate';

export const MOVE_PREFIX = 'wz1.';
/**
 * Longest encoded move. Android carries it in an intent as UTF-16, well inside the 1 MB binder
 * buffer; 1,000 days of history come to about 25K.
 */
export const MAX_PAYLOAD_CHARS = 128 * 1024;
/** Most a move may expand to. */
export const MAX_JSON_BYTES = 4 * 1024 * 1024;
/** Compressed bytes inflated at a time, so the cap trips before a zip bomb is expanded. */
const INFLATE_SLICE = 1024;
const COMPRESSION_LEVEL = 9;
/** zlib's header (CMF, FLG) and its Adler-32 trailer. */
const ZLIB_HEADER = 2;
const ZLIB_TRAILER = 4;
const ADLER_MOD = 65521;
/** Bytes Adler-32 can sum before its 32-bit accumulators need reducing. */
const ADLER_BLOCK = 5552;

export type MoveCodecFailure = 'not-a-move' | 'too-large' | 'corrupt';

export class MoveCodecError extends Error {
  readonly reason: MoveCodecFailure;
  constructor(reason: MoveCodecFailure) {
    super(`Move data: ${reason}`);
    this.name = 'MoveCodecError';
    this.reason = reason;
  }
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const SEXTET = new Map([...ALPHABET].map((c, i) => [c, i]));

/** base64url, no padding. */
export function toBase64Url(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i]! << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    const left = bytes.length - i;
    out += ALPHABET[(n >> 18) & 63]! + ALPHABET[(n >> 12) & 63]!;
    if (left > 1) out += ALPHABET[(n >> 6) & 63]!;
    if (left > 2) out += ALPHABET[n & 63]!;
  }
  return out;
}

/** Strict base64url: any other character, or a length no encoding gives, is corrupt. */
export function fromBase64Url(text: string): Uint8Array {
  if (text.length % 4 === 1) throw new MoveCodecError('corrupt');
  const out = new Uint8Array(Math.floor((text.length * 3) / 4));
  let o = 0;
  for (let i = 0; i < text.length; i += 4) {
    let n = 0;
    const chunk = Math.min(4, text.length - i);
    for (let j = 0; j < 4; j++) {
      const v = j < chunk ? SEXTET.get(text[i + j]!) : 0;
      if (v === undefined) throw new MoveCodecError('corrupt');
      n = (n << 6) | v;
    }
    out[o++] = (n >> 16) & 255;
    if (chunk > 2) out[o++] = (n >> 8) & 255;
    if (chunk > 3) out[o++] = n & 255;
  }
  return out;
}

function adler32(chunks: readonly Uint8Array[]): number {
  let a = 1;
  let b = 0;
  for (const chunk of chunks) {
    for (let i = 0; i < chunk.length; ) {
      const end = Math.min(i + ADLER_BLOCK, chunk.length);
      for (; i < end; i++) {
        a += chunk[i]!;
        b += a;
      }
      a %= ADLER_MOD;
      b %= ADLER_MOD;
    }
  }
  return ((b << 16) | a) >>> 0;
}

/** JSON text as a move. Throws `too-large` past either cap. */
export function encodeMove(json: string): string {
  const bytes = strToU8(json);
  if (bytes.length > MAX_JSON_BYTES) throw new MoveCodecError('too-large');
  const text = MOVE_PREFIX + toBase64Url(zlibSync(bytes, { level: COMPRESSION_LEVEL }));
  if (text.length > MAX_PAYLOAD_CHARS) throw new MoveCodecError('too-large');
  return text;
}

/** A move back to its JSON text. Throws a MoveCodecError saying why it can't be read. */
export function decodeMove(text: string): string {
  if (typeof text !== 'string' || !text.startsWith(MOVE_PREFIX)) throw new MoveCodecError('not-a-move');
  if (text.length > MAX_PAYLOAD_CHARS) throw new MoveCodecError('too-large');
  const data = fromBase64Url(text.slice(MOVE_PREFIX.length));
  if (data.length < ZLIB_HEADER + ZLIB_TRAILER) throw new MoveCodecError('corrupt');
  const [cmf, flg] = [data[0]!, data[1]!];
  // Deflate, a window zlib allows, a header that checks out, and no preset dictionary.
  if ((cmf & 15) !== 8 || cmf >> 4 > 7 || ((cmf << 8) | flg) % 31 !== 0 || flg & 32) {
    throw new MoveCodecError('corrupt');
  }

  const chunks: Uint8Array[] = [];
  let size = 0;
  const inflate = new Inflate((chunk) => {
    size += chunk.length;
    if (size > MAX_JSON_BYTES) throw new MoveCodecError('too-large');
    chunks.push(chunk);
  });
  const body = data.subarray(ZLIB_HEADER, data.length - ZLIB_TRAILER);
  if (body.length === 0) throw new MoveCodecError('corrupt');
  try {
    for (let i = 0; i < body.length; i += INFLATE_SLICE) {
      inflate.push(body.subarray(i, i + INFLATE_SLICE), i + INFLATE_SLICE >= body.length);
    }
  } catch (error) {
    throw error instanceof MoveCodecError ? error : new MoveCodecError('corrupt');
  }

  const t = data.length - ZLIB_TRAILER;
  const expected = ((data[t]! << 24) | (data[t + 1]! << 16) | (data[t + 2]! << 8) | data[t + 3]!) >>> 0;
  if (adler32(chunks) !== expected) throw new MoveCodecError('corrupt');
  const out = new Uint8Array(size);
  let o = 0;
  for (const chunk of chunks) {
    out.set(chunk, o);
    o += chunk.length;
  }
  return strFromU8(out);
}
