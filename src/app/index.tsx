// Phase 1 placeholder. Confirms on a device that the router, fonts, theme, Skia, and
// Reanimated all work in the dev build. Replaced by the real Home screen in Phase 2.
import { BlurMask, Canvas, Group, Oval, vec } from '@shopify/react-native-skia';
import { useEffect } from 'react';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import {
  Easing,
  type SharedValue,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, fonts, radii, space, type, zeroPalette } from '@/theme/tokens';

const RING_CANVAS_HEIGHT = 150;
const PULSE_MS = 1600;

export default function Placeholder() {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.screen}>
        <View style={styles.brand}>
          <View style={styles.mark} />
          <Text style={styles.brandText}>WIN ZERO</Text>
        </View>

        <Text style={type.h1}>
          Every day you win, there’s <Text style={styles.em}>one more zero</Text> to shoot.
        </Text>

        <RingDemo />

        <View style={styles.section}>
          <Text style={type.eyebrow}>Typefaces</Text>
          <Text style={[type.h2, styles.sample]}>Bungee 0000</Text>
          <Text style={type.body}>Barlow body copy. Supportive and plain.</Text>
          <Text style={[type.body, { fontFamily: fonts.bodyBold }]}>Barlow bold for goals.</Text>
          <Text style={type.fine}>JetBrains Mono · HUD 12 / 60 LEFT</Text>
        </View>

        <View style={styles.section}>
          <Text style={type.eyebrow}>Palette</Text>
          <View style={styles.swatches}>
            {Object.entries(colors).map(([name, hex]) => (
              <View key={name} style={styles.swatch}>
                <View style={[styles.chip, { backgroundColor: hex }]} />
                <Text style={type.fine}>{name}</Text>
              </View>
            ))}
          </View>
        </View>

        <Text style={type.fine}>
          Phase 1 build: foundation and rules engine. The real screens arrive in Phase 2.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function RingDemo() {
  const { width } = useWindowDimensions();
  const w = width - space.xl * 2;
  const t = useSharedValue(0);

  useEffect(() => {
    t.set(withRepeat(withTiming(1, { duration: PULSE_MS, easing: Easing.inOut(Easing.quad) }), -1, true));
  }, [t]);

  const ry = RING_CANVAS_HEIGHT * 0.28;
  return (
    <Canvas style={{ width: w, height: RING_CANVAS_HEIGHT }}>
      {zeroPalette.map((color, i) => (
        <Ring
          key={color}
          t={t}
          phase={i * 0.25}
          cx={(w / (zeroPalette.length + 1)) * (i + 1)}
          cy={RING_CANVAS_HEIGHT / 2}
          ry={ry}
          color={color}
        />
      ))}
    </Canvas>
  );
}

function Ring(props: {
  t: SharedValue<number>;
  phase: number;
  cx: number;
  cy: number;
  ry: number;
  color: string;
}) {
  const { t, phase, cx, cy, ry, color } = props;
  const rx = ry * 0.72;
  const stroke = ry * 0.3;
  const transform = useDerivedValue(() => [{ scale: 0.9 + 0.12 * Math.sin((t.get() + phase) * Math.PI) }]);
  return (
    <Group origin={vec(cx, cy)} transform={transform}>
      <Oval
        x={cx - rx + stroke / 2}
        y={cy - ry + stroke / 2}
        width={(rx - stroke / 2) * 2}
        height={(ry - stroke / 2) * 2}
        style="stroke"
        strokeWidth={stroke}
        color={color}
      >
        <BlurMask blur={ry * 0.3} style="solid" />
      </Oval>
    </Group>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.ink },
  screen: { paddingHorizontal: space.xl, paddingTop: space.xl, paddingBottom: space.xxxl, gap: space.xxl },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  mark: {
    width: 18,
    height: 24,
    borderWidth: 5,
    borderColor: colors.amber,
    borderRadius: '50%',
    shadowColor: colors.amber,
    shadowOpacity: 0.55,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 0 },
  },
  brandText: { fontFamily: fonts.display, fontSize: 19, color: colors.fg, letterSpacing: 0.4 },
  em: { color: colors.amber },
  section: { gap: space.sm },
  sample: { color: colors.amber },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  swatch: { width: 72, gap: space.xxs },
  chip: { height: 36, borderRadius: radii.md, borderWidth: 1, borderColor: colors.line },
});
