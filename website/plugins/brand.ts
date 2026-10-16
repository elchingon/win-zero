// Icons and share images come straight from the app's brand set (assets/brand, rendered by
// `npm run gen:brand` at the repo root), published under fixed names so pages and the
// manifest can link them without hashes.
import fs from 'node:fs';
import path from 'node:path';

import type { Plugin } from 'vite';

/** Published name → file in assets/brand. */
export const BRAND_FILES = {
  'favicon.png': 'favicon.png',
  'apple-touch-icon.png': 'google-play-icon.png',
  'icon-512.png': 'google-play-icon.png',
  'og.png': 'play-feature-graphic.png',
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
