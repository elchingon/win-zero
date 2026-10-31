// Home's celebrations after a milestone's round (SPEC 6): a quote, congratulations, what the round
// earned in its own panels, and a push to keep going. Each shows once, when Home is back in front:
// Home stays mounted under the round, and the popup is a Modal, which would otherwise open over it.
// The chime and haptic are the Yes celebration's, played by the overlay at the root.
import { useIsFocused } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { celebrationFor } from '@/engine';
import { appStore, arsenalBestOf, celebrationSlot, gameModeOf, useApp } from '@/store';
import { colors, radii, space, type } from '@/theme/tokens';
import { yesCelebration } from '@/ui/celebrate';
import { celebrationCopy } from '@/ui/copy/celebrations';
import { HintPopup } from '@/ui/HintPopup';
import { FEATURES } from '@/variant';

import { CelebrationMark } from './CelebrationMark';

export function Celebrations() {
  const slot = useApp(celebrationSlot);
  const best = useApp(arsenalBestOf);
  const gameMode = useApp(gameModeOf);
  const focused = useIsFocused();

  const celebration = slot?.round && focused ? celebrationFor(slot.round) : null;
  const id = celebration?.id ?? null;
  const tip =
    celebration && slot?.round
      ? celebrationCopy(celebration, { round: slot.round, goal: slot.goal, best, gameMode, icons: FEATURES.altIcons })
      : null;

  useEffect(() => {
    if (id) yesCelebration.cue();
  }, [id]);

  return (
    <HintPopup
      visible={tip !== null}
      title={tip?.title ?? ''}
      closeLabel={tip?.button}
      onClose={() => {
        if (id) appStore.getState().seeTip(id);
      }}
    >
      {tip ? (
        <>
          <Text style={type.question}>{tip.quote}</Text>
          {tip.lines.map((line) => (
            <Text key={line} style={type.body}>
              {line}
            </Text>
          ))}
          {tip.highlights.map((highlight) => (
            <View key={highlight.title} style={styles.panel}>
              <View style={styles.heading}>
                <CelebrationMark kind={highlight.kind} />
                <Text style={[type.question, styles.title]}>{highlight.title}</Text>
              </View>
              {highlight.lines.map((line) => (
                <Text key={line} style={type.body}>
                  {line}
                </Text>
              ))}
            </View>
          ))}
          <Text style={type.body}>{tip.closing}</Text>
        </>
      ) : null}
    </HintPopup>
  );
}

const styles = StyleSheet.create({
  panel: { borderWidth: 2, borderColor: colors.amber, borderRadius: radii.lg, padding: space.md, gap: space.sm },
  heading: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  title: { flex: 1 },
});
