/// <reference types="vitest/config" />
// The website: static pages (landing, Plus, privacy, support, 404) plus the playable app under /play.
// It shares the app's pure code from ../src through the `@/` alias; see plugins/shared-guard.ts.
import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

import type * as Engine from '../src/engine/index.ts';
import type * as LimitsModule from '../src/store/limits.ts';

import { brand } from './plugins/brand.ts';
import { loadShared, shareWhileLoading, unlocksHtml } from './plugins/landing.ts';
import { llmsTxt, marketingPartials, type Facts } from './plugins/marketing.ts';
import { pages } from './plugins/pages.ts';
import { sharedGuard } from './plugins/shared-guard.ts';

const here = (relative: string) => fileURLToPath(new URL(relative, import.meta.url));

const appSrc = here('../src');

/** The engine and the apps' limits, loaded once for all of a page's partials. */
const loadFacts = shareWhileLoading<Facts>(async () => {
  const tsconfig = here('./tsconfig.json');
  const [engine, limits] = await Promise.all([
    loadShared<typeof Engine>(here('../src/engine/index.ts'), tsconfig),
    loadShared<typeof LimitsModule>(here('../src/store/limits.ts'), tsconfig),
  ]);
  return { engine, limits };
});

export default defineConfig({
  appType: 'mpa',
  // Compile every file, including the shared ones under ../src, with this tsconfig. Otherwise
  // they'd pick up the app's tsconfig, which extends expo/tsconfig.base: not installed here.
  tsconfig: here('./tsconfig.json'),
  plugins: [
    sharedGuard(appSrc),
    pages({
      partials: here('./partials'),
      markdown: here('../docs/store'),
      generated: {
        unlocks: async () => unlocksHtml((await loadFacts()).engine),
        ...marketingPartials(loadFacts, here('./src/site/shots/shots.json')),
      },
      files: { 'llms.txt': async () => llmsTxt(await loadFacts()) },
    }),
    brand(here('../assets')),
    react(),
  ],
  resolve: {
    alias: [
      // Regexes, so `@fontsource/...` and other scoped packages pass through untouched.
      { find: /^@\//, replacement: `${appSrc}/` },
      { find: /^~\//, replacement: `${here('./src')}/` },
      { find: /^@assets\//, replacement: `${here('../assets')}/` },
    ],
    // Shared files under ../src import these; resolve them from website/node_modules, since the
    // app's own node_modules isn't installed when Cloudflare builds the site.
    dedupe: ['react', 'react-dom', 'zustand'],
  },
  server: {
    fs: { allow: ['.', '../src', '../assets', '../docs/store'] },
  },
  build: {
    // Never inline assets as data: URIs; the content security policy allows only 'self'.
    assetsInlineLimit: 0,
    rolldownOptions: {
      input: {
        index: here('./index.html'),
        privacy: here('./privacy.html'),
        support: here('./support.html'),
        plus: here('./plus.html'),
        play: here('./play.html'),
        404: here('./404.html'),
      },
      onLog(level, log, handler) {
        // The shared sim and drawing code start with 'worklet', which only the app's Babel plugin
        // reads. In the browser they're plain functions, so the directive can go.
        if (log.code === 'MODULE_LEVEL_DIRECTIVE' && log.message.includes('"worklet"')) return;
        handler(level, log);
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}', 'plugins/**/*.test.ts', 'scripts/**/*.test.{ts,mjs}'],
  },
});
