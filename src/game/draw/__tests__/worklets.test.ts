// The scene drawing runs inside the frame callback on the UI thread, so like the sim it must be
// worklets all the way down. Skia comes in as types only (the kit hands over Skia objects).
import { describe, expect, it } from '@jest/globals';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const DRAW_DIR = join(__dirname, '..');

const sources = readdirSync(DRAW_DIR)
  .filter((f) => f.endsWith('.ts'))
  .map((f) => ({ file: f, code: readFileSync(join(DRAW_DIR, f), 'utf8') }));

type MaybeWorklet = { __workletHash?: number; __closure?: Record<string, unknown> };

function nonWorklets(fn: unknown, name: string, seen = new Set<unknown>()): string[] {
  if (typeof fn !== 'function' || seen.has(fn)) return [];
  seen.add(fn);
  const w = fn as MaybeWorklet;
  if (!w.__workletHash) return [name];
  return Object.entries(w.__closure ?? {}).flatMap(([k, v]) => nonWorklets(v, `${name} → ${k}`, seen));
}

describe('draw worklets', () => {
  it('has source files to check', () => {
    expect(sources.length).toBeGreaterThan(2);
  });

  it.each(sources)('$file is a worklet file', ({ code }) => {
    expect(code.replace(/^\s*(\/\/.*\n)*/, '').startsWith("'worklet';")).toBe(true);
  });

  it.each(sources)('$file imports Skia as types only, and otherwise only draw and sim modules', ({ code }) => {
    for (const m of code.matchAll(/import\s+(type\s+)?[^'"]*from\s+['"]([^'"]+)['"]/g)) {
      const typeOnly = !!m[1];
      const spec = m[2] ?? '';
      if (spec === '@shopify/react-native-skia') expect(typeOnly).toBe(true);
      else expect(spec.startsWith('./') || spec.startsWith('../sim/')).toBe(true);
    }
  });

  it.each(sources)('$file exports only worklets', ({ file }) => {
    const mod = require(join(DRAW_DIR, file)) as Record<string, unknown>;
    expect(Object.entries(mod).flatMap(([name, value]) => nonWorklets(value, name))).toEqual([]);
  });
});
