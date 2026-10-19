// Shared by the sim and draw purity tests: the worklet source files under a folder (game modes
// live in subfolders), and the functions a worklet reaches that aren't worklets themselves.
import { readdirSync, readFileSync } from 'node:fs';
import { join, sep } from 'node:path';

export interface Source {
  /** Relative to the folder, with forward slashes: 'step.ts', 'modes/catch.ts'. */
  file: string;
  code: string;
}

/** Every .ts file under `dir`, subfolders included and tests left out, in a stable order. */
export function sourceFiles(dir: string): Source[] {
  return readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .filter((rel) => rel.endsWith('.ts') && !rel.split(sep).includes('__tests__'))
    .sort()
    .map((rel) => ({ file: rel.split(sep).join('/'), code: readFileSync(join(dir, rel), 'utf8') }));
}

/** Module specifiers a file imports or re-exports. */
export function specifiers(code: string): string[] {
  return [...code.matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)].map((m) => m[1] ?? '');
}

type MaybeWorklet = { __workletHash?: number; __closure?: Record<string, unknown> };

/**
 * Names of functions reachable from `value` that aren't worklets: the value itself, what a
 * worklet captures, and functions tucked inside captured arrays and plain objects.
 */
export function nonWorklets(value: unknown, name: string, seen = new Set<unknown>()): string[] {
  if (value === null || (typeof value !== 'function' && typeof value !== 'object') || seen.has(value)) return [];
  seen.add(value);
  if (typeof value === 'object') {
    const proto = Object.getPrototypeOf(value) as unknown;
    if (!Array.isArray(value) && proto !== Object.prototype && proto !== null) return [];
    return Object.entries(value).flatMap(([k, v]) => nonWorklets(v, `${name}.${k}`, seen));
  }
  const w = value as MaybeWorklet;
  if (!w.__workletHash) return [name];
  return Object.entries(w.__closure ?? {}).flatMap(([k, v]) => nonWorklets(v, `${name} → ${k}`, seen));
}
