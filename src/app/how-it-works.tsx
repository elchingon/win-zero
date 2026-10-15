// How it works: the rules in plain words, reached from Settings. Setup shows them once; this is
// where to look again, and where the words the notices use ("the slide", "a fresh run",
// "banked") are explained. Numbers come from the engine, so the copy can't drift from the rules.
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { BOMB_EVERY, MISSED_GRACE_DAYS, SHIELD_CAP, SHIELD_EVERY, SLIDE_FINAL } from '@/engine';
import { UNDO_MS } from '@/store';
import { space, type } from '@/theme/tokens';
import { Em, Lede, shared } from '@/ui/bits';
import { TopBar } from '@/ui/Brand';
import { LinkButton } from '@/ui/Button';
import { Screen } from '@/ui/Screen';

const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: 'The daily question',
    body: [
      'Each day at your check-in time, Win Zero asks one question: did you stick to your goal today? Answer Yes or Not today, from the notification or from Home.',
      "There's no rush. You can answer until midnight the next day, and if you haven't by your reminder time, one more reminder comes.",
    ],
  },
  {
    title: 'Yes adds a zero',
    body: [
      'Each Yes adds a zero to your streak and opens a round with that many zeros to shoot. The last one goes out with a big explosion.',
      "Rewards are banked the moment you say Yes: they're yours whether you play the round now, later, or not at all. An unplayed round waits on Home until the next day's check-in is answered or closes.",
    ],
  },
  {
    title: 'Not today, and the slide',
    body: [
      "Not today costs one zero. That's the slide: each slip since your last Yes takes one zero, and your next Yes stops it.",
      `If slips reach ${SLIDE_FINAL} before your next Yes, that one is the final. A shield takes it if you have one, and your streak stays. If not, your streak starts over: a fresh run. Your best run, weapons and bombs stay yours.`,
      `Tapped Not today by mistake? You can undo it for ${UNDO_MS / 1000} seconds on the screen that follows, a little longer with a screen reader on.`,
    ],
  },
  {
    title: 'Missed check-ins',
    body: [
      `Life gets busy. Missed check-ins cost nothing for the first ${MISSED_GRACE_DAYS} days in a row. After that, each missed day counts as a slip.`,
      "If a long break starts a fresh run, daily reminders pause. With Weekly nudge on in Settings, you'll get one gentle reminder a week. Answering any check-in brings daily reminders back.",
    ],
  },
  {
    title: 'Shields, bombs and weapons',
    body: [
      `Every ${SHIELD_EVERY} days of streak earns a shield, up to ${SHIELD_CAP} at a time. Shields only step in on the final slip, never on an ordinary one.`,
      `Every ${BOMB_EVERY} days earns a bomb to use in a round. New weapons unlock as your best run grows. Bombs and weapons are never lost.`,
      "Shields and bombs come from new highs in a run, so slipping and climbing back doesn't earn the same ones twice.",
    ],
  },
];

export default function HowItWorks() {
  return (
    <Screen>
      <TopBar right={<LinkButton label="Done" onPress={() => router.back()} />} />
      <Text style={type.h2} accessibilityRole="header">
        How it <Em>works</Em>
      </Text>
      {SECTIONS.map((s) => (
        <View key={s.title} style={shared.section}>
          <Text style={type.question} accessibilityRole="header">
            {s.title}
          </Text>
          <View style={styles.body}>
            {s.body.map((line) => (
              <Lede key={line}>{line}</Lede>
            ))}
          </View>
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: space.sm },
});
