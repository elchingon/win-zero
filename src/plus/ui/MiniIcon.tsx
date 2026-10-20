// A small drawing of one of Win Zero Plus's home-screen icons: its 0 and + in the icon's colors,
// as gen-brand-plus.mjs draws them (assets/brand-plus/manifest.json): the theme's first and third
// zero colors on navy, Gold Year a navy mark on gold, and the Plus icon an amber 0 with a white +.
import { StyleSheet, Text, View } from 'react-native';

import type { AppIconId } from '@/engine/icons';
import { THEME_LOOKS } from '@/theme/themes';
import { colors, fonts } from '@/theme/tokens';

/** The Plus icon's own + (manifest.json palette.white). */
const PLUS_WHITE = '#FFFFFF';
/** Corner radius as a share of the tile, near the iOS icon's. */
const CORNER = 0.22;

/** Where the + sits: up and to the right of the 0, as on the icon. */
const corner = (size: number) => ({ top: size * 0.1, right: size * 0.12 });

function iconColors(id: AppIconId): { field: string; zero: string; plus: string } {
  if (id === 'default') return { field: colors.ink, zero: colors.amber, plus: PLUS_WHITE };
  const { palette } = THEME_LOOKS[id];
  if (id === 'gold') return { field: palette[0], zero: colors.ink, plus: colors.ink };
  return { field: colors.ink, zero: palette[0], plus: palette[2] };
}

export function MiniIcon({ id, size = 52 }: { id: AppIconId; size?: number }) {
  const { field, zero, plus } = iconColors(id);
  return (
    <View
      style={[styles.tile, { width: size, height: size, borderRadius: size * CORNER, backgroundColor: field }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Text style={[styles.zero, { color: zero, fontSize: size * 0.5, lineHeight: size * 0.6 }]}>0</Text>
      <Text style={[styles.plus, { color: plus, fontSize: size * 0.28, lineHeight: size * 0.32 }, corner(size)]}>+</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line, overflow: 'hidden' },
  zero: { fontFamily: fonts.display },
  plus: { position: 'absolute', fontFamily: fonts.display },
});
