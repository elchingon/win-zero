// A screen's frame: safe-area insets, the 20pt gutter and 22pt section gap from the prototype.
// The background is the shared ZeroField behind the navigator, so screens stay transparent.
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { space } from '@/theme/tokens';

export function Screen(props: {
  children: ReactNode;
  /** Fixed, vertically centered content instead of a scrolling column. */
  centered?: boolean;
  /** Pinned to the bottom of a fixed screen (e.g. a result sheet). */
  footer?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { children, centered, footer, style } = props;
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {centered ? (
        <View style={[styles.content, styles.centered, style]}>{children}</View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.content, style]}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
        >
          {children}
        </ScrollView>
      )}
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { paddingHorizontal: space.xl, paddingTop: space.xl, paddingBottom: space.xxxl, gap: space.xxl },
  centered: { flex: 1, justifyContent: 'center' },
  footer: { paddingHorizontal: space.xl, paddingBottom: space.xl, gap: space.md },
});
