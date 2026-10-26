// Home's banner after a notification's answer was turned down, said to a screen reader too. With
// several goals (Win Zero Plus), it names the goal the answer was for.
import { useEffect } from 'react';
import { AccessibilityInfo, StyleSheet, Text } from 'react-native';

import { slotById, useApp } from '@/store';
import { colors, fonts } from '@/theme/tokens';
import { Card, Eyebrow } from '@/ui/bits';
import { REJECTED } from '@/ui/copy/rules';

export function RejectionBanner({ named = false }: { named?: boolean }) {
  const rejection = useApp((s) => s.rejection);
  const goalName = useApp((s) => (named && s.rejection ? (slotById(s, s.rejection.goalId)?.goal.goal ?? null) : null));
  const banner = rejection ? REJECTED[rejection.reason] : null;
  const spoken = banner && goalName ? `${goalName}: ${banner}` : banner;
  useEffect(() => {
    if (spoken) AccessibilityInfo.announceForAccessibility(spoken);
  }, [spoken]);

  if (!banner) return null;
  return (
    <Card style={styles.banner}>
      {goalName ? <Eyebrow>{goalName}</Eyebrow> : null}
      <Text style={styles.bannerText}>{banner}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  banner: { borderColor: colors.flare },
  bannerText: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.fg },
});
