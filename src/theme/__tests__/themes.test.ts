// Each theme's colors: Classic is exactly today's round (SPEC 7), and every theme stays readable
// on the round's backdrop.
import { describe, expect, it } from '@jest/globals';

import { THEME_IDS } from '@/engine';
import { BULLET_LOOKS } from '@/game/look';

import { THEME_LOOKS } from '../themes';
import { colors, zeroPalette } from '../tokens';

/** WCAG AA for text, stricter than the 3:1 that graphics need. */
const MIN_CONTRAST = 4.5;

/** WCAG relative luminance of a #RRGGBB color. */
function luminance(hex: string): number {
  const n = Number.parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0);
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05);
}

describe('theme looks (SPEC 9)', () => {
  it('has a look for every theme and nothing else', () => {
    expect(Object.keys(THEME_LOOKS).sort()).toEqual([...THEME_IDS].sort());
  });

  it('keeps Classic exactly the round of today (SPEC 7)', () => {
    const classic = THEME_LOOKS.classic;
    expect(classic.palette).toEqual(zeroPalette);
    expect(classic.palette).toEqual(['#FFB52E', '#FF4F6D', '#3FDCCB', '#F5F0E6']);
    expect(classic.shots).toEqual(BULLET_LOOKS.map((l) => l.color));
    expect(classic.fillGlow).toEqual([colors.amber, colors.flare]);
  });

  it('writes every color as #RRGGBB', () => {
    for (const look of Object.values(THEME_LOOKS)) {
      for (const c of [...look.palette, ...look.shots, ...look.fillGlow]) expect(c).toMatch(/^#[0-9A-F]{6}$/);
    }
  });

  it('keeps every ring and shot readable on the backdrop, from ink to ink-2', () => {
    for (const [id, look] of Object.entries(THEME_LOOKS)) {
      for (const c of [...look.palette, ...look.shots]) {
        for (const bg of [colors.ink, colors.ink2]) {
          expect({ id, c, bg, ok: contrast(c, bg) >= MIN_CONTRAST }).toEqual({ id, c, bg, ok: true });
        }
      }
    }
  });

  it('makes slot 3 the lightest, so hit flashes still glow white', () => {
    for (const look of Object.values(THEME_LOOKS)) {
      const [a, b, c, light] = look.palette.map(luminance);
      expect(light).toBeGreaterThan(Math.max(a ?? 1, b ?? 1, c ?? 1));
    }
  });
});
