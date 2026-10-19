// The scene drawing runs inside the frame callback on the UI thread, so like the sim it must be
// worklets all the way down, game modes' subfolders too. Skia comes in as types only (the kit
// hands over Skia objects).
import { describe, expect, it } from '@jest/globals';
import { dirname, join, relative, resolve, sep } from 'node:path';

import { nonWorklets, sourceFiles } from '../../__tests__/workletSources';

const DRAW_DIR = join(__dirname, '..');
const SIM_DIR = join(DRAW_DIR, '..', 'sim');

const sources = sourceFiles(DRAW_DIR);

/** A relative import into the draw or sim folders (and out of their tests). */
function inside(file: string, spec: string): boolean {
  if (!spec.startsWith('./') && !spec.startsWith('../')) return false;
  const target = resolve(dirname(join(DRAW_DIR, file)), spec);
  return [DRAW_DIR, SIM_DIR].some((dir) => {
    const rel = relative(dir, target);
    return !rel.startsWith('..') && !rel.split(sep).includes('__tests__');
  });
}

describe('draw worklets', () => {
  it('has source files to check', () => {
    expect(sources.length).toBeGreaterThan(2);
  });

  it.each(sources)('$file is a worklet file', ({ code }) => {
    expect(code.replace(/^\s*(\/\/.*\n)*/, '').startsWith("'worklet';")).toBe(true);
  });

  it.each(sources)('$file imports Skia as types only, and otherwise only draw and sim modules', ({ file, code }) => {
    for (const m of code.matchAll(/(?:import|export)\s+(type\s+)?[\w*\s{},]*?from\s+['"]([^'"]+)['"]/g)) {
      const typeOnly = !!m[1];
      const spec = m[2] ?? '';
      const ok = spec === '@shopify/react-native-skia' ? typeOnly : inside(file, spec);
      expect({ spec, ok }).toEqual({ spec, ok: true });
    }
  });

  it.each(sources)('$file exports only worklets', ({ file }) => {
    const mod = require(join(DRAW_DIR, file)) as Record<string, unknown>;
    expect(Object.entries(mod).flatMap(([name, value]) => nonWorklets(value, name))).toEqual([]);
  });
});
