// Landing-page sections built from the rules engine at build time, so the page can't drift
// from the app's real unlock days and reward intervals. The engine is loaded through Vite's
// module runner: it's TypeScript under the app's package.json, which Node can't import as is.
import { runnerImport } from 'vite';

import type * as Engine from '../../src/engine/index.ts';

export const escape = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** A shared module under ../src. `tsconfig`: the website's, as in vite.config.ts (the app's extends a package not installed here). */
export function loadShared<T>(entry: string, tsconfig: string): Promise<T> {
  return runnerImport<T>(entry, { configFile: false, logLevel: 'silent', tsconfig }).then((r) => r.module);
}

/** `load`, run at most once at a time: calls while it runs share its result, and later calls load afresh. */
export function shareWhileLoading<T>(load: () => Promise<T>): () => Promise<T> {
  let running: Promise<T> | null = null;
  return () =>
    (running ??= load().finally(() => {
      running = null;
    }));
}

export function unlocksHtml(engine: typeof Engine): string {
  const items = engine.WEAPONS.map(
    (w) => `<li><span class="day">Day ${w.unlockAt}</span> <span class="weapon">${escape(w.name)}</span></li>`,
  ).join('\n');
  return [
    `<ul class="unlocks">\n${items}\n</ul>`,
    `<p class="note">Earn a bomb every ${engine.BOMB_EVERY} days and a shield every ${engine.SHIELD_EVERY} ` +
      `(you can hold up to ${engine.SHIELD_CAP}).</p>`,
  ].join('\n');
}
