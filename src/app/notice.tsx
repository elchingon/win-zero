// Reset / Shielded / Slipping: what a Not today, or a run of missed days, did to the streak.
// Shown once. The copy is supportive and plain: some people here are working on sobriety.
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View } from 'react-native';

import { pendingWindow } from '@/engine';
import { appStore, slotById, UNDO_MS, UNDO_MS_SCREEN_READER, useApp } from '@/store';
import { colors, space, type } from '@/theme/tokens';
import { useScreenReader } from '@/ui/a11y';
import { Em, Eyebrow, Lede } from '@/ui/bits';
import { Button, LinkButton } from '@/ui/Button';
import { copyFor, noticeColors, UNDONE } from '@/ui/copy/notice';
import { NoticeZero } from '@/ui/NoticeZero';
import { Screen } from '@/ui/Screen';
import { callSupportLine, SUPPORT_LINE } from '@/ui/support';

export default function NoticeScreen() {
  // Snapshot it, and mark it shown: it appears once, and the store may move on while it's up.
  // The link names the goal it's for; anything else waiting comes after.
  const { goal: goalId } = useLocalSearchParams<{ goal?: string }>();
  const [pending] = useState(() => appStore.getState().nextNotice(goalId));
  const goal = useApp((s) => (pending ? (slotById(s, pending.goalId)?.goal ?? null) : null));
  const route = useApp((s) => s.route);
  const undo = useApp((s) => s.undo);
  const screenReader = useScreenReader();
  const [, setTick] = useState(0);

  useEffect(() => {
    if (pending) appStore.getState().noticeShown(pending);
  }, [pending]);

  // A Not today shown here can be taken back for a few seconds, in case it was a mis-tap.
  const undoMs = screenReader ? UNDO_MS_SCREEN_READER : UNDO_MS;
  const undoEndsAt = pending?.source === 'answer' && undo?.notice === pending.notice ? undo.at + undoMs : null;
  const canUndo = undoEndsAt !== null && appStore.getState().now().getTime() < undoEndsAt;
  useEffect(() => {
    if (undoEndsAt === null) return;
    const id = setTimeout(() => setTick((t) => t + 1), Math.max(0, undoEndsAt - appStore.getState().now().getTime()));
    return () => clearTimeout(id);
  }, [undoEndsAt]);

  if (!pending || !goal) return <Redirect href="/" />;

  const { notice } = pending;
  const copy = copyFor(notice);
  const color = noticeColors[notice.kind];
  // An answer can land while this is up (a notification's buttons), so the way on is read live.
  const canAnswer = pendingWindow(goal, appStore.getState().now()) !== null;
  const next = route?.path === '/play' ? 'Play your round' : canAnswer && notice.kind !== 'noted' ? 'Check in now' : 'Got it';
  const close = () => router.dismissTo('/');
  const takeBack = () => {
    // Turned down (the check-in just closed, say): the button goes, as the store drops the undo.
    if (!appStore.getState().undoNotToday(undoMs)) return;
    AccessibilityInfo.announceForAccessibility(UNDONE);
    close();
  };

  return (
    <Screen centered>
      <NoticeZero color={color} motion={copy.motion} />
      <View style={styles.block}>
        <Eyebrow>{copy.eyebrow}</Eyebrow>
        <Text style={type.h2} accessibilityRole="header">
          {copy.title[0]}
          <Em color={notice.kind === 'shielded' ? colors.teal : colors.amber}>{copy.title[1]}</Em>
        </Text>
      </View>
      <View style={styles.block}>
        {copy.body.map((line) => (
          <Lede key={line}>{line}</Lede>
        ))}
      </View>
      <View style={styles.block}>
        <Button label={next} onPress={close} />
        {canUndo ? (
          <Button
            variant="ghost"
            label="Undo Not today"
            accessibilityHint="Puts the check-in back so you can answer again"
            onPress={takeBack}
          />
        ) : null}
        {copy.support ? (
          <LinkButton
            label={`Need support? ${SUPPORT_LINE.name}, ${SUPPORT_LINE.display}`}
            accessibilityHint="Calls the helpline"
            onPress={callSupportLine}
          />
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  block: { gap: space.md },
});
