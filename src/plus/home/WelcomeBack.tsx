// Win Zero Plus's welcome back (SPEC 9): after a comeback's round is played to the end, back on
// Home, a quote about getting back up, why coming back counts, and the win-back round the
// comeback gave, to play now or later. A Phoenix theme it opened has its own panel. Shown once per
// comeback, when Home is in front and its turn comes (homePopupOf), with the Yes chime and haptic.
import { router, useIsFocused } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { themeById } from '@/engine';
import { formatCount } from '@/lib/format';
import { appStore, comebackSlot, homePopupOf, useApp } from '@/store';
import { colors, radii, space, type } from '@/theme/tokens';
import { yesCelebration } from '@/ui/celebrate';
import { HintPopup } from '@/ui/HintPopup';

import { WELCOME_COPY } from '../copy';

/** A day's quote: the same one each time that comeback is shown. */
function quoteFor(day: string): string {
  const quotes = WELCOME_COPY.quotes;
  return quotes[Number(day.slice(8)) % quotes.length] ?? quotes[0];
}

export function WelcomeBack() {
  const slot = useApp(comebackSlot);
  const turn = useApp(homePopupOf) === 'comeback';
  const winBack = useApp((s) => s.winBack);
  const focused = useIsFocused();

  const round = slot?.round;
  const comeback = round?.comeback;
  const open = Boolean(slot && round && comeback && turn && focused);
  const key = open && slot && round ? `${slot.goal.goalId}:${round.day}` : null;

  useEffect(() => {
    if (key) yesCelebration.cue();
  }, [key]);

  const goalId = slot?.goal.goalId;
  const day = round?.day;
  const waiting = winBack && !winBack.played ? winBack : null;
  // The win-back this comeback gave, or one still waiting from an earlier comeback.
  const mine = waiting && waiting.goalId === goalId && waiting.day === day ? waiting : null;
  const phoenix = (round?.unlocks ?? []).map(themeById).filter((t) => t.source === 'comeback');

  const close = () => {
    if (goalId && day) appStore.getState().seeComeback(goalId, day);
  };
  const play = () => {
    close();
    router.push({ pathname: '/play', params: { round: 'winback' } });
  };

  return (
    <HintPopup
      visible={open}
      title={WELCOME_COPY.title}
      closeLabel={mine ? WELCOME_COPY.later : WELCOME_COPY.close}
      action={mine ? { label: WELCOME_COPY.play, onPress: play } : undefined}
      onClose={close}
    >
      {round && comeback ? (
        <>
          <Text style={type.question}>{quoteFor(round.day)}</Text>
          {WELCOME_COPY.lines(comeback.reset).map((line) => (
            <Text key={line} style={type.body}>
              {line}
            </Text>
          ))}
          {mine ? (
            <View style={styles.panel}>
              <Text style={type.question}>{WELCOME_COPY.winBack.title}</Text>
              <Text style={type.body}>{WELCOME_COPY.winBack.line(formatCount(mine.n))}</Text>
            </View>
          ) : waiting ? (
            <Text style={type.body}>{WELCOME_COPY.waiting}</Text>
          ) : null}
          {phoenix.map((t) => (
            <View key={t.id} style={styles.panel}>
              <Text style={type.question}>{WELCOME_COPY.phoenix.title(t.name)}</Text>
              <Text style={type.body}>{WELCOME_COPY.phoenix.line}</Text>
            </View>
          ))}
        </>
      ) : null}
    </HintPopup>
  );
}

const styles = StyleSheet.create({
  panel: { borderWidth: 2, borderColor: colors.amber, borderRadius: radii.lg, padding: space.md, gap: space.sm },
});
