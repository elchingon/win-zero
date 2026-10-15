// The sim runs on the UI thread as worklets, so every file must be a worklet file that imports
// only sim modules and engine constants, never reads the clock or Math.random, and every
// function it exports (and every function those capture) must be a worklet. Jest runs
// everything on one thread, so a missed directive would only show up as a crash on a device.
import { describe, expect, it } from '@jest/globals';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const SIM_DIR = join(__dirname, '..');

const sources = readdirSync(SIM_DIR)
  .filter((f) => f.endsWith('.ts'))
  .map((f) => ({ file: f, code: readFileSync(join(SIM_DIR, f), 'utf8') }));

type MaybeWorklet = { __workletHash?: number; __closure?: Record<string, unknown> };

/** Names of functions reachable from `fn` that aren't worklets. */
function nonWorklets(fn: unknown, name: string, seen = new Set<unknown>()): string[] {
  if (typeof fn !== 'function' || seen.has(fn)) return [];
  seen.add(fn);
  const w = fn as MaybeWorklet;
  if (!w.__workletHash) return [name];
  return Object.entries(w.__closure ?? {}).flatMap(([k, v]) => nonWorklets(v, `${name} → ${k}`, seen));
}

describe('sim purity', () => {
  it('has source files to check', () => {
    expect(sources.length).toBeGreaterThan(4);
  });

  it.each(sources)('$file is a worklet file', ({ code }) => {
    expect(code.replace(/^\s*(\/\/.*\n)*/, '').startsWith("'worklet';")).toBe(true);
  });

  it.each(sources)('$file imports only sim modules and the engine', ({ code }) => {
    const specifiers = [...code.matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)].map((m) => m[1] ?? '');
    for (const spec of specifiers) {
      expect(spec.startsWith('./') || spec === '@/engine' || spec.startsWith('@/engine/')).toBe(true);
    }
  });

  it.each(sources)('$file never reads the clock or Math.random', ({ code }) => {
    expect(code).not.toMatch(/Date\.now\s*\(/);
    expect(code).not.toMatch(/new Date\(/);
    expect(code).not.toMatch(/performance\.now\s*\(/);
    expect(code).not.toMatch(/Math\.random\s*\(/);
  });

  it.each(sources)('$file exports only worklets', ({ file }) => {
    const mod = require(join(SIM_DIR, file)) as Record<string, unknown>;
    const bad = Object.entries(mod).flatMap(([name, value]) => nonWorklets(value, name));
    expect(bad).toEqual([]);
  });
});
