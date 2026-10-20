import { useFonts } from 'expo-font';
import { DarkTheme, router, Stack, ThemeProvider, usePathname, type ErrorBoundaryProps } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AppState, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { startNotifications } from '@/notifications';
import { reportPath } from '@/notifications/route';
import { appStore, startLifecycle, useApp } from '@/store';
import { fontAssets } from '@/theme/fonts';
import { colors } from '@/theme/tokens';
import { importDelivery, startMoveAcks, subscribe } from '@/transfer/inbox';
import { transport } from '@/transfer/transport';
import { playAnimation } from '@/ui/celebrate';
import { CrashScreen } from '@/ui/CrashScreen';
import { APP_LINKS } from '@/ui/support';
import { ZeroField } from '@/ui/ZeroField';
import { LaunchSplash } from '@/ui/LaunchSplash';
import { YesCelebration } from '@/ui/YesCelebration';
import { APP_NAME, FEATURES } from '@/variant';

// Win Zero Plus only: release builds inline the variant, and Metro folds the literal comparison
// and drops the require, so Win Zero's bundle leaves out the icon code.
const startIconGuard: ((store: typeof appStore) => () => void) | null =
  process.env.EXPO_PUBLIC_APP_VARIANT === 'plus'
    ? // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('@/plus/iconGuard').startIconGuard
    : null;

SplashScreen.preventAutoHideAsync();

// Screens are transparent so the one drifting-zeros field shows through all of them.
const navTheme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: 'transparent', card: colors.ink, text: colors.fg, primary: colors.amber },
};

/**
 * A render crash anywhere outside the round (which has its own). Everything is saved as it
 * changes, so nothing is lost. The navigator went down with the layout, so the router can't be
 * used here: Back to base renders the app again, and its fresh stack starts at Home.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <CrashScreen
      eyebrow="Something went wrong"
      title={[`${APP_NAME} hit `, 'a snag.']}
      body={[
        'Your streak, history and rewards are saved on this phone.',
        `If it keeps happening, email us at ${APP_LINKS.email}.`,
      ]}
      action="Back to base"
      onAction={() => void retry()}
      error={error}
    />
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(fontAssets);
  const hydrated = useApp((s) => s.hydrated);
  // On a font error, fall through to system fonts rather than holding the splash.
  const ready = (fontsLoaded || !!fontError) && hydrated;
  const pathname = usePathname();
  const [launched, setLaunched] = useState(false);
  const finishLaunch = useCallback(() => setLaunched(true), []);

  // Catch up on closed windows after storage loads and whenever the app comes back.
  useEffect(() => startLifecycle(appStore, AppState), []);
  // Then keep the scheduled reminders in step with the goal, and answer from notifications.
  useEffect(() => startNotifications(), []);
  // Notification handling needs to know which screen is up, once there is one.
  useEffect(() => reportPath(ready && launched ? pathname : null), [ready, launched, pathname]);
  // Win Zero: Plus's word that a move arrived (SPEC 9), which +native-intent left in the inbox.
  useEffect(() => (FEATURES.moveOut ? startMoveAcks(appStore, transport) : undefined), []);
  // Win Zero Plus: an earned theme's icon goes back to the app's own if Erase un-earns it (SPEC 9).
  useEffect(() => startIconGuard?.(appStore), []);
  // Win Zero Plus: a move that arrived while the splash was up opens once the screens can. Each
  // delivery once: backing out of /import doesn't bring it back.
  const delivery = useSyncExternalStore(subscribe, importDelivery);
  const routed = useRef(0);
  useEffect(() => {
    if (!FEATURES.importIn || !ready || !launched || !delivery || delivery.seq === routed.current) return;
    routed.current = delivery.seq;
    if (pathname !== '/import') router.push('/import');
  }, [ready, launched, delivery, pathname]);

  if (!ready || !launched) {
    return (
      <GestureHandlerRootView style={styles.root}>
        <StatusBar style="light" />
        <LaunchSplash ready={ready} onFinish={finishLaunch} />
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <ThemeProvider value={navTheme}>
        <StatusBar style="light" />
        <ZeroField />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: 'transparent' },
            animation: 'fade',
          }}
        >
          {/* A Yes's round opens under the celebration's dark, with no fade of its own. */}
          <Stack.Screen name="play" options={() => ({ animation: playAnimation() })} />
        </Stack>
        <YesCelebration />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
});
