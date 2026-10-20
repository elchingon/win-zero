// How it works: the rules in plain words, reached from Settings. Setup shows them once; this is
// where to look again. The words live in src/ui/copy/rules.ts, shared with the website.
import { router } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { isEveryDay } from '@/engine';
import { useApp } from '@/store';
import { space, type } from '@/theme/tokens';
import { Em, Lede, shared } from '@/ui/bits';
import { TopBar } from '@/ui/Brand';
import { LinkButton } from '@/ui/Button';
import { howItWorks } from '@/ui/copy/rules';
import { Screen } from '@/ui/Screen';
import { APP_NAME } from '@/variant';

export default function HowItWorks() {
  // Win Zero Plus's goals can check in on chosen days (SPEC 9); then the words follow them.
  const everyDay = useApp((s) => s.goals.every((slot) => isEveryDay(slot.goal)));
  // The app sends reminders, so its rules mention them.
  const sections = useMemo(() => howItWorks({ notifications: true, appName: APP_NAME, everyDay }), [everyDay]);
  return (
    <Screen>
      <TopBar right={<LinkButton label="Done" onPress={() => router.back()} />} />
      <Text style={type.h2} accessibilityRole="header">
        How it <Em>works</Em>
      </Text>
      {sections.map((s) => (
        <View key={s.title} style={shared.section}>
          <Text style={type.question} accessibilityRole="header">
            {s.title}
          </Text>
          <View style={styles.body}>
            {s.body.map((line) => (
              <Lede key={line}>{line}</Lede>
            ))}
          </View>
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: space.sm },
});
