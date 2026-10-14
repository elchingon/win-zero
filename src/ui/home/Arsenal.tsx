// Weapons by unlock day with progress to the next one (the prototype's .arsenal list).
// Tapping an unlocked weapon equips it; a new unlock equips itself.
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { arsenal, equippedWeapon, nextUnlock, type GoalState, type WeaponId } from '@/engine';
import { plural } from '@/lib/format';
import { colors, fonts, space } from '@/theme/tokens';
import { Eyebrow, Fine, shared } from '@/ui/bits';
import { feedback } from '@/ui/feedback';

export function Arsenal(props: { goal: GoalState; pick: WeaponId | null; onEquip: (id: WeaponId) => void }) {
  const { goal, pick, onEquip } = props;
  const next = nextUnlock(goal.bestStreak, goal.streak);
  const equipped = equippedWeapon(pick, goal.bestStreak);
  const progress = next ? next.progress : 1;
  return (
    <View style={shared.section}>
      <View style={shared.sectionHead}>
        <Eyebrow header>Arsenal</Eyebrow>
        <Fine>{next ? `${next.weapon.name} in ${plural(next.daysToGo, 'day')}` : 'Fully armed'}</Fine>
      </View>
      <View
        style={styles.bar}
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={next ? `Next weapon: ${next.weapon.name}` : 'Every weapon unlocked'}
        accessibilityValue={
          next
            ? { min: 0, max: 100, now: Math.round(progress * 100), text: `${plural(next.daysToGo, 'day')} to go` }
            : { text: 'Fully armed' }
        }
      >
        <View style={[styles.fill, { width: `${Math.round(progress * 100)}%` }]} />
      </View>
      <View style={shared.list}>
        {arsenal(goal.bestStreak, goal.streak).map(({ weapon, unlocked, daysToGo }) => {
          const isEquipped = weapon.id === equipped.id;
          const status = isEquipped ? 'EQUIPPED' : unlocked ? 'READY' : `${daysToGo}D TO GO`;
          return (
            <Pressable
              key={weapon.id}
              // Not `disabled` when equipped, which screen readers would read as dimmed.
              disabled={!unlocked}
              onPress={() => {
                if (isEquipped) return;
                feedback.tick();
                onEquip(weapon.id);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: isEquipped, disabled: !unlocked }}
              accessibilityLabel={`${weapon.name}. ${weapon.description} ${
                isEquipped ? 'Equipped.' : unlocked ? 'Ready.' : `Unlocks in ${plural(daysToGo, 'day')}.`
              }`}
              accessibilityHint={unlocked && !isEquipped ? 'Equips it for your rounds' : undefined}
              style={({ pressed }) => [styles.row, !unlocked && styles.locked, pressed && !isEquipped && { opacity: 0.7 }]}
            >
              <Text style={[styles.day, unlocked && { color: colors.amber }]}>DAY {weapon.unlockAt}</Text>
              <View style={styles.text}>
                <Text style={styles.name}>{weapon.name}</Text>
                <Text style={styles.desc}>{weapon.description}</Text>
              </View>
              <Text style={[styles.status, isEquipped && styles.equipped]}>{status}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { height: 8, borderRadius: 99, backgroundColor: colors.panel2, overflow: 'hidden' },
  fill: {
    height: '100%',
    borderRadius: 99,
    experimental_backgroundImage: `linear-gradient(90deg, ${colors.flare}, ${colors.amber})`,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  locked: { opacity: 0.5 },
  day: { minWidth: 62, fontFamily: fonts.monoSemiBold, fontSize: 11, letterSpacing: 0.88, color: colors.muted },
  text: { flex: 1, gap: 2 },
  name: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.fg },
  desc: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.muted },
  status: {
    fontFamily: fonts.monoSemiBold,
    fontSize: 11,
    letterSpacing: 0.66,
    color: colors.muted,
    textAlign: 'right',
  },
  equipped: {
    color: colors.ink,
    backgroundColor: colors.teal,
    paddingVertical: 4,
    paddingHorizontal: 7,
    borderRadius: 6,
    overflow: 'hidden',
  },
});
