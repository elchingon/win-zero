import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { colors } from '@/theme/tokens';

/** Full-screen celebration after the OS launch mark, including on Android. */
export function LaunchSplash({ ready, onFinish }: { ready: boolean; onFinish: () => void }) {
  const [loaded, setLoaded] = useState(false);
  const [laidOut, setLaidOut] = useState(false);
  const [presented, setPresented] = useState(false);

  useEffect(() => {
    if (!loaded || !laidOut) return;
    // Wait for the artwork to be decoded and laid out before uncovering it.
    SplashScreen.hide();
    const timer = setTimeout(() => setPresented(true), 1100);
    return () => clearTimeout(timer);
  }, [loaded, laidOut]);

  useEffect(() => {
    if (ready && presented) onFinish();
  }, [ready, presented, onFinish]);

  return (
    <View style={styles.root} onLayout={() => setLaidOut(true)} accessibilityLabel="WIN ZERO" accessibilityRole="image">
      <Image
        source={require('../../assets/brand/splash.png')}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
        onLoadEnd={() => setLoaded(true)}
        accessible={false}
        fadeDuration={0}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
});
