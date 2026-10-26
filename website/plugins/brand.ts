// Icons and share images come straight from the apps' brand sets (assets/brand and
// assets/brand-plus, rendered by `npm run gen:brand` and `gen:brand:plus` at the repo root),
// published under fixed names so pages, the manifest and structured data can link them without
// hashes.
import fs from 'node:fs';
import path from 'node:path';

import type { Plugin } from 'vite';

/** Published name → file in assets/. */
export const BRAND_FILES = {
  'favicon.png': 'brand/favicon.png',
  'apple-touch-icon.png': 'brand/google-play-icon.png',
  'icon-512.png': 'brand/google-play-icon.png',
  'og.png': 'brand/play-feature-graphic.png',
  'icon-plus-512.png': 'brand-plus/google-play-icon.png',
  'og-plus.png': 'brand-plus/play-feature-graphic.png',
} as const;

export function brand(dir: string): Plugin {
  const source = (name: string): string | null =>
    name in BRAND_FILES ? path.join(dir, BRAND_FILES[name as keyof typeof BRAND_FILES]) : null;

  return {
    name: 'win-zero:brand',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const file = req.url ? source(req.url.slice(1).split('?')[0] ?? '') : null;
        if (!file) return next();
        res.setHeader('Content-Type', 'image/png');
        fs.createReadStream(file).pipe(res);
      });
    },
    generateBundle() {
      for (const [fileName, from] of Object.entries(BRAND_FILES)) {
        this.emitFile({ type: 'asset', fileName, source: fs.readFileSync(path.join(dir, from)) });
      }
    },
  };
}
