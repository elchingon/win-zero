// The pages that promote the apps (the landing page and /plus), built at build time: store
// buttons, screenshot galleries, the comparison of Win Zero and Win Zero Plus, the FAQs, their
// structured data (JSON-LD) and llms.txt. Counts and names come from the engine and the apps'
// limits, so the pages can't drift from the apps.
//
// Store links live in APPS, each with `live`. Until a listing is public, its button says
// "coming soon" instead of linking to the store's 404, and the structured data and Smart App
// Banner leave it out.
import fs from 'node:fs';

import type * as Engine from '../../src/engine/index.ts';
import type * as LimitsModule from '../../src/store/limits.ts';
import { escape } from './landing.ts';

export const SITE = 'https://winzero.app';
const CONTACT_EMAIL = 'e7urgent@gmail.com';
/** Where the screenshot copies live (scripts/gen-shots.mjs); Vite fingerprints them in the build. */
const SHOTS_URL = '/src/site/shots';

export type AppId = 'free' | 'plus';
export type StoreId = 'app-store' | 'google-play';

export interface StoreLink {
  url: string;
  /** The listing is public. Until then the button says "coming soon" and nothing links to it. */
  live: boolean;
}

export interface AppInfo {
  name: string;
  /** The name on the store listings, when it differs. */
  storeName: string;
  /** This app's page on the website. */
  page: string;
  /** The app's Apple ID in App Store Connect, for the Smart App Banner. */
  appleId: string;
  /** In US dollars, as the stores take it; '0' is free. */
  priceUsd: string;
  /** A square icon with a fixed name (plugins/brand.ts), for structured data. */
  icon: string;
  stores: Record<StoreId, StoreLink>;
}

export const APPS: Record<AppId, AppInfo> = {
  free: {
    name: 'Win Zero',
    storeName: 'Win Zero Goal Tracker Game',
    page: '/',
    appleId: '6823793298',
    priceUsd: '0',
    icon: '/icon-512.png',
    stores: {
      'app-store': { url: 'https://apps.apple.com/app/id6823793298', live: false },
      'google-play': { url: 'https://play.google.com/store/apps/details?id=com.e7systems.winzero', live: false },
    },
  },
  plus: {
    name: 'Win Zero Plus',
    storeName: 'Win Zero Plus',
    page: '/plus',
    appleId: '6826679382',
    priceUsd: '4.99',
    icon: '/icon-plus-512.png',
    stores: {
      'app-store': { url: 'https://apps.apple.com/app/id6826679382', live: false },
      'google-play': { url: 'https://play.google.com/store/apps/details?id=com.e7systems.winzeroplus', live: false },
    },
  },
};

export const STORES: Record<StoreId, { name: string; lead: string; soon: string; inSentence: string; platform: string }> = {
  'app-store': { name: 'App Store', lead: 'Download on the', soon: 'Coming soon to the', inSentence: 'the App Store', platform: 'iPhone' },
  'google-play': { name: 'Google Play', lead: 'Get it on', soon: 'Coming soon to', inSentence: 'Google Play', platform: 'Android' },
};
const STORE_IDS = Object.keys(STORES) as StoreId[];

const DESCRIPTIONS: Record<AppId, string> = {
  free:
    'A daily habit tracker with an arcade reward: one goal, one check-in a day, and every Yes adds a zero to clear ' +
    'in a quick shooting round. Free, with no ads, subscriptions or account.',
  plus:
    'The paid edition of Win Zero: track up to three habits on the days you choose, play five arcade games and earn ' +
    'themes as you progress. Pay once, with no ads, subscription or account.',
};

// ---------------------------------------------------------------------------------------------
// Facts from the shared code

export interface Facts {
  engine: typeof Engine;
  limits: typeof LimitsModule;
}

const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const ORDINALS = ['zeroth', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'];
/** Small counts as words, the way the store copy writes them. */
export const words = (n: number) => WORDS[n] ?? String(n);
export const ordinal = (n: number) => ORDINALS[n] ?? `${n}th`;
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
/** "a, b and c". */
export const list = (items: readonly string[]) =>
  items.length < 2 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;

const price = (app: AppInfo) => `US$${app.priceUsd}`;
const isLive = (id: AppId, store: StoreId) => APPS[id].stores[store].live;
const liveUrls = (id: AppId) => STORE_IDS.filter((s) => isLive(id, s)).map((s) => APPS[id].stores[s].url);

function themes({ engine }: Facts) {
  const fromStart = engine.THEMES.filter((t) => t.source !== 'earned').map((t) => t.name);
  const earned = engine.THEMES.filter((t) => t.source === 'earned');
  return { all: engine.THEMES, fromStart, earned };
}

// ---------------------------------------------------------------------------------------------
// Store buttons and the Smart App Banner

export function storeButtonsHtml(id: AppId): string {
  const app = APPS[id];
  const items = STORE_IDS.map((store) => {
    const s = STORES[store];
    const link = app.stores[store];
    return link.live
      ? `<li><a class="store-button" href="${link.url}" aria-label="Get ${app.name} on ${s.inSentence}">` +
          `<span class="store-lead">${s.lead}</span> <span class="store-name">${s.name}</span></a></li>`
      : `<li><span class="store-button soon"><span class="store-lead">${s.soon}</span> <span class="store-name">${s.name}</span></span></li>`;
  });
  return `<ul class="store-buttons" aria-label="Get ${app.name}">\n${items.join('\n')}\n</ul>`;
}

/** Safari on iPhone offers the app above the page, once its App Store listing is public. */
export function smartBannerHtml(id: AppId): string {
  return isLive(id, 'app-store') ? `<meta name="apple-itunes-app" content="app-id=${APPS[id].appleId}" />` : '';
}

// ---------------------------------------------------------------------------------------------
// Screenshots

export interface Shot {
  slug: string;
  caption: string;
  sub: string | null;
}

/** scripts/gen-shots.mjs's manifest. */
export interface ShotManifest {
  size: { width: number; height: number };
  widths: number[];
  iconWidth: number;
  apps: Record<AppId, Shot[]>;
}

export function readShots(file: string): ShotManifest {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as ShotManifest;
}

/** A screenshot's alt text: its store caption, which says what the screen shows. */
export function shotAlt(id: AppId, shot: Shot): string {
  const sentence = (s: string) => (/[.!?]$/.test(s) ? s : `${s}.`);
  const sub = shot.sub ? ` ${sentence(shot.sub.replace(/ · /g, ', '))}` : '';
  return `${APPS[id].name} screenshot: ${sentence(shot.caption)}${sub}`;
}

export interface GalleryOptions {
  /** Which screenshots, in order; all of the app's by default. */
  slugs?: readonly string[];
  /** The img `sizes`: how wide a screenshot shows. */
  sizes: string;
  className?: string;
  label: string;
}

export function galleryHtml(manifest: ShotManifest, id: AppId, opts: GalleryOptions): string {
  const shots = manifest.apps[id];
  const picked = opts.slugs
    ? opts.slugs.map((slug) => {
        const shot = shots.find((s) => s.slug === slug);
        if (!shot) throw new Error(`No ${id} screenshot "${slug}" in shots.json; add it to scripts/gen-shots.mjs`);
        return shot;
      })
    : shots;
  const { width, height } = manifest.size;
  const largest = Math.max(...manifest.widths);
  const items = picked.map((shot) => {
    const file = (w: number) => `${SHOTS_URL}/${id}/${shot.slug}-${w}.webp`;
    const srcset = manifest.widths.map((w) => `${file(w)} ${w}w`).join(', ');
    return (
      `<li><img src="${file(largest)}" srcset="${srcset}" sizes="${opts.sizes}" width="${width}" height="${height}" ` +
      `loading="lazy" decoding="async" alt="${escape(shotAlt(id, shot)).replace(/"/g, '&quot;')}" /></li>`
    );
  });
  // Focusable, so the keyboard can scroll it where it scrolls sideways.
  return `<ul class="gallery${opts.className ? ` ${opts.className}` : ''}" aria-label="${opts.label}" tabindex="0">\n${items.join('\n')}\n</ul>`;
}

// ---------------------------------------------------------------------------------------------
// The two apps side by side

const YES = '<span aria-hidden="true">✓</span><span class="sr-only">Yes</span>';
const NO = '<span aria-hidden="true">–</span><span class="sr-only">No</span>';

export function compareHtml(facts: Facts): string {
  const { engine, limits } = facts;
  const { FREE_LIMITS: free, PLUS_LIMITS: plus } = limits;
  const t = themes(facts);
  const shooter = engine.modeById(engine.DEFAULT_MODE);
  const goals = (l: LimitsModule.Limits) => (l.maxGoals === 1 ? 'One' : `Up to ${words(l.maxGoals)}`);
  const days = (l: LimitsModule.Limits) => (l.weekdaySchedules ? 'Every day, weekdays or any mix' : 'Every day');
  const games = (l: LimitsModule.Limits) => (l.modesEnabled ? list(engine.MODES.map((m) => m.name)) : shooter.name);
  const looks = (l: LimitsModule.Limits) =>
    l.themesEnabled ? `${capital(words(t.all.length))}: ${words(t.fromStart.length)} included, ${words(t.earned.length)} to earn` : 'Classic';
  const icons = (l: LimitsModule.Limits) => (l.iconsEnabled ? 'One for each theme' : 'One');
  const rows: [string, string, string][] = [
    ['Price', 'Free', `${price(APPS.plus)}, once`],
    ['Goals at a time', goals(free), goals(plus)],
    ['Check-in days', days(free), days(plus)],
    ['Arcade games', games(free), games(plus)],
    ['Power-ups', `${capital(words(engine.WEAPONS.length))} weapons`, `${capital(words(shooter.tiers.length))} in each game`],
    ['Color themes', looks(free), looks(plus)],
    ['App icons', icons(free), icons(plus)],
    ['Reminders you answer from the notification', YES, YES],
    ['Gentle streak rules, bombs, shields and credits', YES, YES],
    ['Bring your progress over from Win Zero', NO, YES],
    ['No account, ads or tracking', YES, YES],
    ['In-app purchases or subscription', NO, NO],
  ];
  const body = rows.map(([label, a, b]) => `<tr><th scope="row">${label}</th><td>${a}</td><td>${b}</td></tr>`).join('\n');
  return [
    '<div class="compare-wrap">',
    '<table class="compare">',
    '<caption class="sr-only">Win Zero and Win Zero Plus compared</caption>',
    '<thead><tr><td></td><th scope="col">Win Zero</th><th scope="col">Win Zero Plus</th></tr></thead>',
    `<tbody>\n${body}\n</tbody>`,
    '</table>',
    '</div>',
  ].join('\n');
}

/** Plus in five lines, for the landing page's promotion. */
export function plusPointsHtml(facts: Facts): string {
  const { engine, limits } = facts;
  const t = themes(facts);
  const points = [
    `<strong>Up to ${words(limits.PLUS_LIMITS.maxGoals)} goals,</strong> each with its own check-ins, streak and history.`,
    '<strong>Check-in days you choose:</strong> every day, weekdays or any mix. Rest days are just rest.',
    `<strong>${capital(words(engine.MODES.length))} arcade games:</strong> ${list(engine.MODES.map((m) => m.name))}.`,
    `<strong>${capital(words(t.all.length))} color themes,</strong> each with a matching app icon.`,
    '<strong>Already on Win Zero?</strong> Bring your goal, streak and rewards with you.',
  ];
  return `<ul class="points">\n${points.map((p) => `<li>${p}</li>`).join('\n')}\n</ul>`;
}

/** The two apps as cards, each with its store buttons, for the Get the app section. */
export function appCardsHtml(facts: Facts): string {
  const { engine, limits } = facts;
  const t = themes(facts);
  const card = (id: AppId, pitch: string) =>
    [
      `<div class="get-app ${id}">`,
      `<h3><img class="app-icon" src="${SHOTS_URL}/icons/${id}.webp" width="48" height="48" alt="" />${APPS[id].name}</h3>`,
      `<p>${pitch}</p>`,
      storeButtonsHtml(id),
      '</div>',
    ].join('\n');
  return [
    '<div class="get-apps">',
    card('free', `Free. One goal, a check-in every day, the ${engine.modeById(engine.DEFAULT_MODE).name} and ${words(engine.WEAPONS.length)} weapons to earn.`),
    card(
      'plus',
      `${price(APPS.plus)} once. Up to ${words(limits.PLUS_LIMITS.maxGoals)} goals on the days you choose, ` +
        `${words(engine.MODES.length)} games and ${words(t.all.length)} themes. <a href="${APPS.plus.page}">See what's in Plus</a>`,
    ),
    '</div>',
  ].join('\n');
}

/** Plus's games, each with its power-ups from first to last. */
export function gamesHtml({ engine }: Facts): string {
  const items = engine.MODES.map(
    (m) =>
      `<li><span class="weapon">${escape(m.name)}</span> <span class="tiers">${escape(m.tiers[0] ?? '')} to ${escape(m.tiers.at(-1) ?? '')}</span></li>`,
  );
  return `<ul class="unlocks games">\n${items.join('\n')}\n</ul>`;
}

/** Plus's themes: the ones it comes with, then the ones earned by a best run. */
export function themesHtml(facts: Facts): string {
  const t = themes(facts);
  const items = [
    ...t.fromStart.map((name) => `<li><span class="day">Included</span> <span class="weapon">${escape(name)}</span></li>`),
    ...t.earned.map((th) => `<li><span class="day">Day ${th.unlockAt}</span> <span class="weapon">${escape(th.name)}</span></li>`),
  ];
  return `<ul class="unlocks">\n${items.join('\n')}\n</ul>`;
}

// ---------------------------------------------------------------------------------------------
// Questions and answers. Answers are HTML for the page; the structured data gets them as text.

export interface Faq {
  q: string;
  a: string;
}

export function homeFaqs(facts: Facts): Faq[] {
  const { engine, limits } = facts;
  const t = themes(facts);
  return [
    {
      q: 'What is Win Zero?',
      a:
        'Win Zero is a free daily habit tracker for iPhone and Android that turns check-ins into an arcade game. Pick one ' +
        'goal and a check-in time. Each day Win Zero asks whether you stuck to it, and every Yes adds a zero to your ' +
        'streak. Then you clear those zeros in a quick shooting round: a streak of 30 gives you thirty to blast.',
    },
    {
      q: 'Is Win Zero free?',
      a:
        'Yes. Win Zero is free, with no ads, subscriptions or in-app purchases, and no account to make. ' +
        `<a href="${APPS.plus.page}">Win Zero Plus</a> is a separate app that you pay for once.`,
    },
    {
      q: 'What happens if I miss a day or say Not today?',
      a:
        `A Not today usually costs one zero, not your whole streak. The first ${engine.MISSED_GRACE_DAYS} missed check-ins ` +
        `in a row cost nothing, and later misses count as slips. On every ${ordinal(engine.SLIDE_FINAL)} ` +
        'slip without a Yes, a shield protects your streak or it starts over. Your best run and the weapons you have ' +
        'unlocked stay yours.',
    },
    {
      q: 'What is the difference between Win Zero and Win Zero Plus?',
      a:
        'Win Zero is complete and free: one goal checked in every day, every streak rule, ' +
        `${words(engine.WEAPONS.length)} weapons to earn and the ${engine.modeById(engine.DEFAULT_MODE).name} game. Win Zero Plus is a ` +
        `paid app for people who want more: up to ${words(limits.PLUS_LIMITS.maxGoals)} goals, check-in days you choose ` +
        `for each one, ${words(engine.MODES.length)} arcade games (${list(engine.MODES.map((m) => m.name))}) and ` +
        `${words(t.all.length)} color themes with matching app icons. <a href="${APPS.plus.page}">See what's in Plus</a>.`,
    },
    {
      q: 'Can I move my progress from Win Zero to Win Zero Plus?',
      a:
        'Yes. With both apps on the same phone, open Win Zero and go to Settings › About › Move to Win Zero Plus. Your ' +
        'goal, history, streak, rewards and credits move straight from one app to the other on your phone. Nothing ' +
        'goes through a server.',
    },
    {
      q: 'Does Win Zero collect my data?',
      a:
        'No. Your goals and check-ins stay on your phone, and neither app has accounts, analytics, advertising or ' +
        'tracking. Reminders keep your goal off the lock screen unless you choose to show it. The ' +
        '<a href="/privacy">privacy policy</a> has the details.',
    },
    {
      q: 'Can I try Win Zero without installing it?',
      a:
        'Yes. <a href="/play">Win Zero in your browser</a> has the daily check-in, the streak rules, the rewards and ' +
        'the round, and keeps your progress in your browser. It can\'t send reminders, so for a nudge at your ' +
        'check-in time, get the app.',
    },
  ];
}

export function plusFaqs(facts: Facts): Faq[] {
  const { engine, limits } = facts;
  const t = themes(facts);
  const shooter = engine.modeById(engine.DEFAULT_MODE);
  return [
    {
      q: 'What is Win Zero Plus?',
      a:
        'Win Zero Plus is the paid edition of Win Zero, a habit tracker that turns each check-in into an arcade round. ' +
        `It tracks up to ${words(limits.PLUS_LIMITS.maxGoals)} goals, each on the days you choose, with ` +
        `${words(engine.MODES.length)} arcade games and ${words(t.all.length)} color themes. It's a separate app on ` +
        'the App Store and Google Play.',
    },
    {
      q: 'How much does Win Zero Plus cost?',
      a:
        `${price(APPS.plus)}, paid once. There are no in-app purchases, ads or subscriptions, and no account. Outside ` +
        'the US, the store shows the price in your currency.',
    },
    {
      q: 'Do I need Win Zero to use Plus?',
      a:
        'No. Plus works on its own. If you already use Win Zero, you can bring your goal, history, streak, rewards ' +
        'and credits over on the same phone, from Win Zero\'s Settings › About › Move to Win Zero Plus.',
    },
    {
      q: 'What do I earn as I play?',
      a:
        `All ${words(engine.MODES.length)} games are open from the start, each with its first power-up. The other ` +
        `${words(shooter.tiers.length - 1)} in each game unlock as your best run grows, and stay unlocked. ` +
        `${list(t.fromStart)} are yours from the start, and ${list(t.earned.map((th) => th.name))} are earned at a ` +
        `best run of ${list(t.earned.map((th) => String(th.unlockAt)))} days. Bombs, shields and credits come from ` +
        'check-ins and are never sold.',
    },
    {
      q: 'Will Win Zero stay free?',
      a:
        'Yes. Win Zero stays complete and free: one goal, every streak rule, the full arsenal and the ' +
        `${shooter.name} game. Plus is for people who want more goals, games and themes.`,
    },
    {
      q: 'Does Win Zero Plus collect my data?',
      a:
        'No. Like Win Zero, Plus keeps your goals and check-ins on your phone, with no account, analytics, ' +
        'advertising or tracking. Each goal can have a private lock-screen name for its reminders. The ' +
        '<a href="/privacy">privacy policy</a> has the details.',
    },
  ];
}

export function faqHtml(faqs: Faq[]): string {
  const items = faqs.map((f) => `<div class="faq-item">\n<h3>${escape(f.q)}</h3>\n<p>${f.a}</p>\n</div>`);
  return `<div class="faq">\n${items.join('\n')}\n</div>`;
}

const text = (html: string) => html.replace(/<[^>]+>/g, '');

// ---------------------------------------------------------------------------------------------
// Structured data (schema.org JSON-LD)

const ORG_ID = `${SITE}/#organization`;
const SITE_ID = `${SITE}/#website`;
const appId = (id: AppId) => `${SITE}${APPS[id].page === '/' ? '/' : APPS[id].page}#app`;

function appLd(id: AppId) {
  const app = APPS[id];
  const urls = liveUrls(id);
  return {
    '@type': 'MobileApplication',
    '@id': appId(id),
    name: app.name,
    ...(app.storeName !== app.name ? { alternateName: app.storeName } : {}),
    description: DESCRIPTIONS[id],
    url: `${SITE}${app.page}`,
    image: `${SITE}${app.icon}`,
    operatingSystem: 'iOS, Android',
    applicationCategory: 'HealthApplication',
    applicationSubCategory: 'Habit tracker',
    offers: { '@type': 'Offer', price: app.priceUsd, priceCurrency: 'USD' },
    publisher: { '@id': ORG_ID },
    ...(urls.length > 0 ? { installUrl: urls, sameAs: urls } : {}),
  };
}

export function jsonLdHtml(page: 'home' | 'plus', facts: Facts): string {
  const home = page === 'home';
  const url = home ? `${SITE}/` : `${SITE}${APPS.plus.page}`;
  const faqs = home ? homeFaqs(facts) : plusFaqs(facts);
  const graph = [
    { '@type': 'Organization', '@id': ORG_ID, name: 'E7 Systems', url: `${SITE}/`, email: CONTACT_EMAIL },
    { '@type': 'WebSite', '@id': SITE_ID, name: 'Win Zero', url: `${SITE}/`, publisher: { '@id': ORG_ID }, inLanguage: 'en' },
    appLd('free'),
    appLd('plus'),
    ...(home
      ? [
          {
            '@type': 'WebApplication',
            '@id': `${SITE}/play#app`,
            name: 'Win Zero in your browser',
            description: 'The Win Zero check-in, streak rules, rewards and arcade round, played in a web browser.',
            url: `${SITE}/play`,
            applicationCategory: 'GameApplication',
            operatingSystem: 'Any',
            browserRequirements: 'Requires JavaScript',
            offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
            publisher: { '@id': ORG_ID },
          },
        ]
      : []),
    {
      '@type': ['WebPage', 'FAQPage'],
      '@id': `${url}#page`,
      url,
      isPartOf: { '@id': SITE_ID },
      about: { '@id': appId(home ? 'free' : 'plus') },
      inLanguage: 'en',
      mainEntity: faqs.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: text(f.a) },
      })),
    },
  ];
  // `<` is escaped so no string can close the script element.
  const json = JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(/</g, '\\u003c');
  return `<script type="application/ld+json">${json}</script>`;
}

// ---------------------------------------------------------------------------------------------
// llms.txt: the site in plain Markdown, for AI assistants and answer engines (llmstxt.org).

export function llmsTxt(facts: Facts): string {
  const { engine, limits } = facts;
  const t = themes(facts);
  const storeLine = (id: AppId, store: StoreId) => {
    const link = APPS[id].stores[store];
    const where = `${APPS[id].name} on ${STORES[store].inSentence}`;
    return link.live ? `- [${where}](${link.url})` : `- ${where}: coming soon`;
  };
  return [
    '# Win Zero',
    '',
    `> Win Zero is a free daily habit tracker for iPhone and Android with an arcade game as the reward. You pick one goal and ` +
      `a check-in time; every Yes adds a zero to your streak, and you clear those zeros in a quick shooting round. Win Zero ` +
      `Plus is its paid edition (${price(APPS.plus)}, once), with up to ${words(limits.PLUS_LIMITS.maxGoals)} goals, ` +
      `check-in days you choose, ${words(engine.MODES.length)} arcade games and ${words(t.all.length)} color themes. ` +
      'Both are made by E7 Systems.',
    '',
    'Key facts:',
    '',
    '- Win Zero is free, with no ads, subscriptions, in-app purchases or account. Win Zero Plus is paid once, with none of those either.',
    '- Goals and check-ins stay on the phone. Neither app has analytics, advertising or tracking.',
    `- A Not today usually costs one zero, not the whole streak. The first ${engine.MISSED_GRACE_DAYS} missed check-ins in a ` +
      `row cost nothing. On every ${ordinal(engine.SLIDE_FINAL)} slip without a Yes, a shield protects the streak or it starts over.`,
    `- Rewards: ${words(engine.WEAPONS.length)} weapons unlock as the best run grows (${list(engine.WEAPONS.map((w) => `${w.name} at day ${w.unlockAt}`))}), ` +
      `a bomb every ${engine.BOMB_EVERY} days, and a shield every ${engine.SHIELD_EVERY} (up to ${engine.SHIELD_CAP} held).`,
    `- Plus games: ${list(engine.MODES.map((m) => m.name))}. Plus themes: ${list(t.fromStart)} from the start; ` +
      `${list(t.earned.map((th) => `${th.name} at a best run of ${th.unlockAt} days`))}.`,
    '- Win Zero users can move their goal, history, streak, rewards and credits to Plus on the same phone, without a server.',
    '- A browser version at https://winzero.app/play has the check-in, rules, rewards and round, without reminders.',
    '- Support with drinking, drugs or mental health (US): the SAMHSA National Helpline, 1-800-662-4357, free, confidential and open 24/7.',
    '',
    '## Pages',
    '',
    `- [Win Zero](${SITE}/): what the free app does, screenshots, the comparison with Plus, and questions and answers`,
    `- [Win Zero Plus](${SITE}${APPS.plus.page}): up to ${words(limits.PLUS_LIMITS.maxGoals)} goals, check-in days, games and themes, and moving from Win Zero`,
    `- [Support](${SITE}/support): how check-ins, the streak rules, rewards and reminders work, with fixes for common questions`,
    `- [Privacy policy](${SITE}/privacy): what both apps and the website do with your information`,
    `- [Play in your browser](${SITE}/play): the playable web version`,
    '',
    '## Get the apps',
    '',
    ...(['free', 'plus'] as const).flatMap((id) => STORE_IDS.map((store) => storeLine(id, store))),
    '',
    '## Contact',
    '',
    `- Email: ${CONTACT_EMAIL}`,
    '',
  ].join('\n');
}

// ---------------------------------------------------------------------------------------------

/** Every partial above by its include name, for plugins/pages.ts. */
export function marketingPartials(loadFacts: () => Promise<Facts>, shotsFile: string): Record<string, () => string | Promise<string>> {
  const shots = () => readShots(shotsFile);
  // A gallery card is about 240px wide; 3 to a row in the Plus promotion.
  const card = '(min-width: 900px) 240px, min(62vw, 250px)';
  return {
    'stores-free': () => storeButtonsHtml('free'),
    'stores-plus': () => storeButtonsHtml('plus'),
    'banner-free': () => smartBannerHtml('free'),
    'banner-plus': () => smartBannerHtml('plus'),
    'gallery-free': () => galleryHtml(shots(), 'free', { sizes: card, className: 'fit', label: 'Win Zero screenshots' }),
    'gallery-plus': () => galleryHtml(shots(), 'plus', { sizes: card, className: 'fit', label: 'Win Zero Plus screenshots' }),
    'gallery-promo': () =>
      galleryHtml(shots(), 'plus', {
        slugs: ['goals', 'pick-game', 'catch'],
        sizes: '(min-width: 860px) 150px, min(42vw, 180px)',
        className: 'small',
        label: 'Win Zero Plus screenshots',
      }),
    'plus-points': async () => plusPointsHtml(await loadFacts()),
    'app-cards': async () => appCardsHtml(await loadFacts()),
    'plus-games': async () => gamesHtml(await loadFacts()),
    'plus-themes': async () => themesHtml(await loadFacts()),
    'plus-price': () => price(APPS.plus),
    compare: async () => compareHtml(await loadFacts()),
    'faq-home': async () => faqHtml(homeFaqs(await loadFacts())),
    'faq-plus': async () => faqHtml(plusFaqs(await loadFacts())),
    'ld-home': async () => jsonLdHtml('home', await loadFacts()),
    'ld-plus': async () => jsonLdHtml('plus', await loadFacts()),
  };
}
