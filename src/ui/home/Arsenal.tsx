// Weapons by unlock day with progress to the next one (the prototype's .arsenal list), shared
// by every goal and named by the game mode (SPEC 9). Tapping an unlocked weapon equips it; a new
// unlock equips itself.
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { arsenal, DEFAULT_MODE, equippedWeapon, nextUnlock, type ModeId, type WeaponId } from '@/engine';
import { plural } from '@/lib/format';
import { colors, fonts, space } from '@/theme/tokens';
import { Eyebrow, Fine, shared } from '@/ui/bits';
import { MODE_COPY, powerUp } from '@/ui/copy/modes';
import { feedback } from '@/ui/feedback';

export function Arsenal(props: {
  /** How far the shared arsenal reaches (arsenalBestOf). */
  best: number;
  /** The streak closest to the next unlock (arsenalStreakOf). */
  streak: number;
  pick: WeaponId | null;
  onEquip: (id: WeaponId) => void;
  /** The game rounds play in, which names the power-ups (Win Zero Plus). The Shooter when absent. */
  mode?: ModeId;
}) {
  const { best, streak, pick, onEquip, mode = DEFAULT_MODE } = props;
  const next = nextUnlock(best, streak);
  const nextUp = next ? powerUp(mode, next.weapon) : null;
  const kind = MODE_COPY[mode].tier.toLowerCase();
  const equipped = equippedWeapon(pick, best);
  const progress = next ? next.progress : 1;
  return (
    <View style={shared.section}>
      <View style={shared.sectionHead}>
        <Eyebrow header>Arsenal</Eyebrow>
        <Fine>{next && nextUp ? `${nextUp.name} in ${plural(next.daysToGo, 'day')}` : 'Fully armed'}</Fine>
      </View>
      <View
        style={styles.bar}
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={nextUp ? `Next ${kind}: ${nextUp.name}` : `Every ${kind} unlocked`}
        accessibilityValue={
          next
            ? { min: 0, max: 100, now: Math.round(progress * 100), text: `${plural(next.daysToGo, 'day')} to go` }
            : { text: 'Fully armed' }
        }
      >
        <View style={[styles.fill, { width: `${Math.round(progress * 100)}%` }]} />
      </View>
      <View style={shared.list}>
        {arsenal(best, streak).map(({ weapon, unlocked, daysToGo }) => {
          const isEquipped = weapon.id === equipped.id;
          const { name, description } = powerUp(mode, weapon);
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
              accessibilityLabel={`${name}.${description ? ` ${description}` : ''} ${
                isEquipped ? 'Equipped.' : unlocked ? 'Ready.' : `Unlocks in ${plural(daysToGo, 'day')}.`
              }`}
              accessibilityHint={unlocked && !isEquipped ? 'Equips it for your rounds' : undefined}
              style={({ pressed }) => [styles.row, !unlocked && styles.locked, pressed && !isEquipped && { opacity: 0.7 }]}
            >
              <Text style={[styles.day, unlocked && { color: colors.amber }]}>DAY {weapon.unlockAt}</Text>
              <View style={styles.text}>
                <Text style={styles.name}>{name}</Text>
                {description ? <Text style={styles.desc}>{description}</Text> : null}
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
