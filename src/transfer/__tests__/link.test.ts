// The move's links are built and read strictly: anything else is left for the router.
import { describe, expect, it } from '@jest/globals';

import { importLink, movedLink, parseLink } from '../link';

const ID = '0f8e2b1c-5d4a-4b3e-9a7f-1c2d3e4f5a6b';
const DATA = 'wz1.eJyrVkrOz0nLs1K-AQA';

describe('importLink and movedLink', () => {
  it('round-trip through parseLink', () => {
    expect(parseLink(importLink('winzeroplus', ID))).toEqual({ kind: 'import', t: ID, d: null });
    expect(parseLink(importLink('winzeroplus', ID, DATA))).toEqual({ kind: 'import', t: ID, d: DATA });
    expect(parseLink(movedLink('winzero', ID))).toEqual({ kind: 'moved', t: ID });
  });

  it('put only the id in the link unless the move is given', () => {
    expect(importLink('winzeroplus', ID)).toBe(`winzeroplus://import?t=${ID}`);
    expect(movedLink('winzero', ID)).toBe(`winzero://moved?t=${ID}`);
  });
});

describe('parseLink', () => {
  it('reads the route with or without a scheme, and the query in any order', () => {
    expect(parseLink(`/import?d=${DATA}&t=${ID}`)).toEqual({ kind: 'import', t: ID, d: DATA });
    expect(parseLink(`winzeroplus:///import/?t=${ID}`)).toEqual({ kind: 'import', t: ID, d: null });
    expect(parseLink(`exp+win-zero://moved?t=${ID}&extra=1`)).toEqual({ kind: 'moved', t: ID });
  });

  it('refuses an id that could name another file, or none', () => {
    for (const t of ['../secrets', 'a/b/c/d/e', 'with space', '', 'x'.repeat(65), 'id%2F..%2Fx']) {
      expect(parseLink(`winzeroplus://import?t=${t}`)).toBeNull();
    }
    expect(parseLink('winzeroplus://import')).toBeNull();
  });

  it('refuses data that is not a move', () => {
    expect(parseLink(`winzeroplus://import?t=${ID}&d=hello`)).toBeNull();
    expect(parseLink(`winzeroplus://import?t=${ID}&d=wz1.abc%2Bdef`)).toBeNull();
    expect(parseLink(`winzeroplus://import?t=${ID}&d=%E0%A4%A`)).toBeNull();
  });

  it('leaves every other link alone', () => {
    for (const url of [
      'winzeroplus://play?practice=60',
      '/notice?goal=g1',
      'winzero://',
      'https://winzero.app/import?t=' + ID,
      'winzero://importer?t=' + ID,
      '',
    ]) {
      expect(parseLink(url)).toBeNull();
    }
  });
});
