// A sheet that rises from the bottom over a dimmed screen, with a small title: the time picker,
// and choosing a bonus round's size. Tapping outside it or Android's back button closes it, and
// it rides up over the keyboard. Its contents mount each time it opens, so they start fresh.
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, fonts, radii, space, withAlpha } from '@/theme/tokens';

export function BottomSheet(props: { visible: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const { visible, title, onClose, children } = props;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      {visible ? (
        <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
          <SafeAreaView edges={['bottom']} style={styles.sheet}>
            <Text style={styles.title} accessibilityRole="header">
              {title}
            </Text>
            {children}
          </SafeAreaView>
        </KeyboardAvoidingView>
      ) : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: withAlpha(colors.ink, 0.7) },
  sheet: {
    backgroundColor: colors.ink2,
    borderTopLeftRadius: radii.xxl,
    borderTopRightRadius: radii.xxl,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: space.xl,
    paddingTop: space.xl,
    gap: space.lg,
  },
  title: { fontFamily: fonts.monoSemiBold, fontSize: 11, letterSpacing: 1.54, textTransform: 'uppercase', color: colors.muted },
});
