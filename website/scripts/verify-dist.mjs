// Checks the built site (dist/) before it ships. The content security policy in _headers allows
// scripts, styles, fonts and images from this origin only, with no inline code, so the build
// must hold no inline <script>, <style> or style="" attributes, no inline event handlers, no
// data: URIs and nothing loaded from another origin. It also catches unfilled store-copy
// placeholders and missing Cloudflare Pages files.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const REQUIRED = [
  '_headers',
  '_redirects',
  '404.html',
  'index.html',
  'privacy.html',
  'support.html',
  'play.html',
  'robots.txt',
  'favicon.png',
  'og.png',
];

const OWN_ORIGIN = 'https://winzero.app/';

/** @param {string} dir */
function walk(dir) {
  /** @type {string[]} */
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(full));
    else files.push(full);
  }
  return files;
}

/**
 * Problems in an HTML file, as messages.
 * @param {string} html
 * @returns {string[]}
 */
export function htmlProblems(html) {
  /** @type {string[]} */
  const problems = [];
  for (const [tag] of html.matchAll(/<script\b[^>]*>/gi)) {
    if (!/\bsrc=/i.test(tag)) problems.push(`inline script: ${tag}`);
  }
  if (/<style\b/i.test(html)) problems.push('inline <style> element');
  if (/\sstyle\s*=/i.test(html)) problems.push('style="" attribute');
  for (const [attr] of html.matchAll(/\son[a-z]+\s*=\s*["']/gi)) problems.push(`inline event handler: ${attr.trim()}`);
  if (/(?:src|href)\s*=\s*["']\s*(?:data|javascript):/i.test(html)) problems.push('data: or javascript: URL');
  // Anything the page loads (not plain links people follow) must come from this origin.
  for (const [tag] of html.matchAll(/<(?:script|link|img|source|iframe|audio|video)\b[^>]*>/gi)) {
    const url = /\s(?:src|href)\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1];
    if (url && /^(?:https?:)?\/\//i.test(url) && !url.startsWith(OWN_ORIGIN)) {
      problems.push(`loads from another origin: ${url}`);
    }
  }
  for (const [placeholder] of html.matchAll(/\[[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\]/g)) {
    problems.push(`unfilled placeholder ${placeholder}`);
  }
  return problems;
}

/**
 * Problems in a CSS file, as messages.
 * @param {string} css
 * @returns {string[]}
 */
export function cssProblems(css) {
  /** @type {string[]} */
  const problems = [];
  if (/url\(\s*["']?data:/i.test(css)) problems.push('data: URI in CSS');
  if (/@import\s+(?:url\()?["']?(?:https?:)?\/\//i.test(css)) problems.push('CSS @import from another origin');
  for (const [, url] of css.matchAll(/url\(\s*["']?((?:https?:)?\/\/[^"')]+)/gi)) {
    if (!url?.startsWith(OWN_ORIGIN)) problems.push(`CSS loads from another origin: ${url}`);
  }
  return problems;
}

/**
 * Every problem in the built site at `dir`, as "file: message" lines.
 * @param {string} dir
 * @returns {string[]}
 */
export function verifyDist(dir) {
  if (!fs.existsSync(dir)) return [`${dir} doesn't exist; run the build first`];
  /** @type {string[]} */
  const problems = [];
  for (const name of REQUIRED) {
    if (!fs.existsSync(path.join(dir, name))) problems.push(`${name}: missing`);
  }
  const headers = path.join(dir, '_headers');
  if (fs.existsSync(headers) && !fs.readFileSync(headers, 'utf8').includes('Content-Security-Policy:')) {
    problems.push('_headers: no Content-Security-Policy');
  }
  for (const file of walk(dir)) {
    const rel = path.relative(dir, file);
    if (file.endsWith('.html')) {
      for (const p of htmlProblems(fs.readFileSync(file, 'utf8'))) problems.push(`${rel}: ${p}`);
    } else if (file.endsWith('.css')) {
      for (const p of cssProblems(fs.readFileSync(file, 'utf8'))) problems.push(`${rel}: ${p}`);
    }
  }
  return problems;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dir = path.resolve(process.argv[2] ?? path.join(path.dirname(fileURLToPath(import.meta.url)), '../dist'));
  const problems = verifyDist(dir);
  if (problems.length > 0) {
    console.error(`verify-dist: ${problems.length} problem(s) in ${dir}`);
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  console.log(`verify-dist: ${dir} is ready to ship`);
}
