import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import * as engine from '../../src/engine/index.ts';
import * as limits from '../../src/store/limits.ts';
import {
  APPS,
  compareHtml,
  galleryHtml,
  homeFaqs,
  jsonLdHtml,
  list,
  llmsTxt,
  plusFaqs,
  readShots,
  shotAlt,
  smartBannerHtml,
  storeButtonsHtml,
  type Facts,
} from './marketing';

const facts: Facts = { engine, limits };
const shotsDir = fileURLToPath(new URL('../src/site/shots/', import.meta.url));
const manifest = readShots(path.join(shotsDir, 'shots.json'));

/** Every store link as it is now, to put back after a test makes one live. */
const saved = Object.values(APPS).map((app) => Object.values(app.stores).map((link) => link.live));
afterEach(() => {
  Object.values(APPS).forEach((app, i) => Object.values(app.stores).forEach((link, j) => (link.live = saved[i]?.[j] ?? false)));
});

const goLive = () => Object.values(APPS).forEach((app) => Object.values(app.stores).forEach((link) => (link.live = true)));

describe('store buttons', () => {
  it('say coming soon, with no link, until a listing is live', () => {
    for (const app of Object.values(APPS)) for (const link of Object.values(app.stores)) link.live = false;
    const html = storeButtonsHtml('plus');
    expect(html).not.toContain('<a ');
    expect(html).toContain('Coming soon to the</span> <span class="store-name">App Store');
    expect(html).toContain('Coming soon to</span> <span class="store-name">Google Play');
    expect(smartBannerHtml('plus')).toBe('');
  });

  it('link each live listing, named for its app', () => {
    goLive();
    const html = storeButtonsHtml('plus');
    expect(html).toContain(`href="${APPS.plus.stores['app-store'].url}" aria-label="Get Win Zero Plus on the App Store"`);
    expect(html).toContain(`href="${APPS.plus.stores['google-play'].url}" aria-label="Get Win Zero Plus on Google Play"`);
    expect(smartBannerHtml('free')).toBe(`<meta name="apple-itunes-app" content="app-id=${APPS.free.appleId}" />`);
  });
});

describe('screenshots', () => {
  it('has every file the manifest lists', () => {
    for (const [app, shots] of Object.entries(manifest.apps)) {
      for (const shot of shots) {
        for (const w of manifest.widths) expect(fs.existsSync(path.join(shotsDir, app, `${shot.slug}-${w}.webp`))).toBe(true);
      }
      expect(fs.existsSync(path.join(shotsDir, 'icons', `${app}.webp`))).toBe(true);
    }
  });

  it('describes each screenshot by its store caption', () => {
    expect(shotAlt('free', { slug: 'round', caption: 'Every Yes is a zero to shoot.', sub: 'Day 50 · Chain Zapper, earned at day 30' })).toBe(
      'Win Zero screenshot: Every Yes is a zero to shoot. Day 50, Chain Zapper, earned at day 30.',
    );
    expect(shotAlt('plus', { slug: 'notification', caption: 'Answer straight from the notification', sub: null })).toBe(
      'Win Zero Plus screenshot: Answer straight from the notification.',
    );
  });

  it('builds a gallery with every size, in the order asked', () => {
    const html = galleryHtml(manifest, 'plus', { slugs: ['catch', 'goals'], sizes: '240px', label: 'Shots' });
    const srcs = [...html.matchAll(/ src="([^"]+)"/g)].map(([, src]) => src);
    expect(srcs).toEqual(['/src/site/shots/plus/catch-720.webp', '/src/site/shots/plus/goals-720.webp']);
    expect(html).toContain('srcset="/src/site/shots/plus/catch-360.webp 360w, /src/site/shots/plus/catch-720.webp 720w"');
    expect(html).toContain(`width="${manifest.size.width}" height="${manifest.size.height}"`);
    expect(() => galleryHtml(manifest, 'free', { slugs: ['nope'], sizes: '1px', label: 'x' })).toThrow('"nope"');
  });
});

describe('the comparison', () => {
  it('comes from the engine and the apps’ limits', () => {
    const html = compareHtml(facts);
    expect(html).toContain('<th scope="row">Goals at a time</th><td>One</td><td>Up to three</td>');
    expect(html).toContain(`<td>${list(engine.MODES.map((m) => m.name))}</td>`);
    expect(html).toContain(`<td>US$${APPS.plus.priceUsd}, once</td>`);
    expect(html).toContain('<td>Seven: four included, three to earn</td>');
  });
});

describe('structured data', () => {
  const parse = (html: string) => {
    const json = /<script type="application\/ld\+json">([\s\S]*)<\/script>/.exec(html)?.[1] ?? '';
    expect(json).not.toContain('<');
    return JSON.parse(json) as { '@graph': Record<string, unknown>[] };
  };
  const byType = (graph: Record<string, unknown>[], type: string) =>
    graph.filter((n) => (Array.isArray(n['@type']) ? n['@type'].includes(type) : n['@type'] === type));

  it("describes both apps, and the page's questions as its FAQ", () => {
    const graph = parse(jsonLdHtml('home', facts))['@graph'];
    expect(byType(graph, 'MobileApplication').map((a) => a.name)).toEqual(['Win Zero', 'Win Zero Plus']);
    expect(byType(graph, 'WebApplication')).toHaveLength(1);
    const [page] = byType(graph, 'FAQPage');
    const questions = page?.mainEntity as { name: string; acceptedAnswer: { text: string } }[];
    expect(questions.map((q) => q.name)).toEqual(homeFaqs(facts).map((f) => f.q));
    expect(questions.every((q) => !q.acceptedAnswer.text.includes('<a '))).toBe(true);
    expect(byType(parse(jsonLdHtml('plus', facts))['@graph'], 'FAQPage')[0]?.url).toBe('https://winzero.app/plus');
  });

  it('names store listings only once they are live', () => {
    for (const app of Object.values(APPS)) for (const link of Object.values(app.stores)) link.live = false;
    const before = byType(parse(jsonLdHtml('plus', facts))['@graph'], 'MobileApplication');
    expect(before.some((a) => 'installUrl' in a)).toBe(false);
    goLive();
    const plus = byType(parse(jsonLdHtml('plus', facts))['@graph'], 'MobileApplication').find((a) => a.name === 'Win Zero Plus');
    expect(plus?.installUrl).toEqual([APPS.plus.stores['app-store'].url, APPS.plus.stores['google-play'].url]);
    expect(plus?.offers).toEqual({ '@type': 'Offer', price: APPS.plus.priceUsd, priceCurrency: 'USD' });
  });
});

describe('the FAQs', () => {
  it('state the rules from the engine', () => {
    const missed = homeFaqs(facts).find((f) => f.q.startsWith('What happens if I miss'));
    expect(missed?.a).toContain(`The first ${engine.MISSED_GRACE_DAYS} missed check-ins`);
    expect(missed?.a).toContain('On every seventh slip');
    const earn = plusFaqs(facts).find((f) => f.q === 'What do I earn as I play?');
    expect(earn?.a).toContain('Ember, Aurora and Gold Year are earned at a best run of 30, 180 and 365 days');
  });
});

describe('llms.txt', () => {
  it('sums up the apps and lists the pages and store links', () => {
    for (const app of Object.values(APPS)) for (const link of Object.values(app.stores)) link.live = false;
    const txt = llmsTxt(facts);
    expect(txt.startsWith('# Win Zero\n\n> Win Zero is a free daily habit tracker')).toBe(true);
    expect(txt).toContain('- [Win Zero Plus](https://winzero.app/plus)');
    expect(txt).toContain('- Win Zero Plus on Google Play: coming soon');
    goLive();
    expect(llmsTxt(facts)).toContain(`- [Win Zero Plus on Google Play](${APPS.plus.stores['google-play'].url})`);
  });
});
