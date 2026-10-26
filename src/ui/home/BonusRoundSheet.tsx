// Choosing a bonus round's size: type a number or tap a ready-made one, then Start, which spends a
// Game credit. Cancel, tapping outside or Android's back button closes it with the credit kept.
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { BONUS_MAX_N } from '@/engine';
import { formatCount, parseCount } from '@/lib/format';
import { space } from '@/theme/tokens';
import { Chip, Field, shared, TextField } from '@/ui/bits';
import { BottomSheet } from '@/ui/BottomSheet';
import { Button } from '@/ui/Button';
import { BONUS_DEFAULT_N, BONUS_PRESETS, BONUS_SHEET } from '@/ui/copy/credits';

export function BonusRoundSheet(props: { visible: boolean; onStart: (n: number) => void; onCancel: () => void }) {
  const { visible, onStart, onCancel } = props;
  return (
    <BottomSheet visible={visible} title={BONUS_SHEET.title} onClose={onCancel}>
      <SizeChooser onStart={onStart} onCancel={onCancel} />
    </BottomSheet>
  );
}

function SizeChooser({ onStart, onCancel }: { onStart: (n: number) => void; onCancel: () => void }) {
  const [text, setText] = useState(String(BONUS_DEFAULT_N));
  const n = parseCount(text, BONUS_MAX_N);
  return (
    <>
      <Field label={BONUS_SHEET.field} hint={BONUS_SHEET.hint} error={n ? null : BONUS_SHEET.invalid}>
        <TextField
          value={text}
          onChangeText={setText}
          keyboardType="number-pad"
          returnKeyType="done"
          maxLength={String(BONUS_MAX_N).length}
          accessibilityLabel={BONUS_SHEET.field}
        />
      </Field>
      <View style={shared.chips}>
        {BONUS_PRESETS.map((p) => (
          <Chip key={p} label={formatCount(p)} selected={n === p} onPress={() => setText(String(p))} />
        ))}
      </View>
      <View style={styles.actions}>
        <Button label={BONUS_SHEET.cancel} variant="ghost" onPress={onCancel} style={styles.action} />
        <Button
          label={BONUS_SHEET.start}
          accessibilityHint={BONUS_SHEET.startHint}
          disabled={!n}
          onPress={() => {
            if (n) onStart(n);
          }}
          style={styles.action}
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: space.md, paddingBottom: space.lg },
  action: { flex: 1 },
});
