// Shared by the sim and draw purity tests: the worklet source files under a folder (game modes
// live in subfolders), the functions a worklet reaches that aren't worklets themselves, and the
// import graph between worklet files.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';

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
  // A worklet binds what it captures when its module loads; an import cycle leaves it undefined.
  return Object.entries(w.__closure ?? {}).flatMap(([k, v]) =>
    v === undefined ? [`${name} → ${k} (undefined)`] : nonWorklets(v, `${name} → ${k}`, seen),
  );
}

/**
 * The value imports between worklet files under `dirs`, as absolute file paths: relative
 * `import … from`, `export … from` and side-effect imports. Whole-statement `import type` and
 * `export type` are left out, since Babel erases them; `{ type A, b }` still loads the module.
 * Throws on a relative import it can't find, so a typo can't hide an edge.
 */
export function importGraph(dirs: string[]): Map<string, string[]> {
  const graph = new Map<string, string[]>();
  for (const dir of dirs) {
    for (const { file, code } of sourceFiles(dir)) {
      const from = join(dir, file);
      const edges: string[] = [];
      const specs = [
        ...[...code.matchAll(/(?:import|export)\s+(type\s+)?[\w*\s{},]*?from\s+['"]([^'"]+)['"]/g)]
          .filter((m) => !m[1])
          .map((m) => m[2] ?? ''),
        ...[...code.matchAll(/^\s*import\s+['"]([^'"]+)['"]/gm)].map((m) => m[1] ?? ''),
      ];
      for (const spec of specs) {
        if (!spec.startsWith('./') && !spec.startsWith('../')) continue;
        const base = resolve(dirname(from), spec);
        const target = [`${base}.ts`, join(base, 'index.ts')].find((f) => existsSync(f));
        if (!target) throw new Error(`${relative(process.cwd(), from)} imports ${spec}, which isn't there`);
        edges.push(target);
      }
      graph.set(from, edges);
    }
  }
  return graph;
}

/** Every import cycle in `graph`, each as the files around it (relative to `root`). */
export function importCycles(graph: Map<string, string[]>, root: string): string[][] {
  const cycles: string[][] = [];
  const state = new Map<string, 'open' | 'done'>();
  const path: string[] = [];
  const visit = (file: string) => {
    state.set(file, 'open');
    path.push(file);
    for (const next of graph.get(file) ?? []) {
      if (state.get(next) === 'open') {
        cycles.push([...path.slice(path.indexOf(next)), next].map((f) => relative(root, f).split(sep).join('/')));
      } else if (!state.has(next)) {
        visit(next);
      }
    }
    path.pop();
    state.set(file, 'done');
  };
  for (const file of [...graph.keys()].sort()) if (!state.has(file)) visit(file);
  return cycles;
}
