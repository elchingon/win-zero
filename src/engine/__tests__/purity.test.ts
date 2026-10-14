// CLAUDE.md: the engine is pure. No React/Expo/RN imports, and it never reads the clock.
import { describe, expect, it } from '@jest/globals';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ENGINE_DIR = join(__dirname, '..');
const ALLOWED_PACKAGES = new Set(['date-fns', 'date-fns-tz']);

const sources = readdirSync(ENGINE_DIR)
  .filter((f) => f.endsWith('.ts'))
  .map((f) => ({ file: f, code: readFileSync(join(ENGINE_DIR, f), 'utf8') }));

describe('engine purity', () => {
  it('has source files to check', () => {
    expect(sources.length).toBeGreaterThan(5);
  });

  it('runs under a pinned machine time zone (jest.global-setup.js)', () => {
    expect(process.env.TZ).toBeTruthy();
  });

  it.each(sources)('$file imports only engine modules and date libraries', ({ code }) => {
    const specifiers = [...code.matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)].map((m) => m[1] ?? '');
    for (const spec of specifiers) {
      expect(spec.startsWith('./') || ALLOWED_PACKAGES.has(spec)).toBe(true);
    }
  });

  it.each(sources)('$file never reads the clock', ({ code }) => {
    expect(code).not.toMatch(/Date\.now\s*\(/);
    expect(code).not.toMatch(/new Date\(\s*\)/);
    expect(code).not.toMatch(/performance\.now\s*\(/);
  });
});
