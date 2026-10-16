/// <reference types="vitest/config" />
// The website: static pages (landing, privacy, support, 404) plus the playable app under /play.
// It shares the app's pure code from ../src through the `@/` alias; see plugins/shared-guard.ts.
import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

import { brand } from './plugins/brand.ts';
import { loadEngine, unlocksHtml } from './plugins/landing.ts';
import { pages } from './plugins/pages.ts';
import { sharedGuard } from './plugins/shared-guard.ts';

const here = (relative: string) => fileURLToPath(new URL(relative, import.meta.url));

const appSrc = here('../src');

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
      generated: { unlocks: async () => unlocksHtml(await loadEngine(here('../src/engine/index.ts'), here('./tsconfig.json'))) },
    }),
    brand(here('../assets/brand')),
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
        play: here('./play.html'),
        404: here('./404.html'),
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}', 'plugins/**/*.test.ts', 'scripts/**/*.test.{ts,mjs}'],
  },
});
