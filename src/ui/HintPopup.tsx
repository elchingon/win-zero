// A hint's popup: a title, what the hint says, and Got it, in the card that pops up over a dimmed
// screen (Popup). A real Modal, so it covers the whole screen from inside a scrolling one. Tapping
// outside the card or Android's back button closes it too, and a screen reader starts at the title.
import { useRef, type ReactNode } from 'react';
import { Modal, ScrollView, StyleSheet, Text, useWindowDimensions } from 'react-native';

import { colors, fonts, space } from '@/theme/tokens';

import { Button } from './Button';
import { Popup } from './Popup';

/** Long hints, at large text sizes, scroll within this much of the screen's height. */
const BODY_MAX_HEIGHT = 0.6;

export function HintPopup(props: {
  visible: boolean;
  title: string;
  onClose: () => void;
  closeLabel?: string;
  children: ReactNode;
}) {
  const { visible, title, onClose, closeLabel = 'Got it', children } = props;
  const heading = useRef<Text>(null);
  const { height } = useWindowDimensions();
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      {visible ? (
        <Popup onDismiss={onClose} focus={heading}>
          <Text ref={heading} style={styles.title} accessibilityRole="header">
            {title}
          </Text>
          <ScrollView style={{ maxHeight: height * BODY_MAX_HEIGHT }} contentContainerStyle={styles.body}>
            {children}
          </ScrollView>
          <Button label={closeLabel} onPress={onClose} />
        </Popup>
      ) : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: fonts.display, fontSize: 22, lineHeight: 26, color: colors.fg },
  body: { gap: space.md },
});
