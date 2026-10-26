import { describe, expect, it } from 'vitest';

import { entryFor, PLACEHOLDER, renderMarkdown } from './pages';
import { isNativeOnly, isShared } from './shared-guard';

describe('shared-guard', () => {
  it('allows the pure shared modules', () => {
    expect(isShared('engine/rules.ts')).toBe(true);
    expect(isShared('engine/index.ts')).toBe(true);
    expect(isShared('game/sim/step.ts')).toBe(true);
    expect(isShared('game/draw/scene.ts')).toBe(true);
    expect(isShared('game/sim/modes/catch.ts')).toBe(true);
    expect(isShared('game/draw/modes/catch.ts')).toBe(true);
    expect(isShared('ui/copy/modes.ts')).toBe(true);
    expect(isShared('store/createAppStore.ts')).toBe(true);
    expect(isShared('lib/format.ts')).toBe(true);
    expect(isShared('dev/seedRun.ts')).toBe(true);
  });

  it('turns away app-only files and tests', () => {
    expect(isShared('store/index.ts')).toBe(false);
    expect(isShared('ui/support.ts')).toBe(false);
    expect(isShared('game/bake/kit.ts')).toBe(false);
    expect(isShared('game/GameCanvas.tsx')).toBe(false);
    expect(isShared('app/index.tsx')).toBe(false);
    expect(isShared('engine/__tests__/rules.test.ts')).toBe(false);
    expect(isShared('game/sim/__tests__/fixtures.ts')).toBe(false);
    expect(isShared('game/sim/modes/__tests__/catch.test.ts')).toBe(false);
  });

  it('spots native-only packages', () => {
    for (const p of ['react-native', 'react-native-reanimated', 'expo', 'expo-haptics', '@expo/vector-icons',
      '@react-native-async-storage/async-storage', '@shopify/react-native-skia', 'react-native/Libraries/x']) {
      expect(isNativeOnly(p)).toBe(true);
    }
    for (const p of ['react', 'react-dom/client', 'zustand/vanilla', 'react-router', '@fontsource/bungee/latin-400.css', 'expose']) {
      expect(isNativeOnly(p)).toBe(false);
    }
  });
});

describe('pages', () => {
  it('maps clean URLs to their entries the way Cloudflare Pages does', () => {
    expect(entryFor('/privacy')).toBe('/privacy.html');
    expect(entryFor('/support?x=1')).toBe('/support.html');
    expect(entryFor('/play')).toBe('/play.html');
    expect(entryFor('/play/settings')).toBe('/play.html');
    expect(entryFor('/playground')).toBeNull();
    expect(entryFor('/')).toBeNull();
  });

  it('finds unfilled store placeholders, not ordinary brackets', () => {
    expect('Effective [EFFECTIVE_DATE]'.match(PLACEHOLDER)).toEqual(['[EFFECTIVE_DATE]']);
    expect('[privacy policy]([PRIVACY_URL])'.match(PLACEHOLDER)).toEqual(['[PRIVACY_URL]']);
    expect('Tap [Yes] or [OK], see [1]'.match(PLACEHOLDER)).toBeNull();
  });

  it('renders the store markdown', () => {
    expect(renderMarkdown('# Title\n\n**Bold** [link](https://winzero.app/privacy)')).toBe(
      '<h1>Title</h1>\n<p><strong>Bold</strong> <a href="https://winzero.app/privacy">link</a></p>\n',
    );
  });
});
