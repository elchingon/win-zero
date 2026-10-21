// The two halves of Home with several goals (SPEC 9), below the check-ins: Goals (the picked
// goal's numbers and history) and Game (the shared credits and arsenal). Read out as tabs.
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radii, space } from '@/theme/tokens';
import { feedback } from '@/ui/feedback';
import { MIN_TARGET } from '@/ui/target';

import { HOME_COPY } from '../copy';

export type HomeTab = 'goals' | 'game';

const TABS: readonly HomeTab[] = ['goals', 'game'];


export function HomeTabs(props: { tab: HomeTab; onTab: (tab: HomeTab) => void }) {
  const { tab, onTab } = props;
  return (
    <View style={styles.tabs} accessibilityRole="tablist">
      {TABS.map((id) => {
        const on = id === tab;
        return (
          <Pressable
            key={id}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={HOME_COPY.tabs[id]}
            onPress={() => {
              if (on) return;
              feedback.tick();
              onTab(id);
            }}
            style={({ pressed }) => [styles.tab, on && styles.tabOn, pressed && !on && { opacity: 0.7 }]}
          >
            <Text style={[styles.label, on && { color: colors.amber }]}>{HOME_COPY.tabs[id]}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.pill,
    padding: space.xxs,
    gap: space.xxs,
  },
  tab: {
    flex: 1,
    minHeight: MIN_TARGET,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.md,
  },
  tabOn: { backgroundColor: colors.panel2 },
  label: { fontFamily: fonts.monoSemiBold, fontSize: 13, letterSpacing: 1.3, textTransform: 'uppercase', color: colors.muted },
});
