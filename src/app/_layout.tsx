import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { fontAssets } from '@/theme/fonts';
import { colors } from '@/theme/tokens';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts(fontAssets);

  useEffect(() => {
    if (loaded || error) SplashScreen.hide();
  }, [loaded, error]);

  // Hold the splash until fonts are ready. On a font error, fall through to system fonts.
  if (!loaded && !error) return null;

  return (
    <GestureHandlerRootView style={styles.root}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.ink },
          animation: 'fade',
        }}
      />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
});
