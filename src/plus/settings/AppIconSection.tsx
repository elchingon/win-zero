// Settings › App icon (SPEC 9): the Plus icon, and one per theme that opens with it. The phone
// remembers which is showing (src/plus/appIcon.ts). iPhone switches at once and says so itself.
// Android closes the app if it was opened from the icon being replaced, so there the switch waits
// for a yes, with a word about the close: switching when the app went to the background instead
// could land under Plus's own share sheet or permission dialog, which background it too.
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppState, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { themeById } from '@/engine';
import { APP_ICONS, availableIcons, type AppIconDef, type AppIconId } from '@/engine/icons';
import { arsenalBestOf, useApp } from '@/store';
import { colors, fonts, space } from '@/theme/tokens';
import { Card, Eyebrow, Fine, shared } from '@/ui/bits';
import { Button } from '@/ui/Button';
import { feedback } from '@/ui/feedback';
import { APP_NAME } from '@/variant';

import { currentIcon, iconSwitching, setIcon } from '../appIcon';
import { ICON_COPY } from '../copy';
import { MiniIcon } from '../ui/MiniIcon';

const nameOf = (icon: AppIconDef) => (icon.theme ? themeById(icon.theme).name : APP_NAME);

export function AppIconSection() {
  const best = useApp(arsenalBestOf);
  const iconsEnabled = useApp((s) => s.limits.iconsEnabled);
  const [current, setCurrent] = useState<AppIconId | null>(null);
  const [supported, setSupported] = useState(true);
  const [armed, setArmed] = useState<AppIconDef | null>(null);
  const [failed, setFailed] = useState(false);
  const open = availableIcons(best, { iconsEnabled });

  // The icon can change outside this screen (Erase, or the debug chips), so read it again on the way in.
  const read = useCallback(() => {
    currentIcon().then(setCurrent, () => setCurrent(null));
    iconSwitching().then(setSupported, () => setSupported(false));
  }, []);
  useFocusEffect(read);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') read();
    });
    return () => sub.remove();
  }, [read]);

  const switchTo = (icon: AppIconDef) => {
    setArmed(null);
    setFailed(false);
    setIcon(icon.id).then(setCurrent, () => setFailed(true));
  };

  const choose = (icon: AppIconDef) => {
    if (icon.id === current) return;
    feedback.tick();
    if (Platform.OS === 'android') setArmed(icon);
    else switchTo(icon);
  };

  return (
    <View style={shared.section}>
      <Eyebrow header>{ICON_COPY.title}</Eyebrow>
      <Fine>{ICON_COPY.lede}</Fine>
      {supported ? (
        <View style={styles.grid} accessibilityRole="radiogroup">
          {APP_ICONS.map((icon) => {
            const locked = !open.some((i) => i.id === icon.id);
            const checked = icon.id === current;
            const name = nameOf(icon);
            const spoken = ICON_COPY.spoken(name);
            return (
              <Pressable
                key={icon.id}
                accessibilityRole="radio"
                accessibilityState={{ checked, disabled: locked }}
                accessibilityLabel={locked ? `${spoken}. ${ICON_COPY.opensWith(name, icon.unlockAt)}` : spoken}
                accessibilityHint={locked || checked ? undefined : 'Puts this icon on your home screen'}
                disabled={locked}
                onPress={() => choose(icon)}
                style={({ pressed }) => [styles.tile, locked && styles.locked, pressed && !checked && { opacity: 0.7 }]}
              >
                <View style={[styles.frame, checked && styles.frameOn]}>
                  <MiniIcon id={icon.id} />
                </View>
                <Text style={[styles.name, checked && styles.nameOn]} numberOfLines={2}>
                  {name}
                </Text>
                {locked ? <Text style={styles.opens}>{ICON_COPY.opensAt(icon.unlockAt)}</Text> : null}
              </Pressable>
            );
          })}
        </View>
      ) : (
        <Fine>{ICON_COPY.unsupported}</Fine>
      )}
      {armed ? (
        <Card style={styles.confirm}>
          <Text style={styles.confirmTitle}>{ICON_COPY.confirmTitle(nameOf(armed))}</Text>
          <Fine>{ICON_COPY.confirmBody(APP_NAME)}</Fine>
          <View style={styles.confirmRow}>
            <Button label={ICON_COPY.confirm} onPress={() => switchTo(armed)} style={styles.flex} />
            <Button variant="ghost" label={ICON_COPY.cancel} onPress={() => setArmed(null)} style={styles.flex} />
          </View>
        </Card>
      ) : null}
      {failed ? <Fine color={colors.flare}>{ICON_COPY.failed}</Fine> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  tile: { width: 72, alignItems: 'center', gap: space.xs },
  locked: { opacity: 0.5 },
  frame: { padding: 3, borderRadius: 16, borderWidth: 2, borderColor: 'transparent' },
  frameOn: { borderColor: colors.amber },
  name: { fontFamily: fonts.bodyMedium, fontSize: 12, lineHeight: 15, color: colors.muted, textAlign: 'center' },
  nameOn: { color: colors.fg },
  opens: { fontFamily: fonts.mono, fontSize: 10, color: colors.muted },
  confirm: { gap: space.md },
  confirmTitle: { fontFamily: fonts.bodyBold, fontSize: 17, color: colors.fg },
  confirmRow: { flexDirection: 'row', gap: space.md },
  flex: { flex: 1 },
});
