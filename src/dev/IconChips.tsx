// Development builds only, in Win Zero Plus (DebugSection shows it when FEATURES.altIcons): puts any
// icon on the home screen before Settings › App icon exists, including ones not earned yet, so each
// can be checked on a phone.
import { useCallback, useEffect, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';

import { themeById } from '@/engine';
import { APP_ICONS, availableIcons, type AppIconDef, type AppIconId } from '@/engine/icons';
import { arsenalBestOf, useApp } from '@/store';
import { space } from '@/theme/tokens';
import { Chip, Eyebrow, Fine } from '@/ui/bits';
import { APP_NAME, LIMITS } from '@/variant';

// Win Zero Plus only: Metro folds the literal comparison and drops the require from Win Zero.
const appIcon: typeof import('@/plus/appIcon') | null =
  process.env.EXPO_PUBLIC_APP_VARIANT === 'plus'
    ? // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('@/plus/appIcon')
    : null;

const nameOf = (icon: AppIconDef) => (icon.theme ? themeById(icon.theme).name : APP_NAME);

export function IconChips() {
  const best = useApp(arsenalBestOf);
  const [current, setCurrent] = useState<AppIconId | null>(null);
  const [supported, setSupported] = useState(true);
  const [note, setNote] = useState<string | null>(null);
  const open = availableIcons(best, { iconsEnabled: LIMITS.iconsEnabled });

  // What the home screen shows, read again whenever the app comes back.
  const read = useCallback(() => {
    if (!appIcon) return;
    appIcon.currentIcon().then(setCurrent, () => setCurrent(null));
    appIcon.iconSwitching().then(setSupported, () => setSupported(false));
  }, []);
  useEffect(() => {
    read();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') read();
    });
    return () => sub.remove();
  }, [read]);

  if (!appIcon) return null;
  const pick = (id: AppIconId) => {
    setNote(null);
    appIcon.setIcon(id).then(setCurrent, (e: unknown) => setNote(`Couldn't change the icon: ${String(e)}`));
  };

  return (
    <>
      <Eyebrow>App icon</Eyebrow>
      <Fine>
        Changes the home-screen icon, including ones not earned yet. Android closes the app if it was opened from the
        icon being replaced, so open it again from the new one. iPhone says the icon changed.
      </Fine>
      {supported ? (
        <View style={styles.row}>
          {APP_ICONS.map((icon) => (
            <Chip
              key={icon.id}
              label={open.some((i) => i.id === icon.id) ? nameOf(icon) : `${nameOf(icon)} · locked until ${icon.unlockAt}`}
              selected={current === icon.id}
              onPress={() => pick(icon.id)}
            />
          ))}
        </View>
      ) : (
        <Fine>This phone can&apos;t change app icons.</Fine>
      )}
      {note ? <Fine>{note}</Fine> : null}
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
