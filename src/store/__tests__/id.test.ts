import { describe, expect, it } from '@jest/globals';

import { seeded } from '@/engine/__tests__/fixtures';

import { makeId } from '../id';

describe('makeId', () => {
  it('makes v4-format UUIDs that differ', () => {
    const rand = seeded(3);
    const ids = Array.from({ length: 200 }, () => makeId(rand));
    const v4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
    for (const id of ids) expect(id).toMatch(v4);
    expect(new Set(ids).size).toBe(ids.length);
    expect(makeId(() => 0)).toBe('00000000-0000-4000-8000-000000000000');
    expect(makeId(() => 0.999999999999)).toMatch(v4); // never spills a 13th digit
  });
});
