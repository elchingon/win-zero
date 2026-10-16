// Static pages: shared header and footer partials, and the privacy and support pages rendered
// from docs/store/*.md (the same text the store listings point to, so there's one source).
// Also serves clean URLs in dev and preview the way Cloudflare Pages does in production.
import fs from 'node:fs';
import path from 'node:path';

import { marked } from 'marked';
import type { Connect, Plugin } from 'vite';

const INCLUDE = /<!--\s*include:([\w-]+)\s*-->/g;
const MARKDOWN = /<!--\s*markdown:([\w-]+)\s*-->/g;

/** Unfilled store-copy placeholders such as [PRIVACY_URL] or [EFFECTIVE_DATE]. */
export const PLACEHOLDER = /\[[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\]|\[[A-Z]{4,}\]/g;

/** Clean URL → the HTML entry that serves it, as Cloudflare Pages maps them. */
export function entryFor(url: string): string | null {
  const pathname = url.split(/[?#]/)[0] ?? url;
  if (pathname === '/play' || pathname.startsWith('/play/')) return '/play.html';
  if (pathname === '/privacy' || pathname === '/support') return `${pathname}.html`;
  return null;
}

export function renderMarkdown(source: string): string {
  return marked.parse(source, { async: false, gfm: true });
}

export interface PagesOptions {
  /** Folder holding the header/footer partials. */
  partials: string;
  /** Folder holding the markdown sources (docs/store). */
  markdown: string;
  /** Partials built from shared data at build time, by name, ahead of files in `partials`. */
  generated?: Record<string, () => string | Promise<string>>;
}

export function pages({ partials, markdown, generated = {} }: PagesOptions): Plugin {
  let isBuild = false;

  const rewrite: Connect.NextHandleFunction = (req, _res, next) => {
    const entry = req.url ? entryFor(req.url) : null;
    if (entry) req.url = entry + (req.url?.includes('?') ? req.url.slice(req.url.indexOf('?')) : '');
    next();
  };

  return {
    name: 'win-zero:pages',
    configResolved(config) {
      isBuild = config.command === 'build';
    },
    configureServer(server) {
      server.watcher.add([partials, markdown]);
      server.watcher.on('change', (file) => {
        if (file.startsWith(partials) || file.startsWith(markdown)) server.ws.send({ type: 'full-reload' });
      });
      server.middlewares.use(rewrite);
    },
    configurePreviewServer(server) {
      server.middlewares.use(rewrite);
    },
    transformIndexHtml: {
      order: 'pre',
      async handler(html, ctx) {
        const included = new Map<string, string>();
        for (const [, name] of html.matchAll(INCLUDE)) {
          if (!name || included.has(name)) continue;
          const build = generated[name];
          included.set(name, build ? await build() : fs.readFileSync(path.join(partials, `${name}.html`), 'utf8').trim());
        }
        let out = html.replace(INCLUDE, (_, name: string) => included.get(name) ?? '');
        out = out.replace(MARKDOWN, (_, name: string) =>
          renderMarkdown(fs.readFileSync(path.join(markdown, `${name}.md`), 'utf8')),
        );
        const left = out.match(PLACEHOLDER);
        if (left) {
          const message = `${path.basename(ctx.filename)} still has placeholders: ${[...new Set(left)].join(', ')}`;
          if (isBuild) throw new Error(message);
          console.warn(`[win-zero:pages] ${message}`);
        }
        return out;
      },
    },
  };
}
