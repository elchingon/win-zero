// Reset / Shielded / Slipping: what a Not today, or a run of missed days, did to the streak.
// Shown once. The copy is supportive and plain: some people here are working on sobriety.
import { Redirect, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';

import { pendingWindow, type GoalState } from '@/engine';
import { plural } from '@/lib/format';
import { appStore, type Notice } from '@/store';
import { colors, space, type } from '@/theme/tokens';
import { Em, Eyebrow, Lede } from '@/ui/bits';
import { Button, LinkButton } from '@/ui/Button';
import { NoticeZero, noticeColors, type NoticeMotion } from '@/ui/NoticeZero';
import { Screen } from '@/ui/Screen';
import { SUPPORT_LINE } from '@/ui/support';

interface Copy {
  eyebrow: string;
  title: [before: string, em: string];
  body: string[];
  motion: NoticeMotion;
  support?: boolean;
}

const KEEPSAKES = 'your weapons, bombs and shields are still yours';

function copyFor(n: Notice): Copy {
  switch (n.kind) {
    case 'slipping': {
      const lostLine = n.lost === 1 ? 'a zero.' : `${n.lost} zeros.`;
      if (n.cause === 'answer') {
        return {
          eyebrow: 'Not today',
          title: ["You've lost ", lostLine],
          body: [
            'Thanks for being honest.',
            n.streak > 0
              ? `Your streak is at ${plural(n.streak, 'zero')}. A Yes at your next check-in stops the slide.`
              : 'A Yes at your next check-in starts a new run.',
          ],
          motion: 'shed',
        };
      }
      return {
        eyebrow: 'While you were away',
        title: ["You've lost ", lostLine],
        body: [
          `Check in to stop the slide. Your streak is at ${plural(n.streak, 'zero')}.`,
          'Missed days are free for a week; after that, each one takes a zero.',
        ],
        motion: 'shed',
      };
    }
    case 'shielded':
      return {
        eyebrow: n.cause === 'answer' ? 'Shield used' : 'While you were away',
        title: ['Your shield ', 'held.'],
        body: [
          n.cause === 'answer'
            ? `That Not today would have started a fresh run, so a shield stepped in. Your streak stays at ${plural(n.streak, 'zero')}.`
            : n.lost > 0
              ? `You lost ${plural(n.lost, 'zero')} while you were away, and then a shield stopped the slide. Your streak is at ${plural(n.streak, 'zero')}.`
              : `A shield kept your streak at ${plural(n.streak, 'zero')}.`,
          `The count starts over. Shields left: ${n.shieldsLeft}.`,
        ],
        motion: 'absorb',
      };
    case 'reset':
      return n.cause === 'answer'
        ? {
            eyebrow: 'A fresh start',
            title: ['Back to ', 'one zero.'],
            body: [
              "Thanks for being honest. Hard stretches happen, and you're still here checking in.",
              `Your next Yes starts a new run. Your best run stays on the board at ${plural(n.bestStreak, 'day')}, and ${KEEPSAKES}.`,
            ],
            motion: 'settle',
            support: true,
          }
        : {
            eyebrow: 'Welcome back',
            title: ['A fresh ', 'start.'],
            body: [
              "It's been a while since your last check-in, so your streak has started over.",
              `Your best run stays at ${plural(n.bestStreak, 'day')}, and ${KEEPSAKES}. Check in whenever you're ready.`,
            ],
            motion: 'settle',
            support: true,
          };
    case 'noted':
      return {
        eyebrow: 'Not today',
        title: ['Thanks for ', 'checking in.'],
        body: ['Honest answers keep the streak real. A Yes at your next check-in puts your first zero on the board.'],
        motion: 'none',
      };
  }
}

export default function NoticeScreen() {
  // Snapshot it: the store's copy is cleared once shown, so it appears only once.
  const [notice] = useState(() => appStore.getState().notice);
  const [goal] = useState<GoalState | null>(() => appStore.getState().goal);

  useEffect(() => {
    appStore.getState().clearNotice();
  }, []);

  if (!notice || !goal) return <Redirect href="/" />;

  const copy = copyFor(notice);
  const color = noticeColors[notice.kind];
  const canAnswer = pendingWindow(goal, appStore.getState().now()) !== null;
  const close = () => router.dismissTo('/');

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
        <Button label={canAnswer && notice.kind !== 'noted' ? 'Check in now' : 'Got it'} onPress={close} />
        {copy.support ? (
          <LinkButton
            label={`Need support? ${SUPPORT_LINE.name}, ${SUPPORT_LINE.display}`}
            accessibilityHint="Calls the helpline"
            onPress={() => Linking.openURL(SUPPORT_LINE.tel)}
          />
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  block: { gap: space.md },
});
