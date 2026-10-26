import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { cssProblems, htmlProblems, REQUIRED, verifyDist } from './verify-dist.mjs';

describe('htmlProblems', () => {
  it('passes what Vite builds', () => {
    const html = `<!doctype html><html><head>
      <script type="module" crossorigin src="/assets/play-abc.js"></script>
      <link rel="stylesheet" crossorigin href="/assets/site-abc.css">
      <link rel="canonical" href="https://winzero.app/privacy" />
      </head><body><a href="https://www.samhsa.gov/">SAMHSA</a><a href="tel:18006624357">call</a></body></html>`;
    expect(htmlProblems(html)).toEqual([]);
  });

  it('allows structured data, as long as it parses', () => {
    expect(htmlProblems('<script type="application/ld+json">{"@type":"WebSite"}</script>')).toEqual([]);
    expect(htmlProblems('<script type="application/ld+json">{nope</script>')).toEqual(['structured data that is not JSON']);
  });

  it('catches everything the content security policy would block', () => {
    const problems = htmlProblems(`
      <script>alert(1)</script>
      <style>body{}</style>
      <div style="color:red" onclick="go()"></div>
      <img src="data:image/png;base64,AAAA">
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bungee">
      <script src="//cdn.example.com/x.js"></script>
      <p>Effective [EFFECTIVE_DATE]</p>`);
    expect(problems).toEqual([
      'inline script: <script>',
      'inline <style> element',
      'style="" attribute',
      'inline event handler: onclick="',
      'data: or javascript: URL',
      'loads from another origin: https://fonts.googleapis.com/css2?family=Bungee',
      'loads from another origin: //cdn.example.com/x.js',
      'unfilled placeholder [EFFECTIVE_DATE]',
    ]);
  });
});

describe('cssProblems', () => {
  it('catches data: URIs and other origins', () => {
    expect(cssProblems('a{background:url(/assets/x.png)}')).toEqual([]);
    expect(cssProblems('a{background:url("data:image/svg+xml,<svg/>")}')).toEqual(['data: URI in CSS']);
    expect(cssProblems("@import url('https://fonts.example.com/a.css');")).toContain('CSS @import from another origin');
  });
});

describe('verifyDist', () => {
  let dir = '';
  afterEach(() => {
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
  });

  it('lists missing files and the files with problems', () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-dist-'));
    for (const name of REQUIRED) fs.writeFileSync(path.join(dir, name), '');
    fs.writeFileSync(path.join(dir, '_headers'), '/*\n  X-Frame-Options: DENY\n');
    fs.rmSync(path.join(dir, 'og.png'));
    fs.writeFileSync(path.join(dir, 'index.html'), '<script>1</script>');
    expect(verifyDist(dir)).toEqual([
      'og.png: missing',
      '_headers: no Content-Security-Policy',
      'index.html: inline script: <script>',
    ]);
  });
});
