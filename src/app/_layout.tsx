import { useFonts } from 'expo-font';
import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { appStore, startLifecycle, useApp } from '@/store';
import { fontAssets } from '@/theme/fonts';
import { colors } from '@/theme/tokens';
import { ZeroField } from '@/ui/ZeroField';

SplashScreen.preventAutoHideAsync();

// Screens are transparent so the one drifting-zeros field shows through all of them.
const navTheme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: 'transparent', card: colors.ink, text: colors.fg, primary: colors.amber },
};

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(fontAssets);
  const hydrated = useApp((s) => s.hydrated);
  // On a font error, fall through to system fonts rather than holding the splash.
  const ready = (fontsLoaded || !!fontError) && hydrated;

  // Catch up on closed windows after storage loads and whenever the app comes back.
  useEffect(() => startLifecycle(appStore), []);

  useEffect(() => {
    if (ready) SplashScreen.hide();
  }, [ready]);

  if (!ready) return null;

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
        />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
});
