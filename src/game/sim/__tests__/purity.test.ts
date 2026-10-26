// The sim runs on the UI thread as worklets, so every file (game modes' subfolders too) must be
// a worklet file that imports only sim modules and engine constants, never reads the clock or
// Math.random, and every function it exports (and every function those capture) must be a
// worklet. Jest runs everything on one thread, so a missed directive would only show up as a
// crash on a device.
import { describe, expect, it } from '@jest/globals';
import { dirname, join, relative, resolve, sep } from 'node:path';

import { importCycles, importGraph, nonWorklets, sourceFiles, specifiers } from '../../__tests__/workletSources';

const SIM_DIR = join(__dirname, '..');

const sources = sourceFiles(SIM_DIR);

/** A relative import that stays inside the sim folder (and out of its tests). */
function insideSim(file: string, spec: string): boolean {
  if (!spec.startsWith('./') && !spec.startsWith('../')) return false;
  const rel = relative(SIM_DIR, resolve(dirname(join(SIM_DIR, file)), spec));
  return !rel.startsWith('..') && !rel.split(sep).includes('__tests__');
}

const fromEngine = (spec: string) => spec === '@/engine' || (spec.startsWith('@/engine/') && !spec.includes('__tests__'));

describe('sim purity', () => {
  it('has source files to check', () => {
    expect(sources.length).toBeGreaterThan(4);
  });

  it.each(sources)('$file is a worklet file', ({ code }) => {
    expect(code.replace(/^\s*(\/\/.*\n)*/, '').startsWith("'worklet';")).toBe(true);
  });

  it.each(sources)('$file imports only sim modules and the engine', ({ file, code }) => {
    for (const spec of specifiers(code)) {
      expect({ spec, ok: insideSim(file, spec) || fromEngine(spec) }).toEqual({ spec, ok: true });
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

  // A worklet binds its imports when its module loads, so in an import cycle one side would
  // capture nothing, on a device as in whichever order a test happens to load them.
  it('imports in no circles', () => {
    const graph = importGraph([SIM_DIR]);
    expect([...graph.values()].flat().length).toBeGreaterThan(0);
    expect(importCycles(graph, SIM_DIR)).toEqual([]);
  });

  it('would see a circle if there were one', () => {
    const graph = new Map([
      [join(SIM_DIR, 'a.ts'), [join(SIM_DIR, 'b.ts')]],
      [join(SIM_DIR, 'b.ts'), [join(SIM_DIR, 'c.ts')]],
      [join(SIM_DIR, 'c.ts'), [join(SIM_DIR, 'a.ts')]],
    ]);
    expect(importCycles(graph, SIM_DIR)).toEqual([['a.ts', 'b.ts', 'c.ts', 'a.ts']]);
  });
});
