// Settings › Themes (SPEC 9): the colors of the round and of Home's drifting zeros. The earned
// themes show the best streak that opens them, never a price.
import { StyleSheet, View } from 'react-native';

import { availableThemes, THEMES, type ThemeId } from '@/engine';
import { appStore, arsenalBestOf, themeOf, useApp } from '@/store';
import { THEME_LOOKS } from '@/theme/themes';
import { Eyebrow, Fine, shared } from '@/ui/bits';

import { THEMES_COPY } from '../copy';
import { ChoiceRow } from '../ui/ChoiceRow';

/** The theme's four zero colors, side by side. */
function Swatch({ id }: { id: ThemeId }) {
  return (
    <View style={styles.swatch} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {THEME_LOOKS[id].palette.map((color, i) => (
        <View key={i} style={[styles.ring, { borderColor: color }]} />
      ))}
    </View>
  );
}

export function ThemesSection() {
  const best = useApp(arsenalBestOf);
  const themesEnabled = useApp((s) => s.limits.themesEnabled);
  const theme = useApp(themeOf);
  const open = availableThemes(best, { themesEnabled });
  return (
    <View style={shared.section}>
      <Eyebrow header>{THEMES_COPY.title}</Eyebrow>
      <Fine>{THEMES_COPY.lede}</Fine>
      <View style={shared.list} accessibilityRole="radiogroup">
        {THEMES.map((t) => {
          const locked = !open.some((o) => o.id === t.id);
          const earned = t.source === 'earned';
          const detail = !earned ? undefined : locked ? THEMES_COPY.opensAt(t.unlockAt) : THEMES_COPY.earnedAt(t.unlockAt);
          return (
            <ChoiceRow
              key={t.id}
              left={<Swatch id={t.id} />}
              label={t.name}
              detail={detail}
              checked={t.id === theme}
              disabled={locked}
              accessibilityHint="Colors your rounds and Home's zeros with it"
              onPress={() => appStore.getState().setTheme(t.id)}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  swatch: { flexDirection: 'row', gap: 3 },
  ring: { width: 10, height: 13, borderRadius: '50%', borderWidth: 2.5 },
});
