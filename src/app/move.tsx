// Win Zero: moving to Win Zero Plus (SPEC 9), from Settings › About. What moves and what happens
// after, before anything does; then the move itself. Win Zero Plus has this route too, and leaves
// it for Home.
import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { isMovedOut, useApp } from '@/store';
import { space, type } from '@/theme/tokens';
import { Card, Eyebrow, Fine, Lede } from '@/ui/bits';
import { TopBar } from '@/ui/Brand';
import { Button, LinkButton } from '@/ui/Button';
import { Screen } from '@/ui/Screen';
import { emailSupport } from '@/ui/support';
import { cancelMove, sendMoveOut, type MoveOutResult } from '@/transfer/send';
import { FEATURES, PLUS_STORE_URL } from '@/variant';

const WHAT_MOVES = [
  'Your goal and every day of its history',
  'Your streak, best run, bombs and shields',
  'Your weapons and credits',
  'Your settings',
];

const AFTER: Record<MoveOutResult, string> = {
  opened: "Win Zero Plus is open. It shows what's arriving, and asks before it adds anything.",
  'not-installed':
    "Win Zero Plus isn't on this phone yet. Once it's installed, come back here and tap Move again. Nothing has changed here.",
  failed: "That didn't work this time. Nothing has changed here. Please try again in a moment.",
  'too-large': "There's more history here than a move can carry. Nothing has changed. Email us and we'll help.",
};

export default function Move() {
  const hasGoal = useApp((s) => s.goals.length > 0);
  const moved = useApp(isMovedOut);
  if (!FEATURES.moveOut || PLUS_STORE_URL === null || !hasGoal || moved) return <Redirect href="/" />;
  return <MoveScreen />;
}

function MoveScreen() {
  const waiting = useApp((s) => s.moveOut?.status === 'sent');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<MoveOutResult | null>(null);

  const move = async () => {
    setBusy(true);
    setResult(await sendMoveOut());
    setBusy(false);
  };

  return (
    <Screen>
      <TopBar right={<LinkButton label="Done" onPress={() => router.back()} />} />
      <Text style={type.h2} accessibilityRole="header">
        Move to Win Zero Plus
      </Text>
      <Lede>
        Win Zero Plus is a separate app. If it&apos;s on this phone, you can bring everything you&apos;ve built here with
        you.
      </Lede>

      <View style={styles.list}>
        <Eyebrow header>What moves</Eyebrow>
        {WHAT_MOVES.map((line) => (
          <Text key={line} style={type.body}>
            {line}
          </Text>
        ))}
        <Fine>It happens on this phone. Nothing is sent to us, or to anyone else.</Fine>
      </View>

      <Lede>
        Once Win Zero Plus has it, Win Zero stops its reminders, so you don&apos;t get two. Your progress stays here
        too, and you can come back any time.
      </Lede>

      <Button label="Move to Win Zero Plus" disabled={busy} onPress={move} />

      {result ? (
        <Card>
          <Text style={type.body} accessibilityLiveRegion="polite">
            {AFTER[result]}
          </Text>
          {result === 'too-large' ? <LinkButton label="Email us" onPress={() => emailSupport('Moving to Win Zero Plus')} /> : null}
        </Card>
      ) : null}

      {waiting && result !== 'opened' ? (
        <View style={styles.list}>
          <Fine>Win Zero is waiting to hear back from Win Zero Plus.</Fine>
          <LinkButton label="Cancel move" accessibilityHint="Keeps Win Zero as it is" onPress={() => cancelMove()} />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.sm },
});
