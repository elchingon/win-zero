// Win Zero Plus's theme icons (SPEC 9) are drawn in each theme's colors. gen-brand-plus.mjs records
// the colors it drew with in assets/brand-plus/manifest.json; this holds them to THEME_LOOKS, so a
// theme can't change color without its icon being rendered again (npm run gen:brand:plus).
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from '@jest/globals';

import { THEME_IDS } from '@/engine';

import { THEME_LOOKS } from '../themes';

const folder = path.resolve(__dirname, '../../../assets/brand-plus');
const manifest = JSON.parse(fs.readFileSync(path.join(folder, 'manifest.json'), 'utf8')) as {
  icons: Record<string, { zero: string; plus: string; glow: string[]; field?: string[] }>;
  assets: { name: string; sha256: string }[];
};
/** Every format the Plus icon itself comes in. */
const FILES = [
  'app-store-icon.png',
  'ios-icon-dark.png',
  'ios-icon-tinted.png',
  'android-foreground.png',
  'android-background.png',
  'android-monochrome.png',
];

describe('theme icon art', () => {
  it('has one icon per theme', () => {
    expect(Object.keys(manifest.icons)).toEqual(THEME_IDS);
  });

  it('draws each icon in its theme’s colors', () => {
    for (const id of THEME_IDS) {
      const look = THEME_LOOKS[id];
      expect([id, manifest.icons[id]?.zero, manifest.icons[id]?.plus]).toEqual([id, look.palette[0], look.palette[2]]);
      expect(manifest.icons[id]?.glow).toEqual(look.fillGlow);
    }
  });

  it('sets Gold Year apart from the Plus icon with a field in its own colors', () => {
    const gold = THEME_LOOKS.gold;
    expect(manifest.icons.gold?.field).toEqual([gold.palette[3], gold.palette[0], gold.fillGlow[1]]);
    for (const id of THEME_IDS.filter((t) => t !== 'gold')) expect(manifest.icons[id]?.field).toBeUndefined();
  });

  it('has every format for every icon, as rendered', () => {
    const listed = new Map(manifest.assets.map((a) => [a.name, a.sha256]));
    for (const id of THEME_IDS) {
      for (const file of FILES) {
        const name = `icons/${id}/${file}`;
        const bytes = fs.readFileSync(path.join(folder, name));
        expect([name, createHash('sha256').update(bytes).digest('hex')]).toEqual([name, listed.get(name)]);
      }
    }
  });
});
