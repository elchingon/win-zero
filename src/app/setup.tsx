// Onboarding: the goal, the two times, then a short word about reminders before the OS asks.
import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { DEFAULT_CHECK_IN_TIME, DEFAULT_MORNING_TIME, isMorningBeforeCheckIn } from '@/engine';
import { formatClockTime } from '@/lib/format';
import { requestReminderPermission } from '@/notifications/permissions';
import { useApp } from '@/store';
import { colors, fonts, space, type } from '@/theme/tokens';
import { Chip, Em, Eyebrow, Field, Fine, Lede, TextField } from '@/ui/bits';
import { TopBar } from '@/ui/Brand';
import { Button, LinkButton } from '@/ui/Button';
import { feedback } from '@/ui/feedback';
import { Screen } from '@/ui/Screen';
import { TimeField } from '@/ui/TimeField';
import { useDeviceCalendar } from '@/ui/useDevice';

const GOAL_MAX_LENGTH = 60;
const SUGGESTIONS = ['Stop drinking', 'Exercise more', 'Quit vaping', 'No phone after 10pm', 'Read 20 minutes'];

const RULES: { mark: string; tone?: 'flare'; text: string }[] = [
  { mark: '?', text: 'Each evening at your check-in time, Win Zero asks one question: did you do it today?' },
  { mark: '000', text: 'Yes adds a zero. Shoot every one of them. The last zero goes out with a huge explosion.' },
  {
    mark: '−1',
    tone: 'flare',
    text: 'Not today costs one zero. Seven in a row starts a fresh run, unless a shield saves it. You earn a shield every 7 days.',
  },
  { mark: '7D', text: "Missed a check-in? Nothing's lost for a week. After that, each missed day counts like a Not today." },
  { mark: '+', text: 'Longer streaks unlock new weapons, and every 5 days earns a bomb.' },
];

export default function Setup() {
  const hasGoal = useApp((s) => s.goal !== null);
  const setupGoal = useApp((s) => s.setupGoal);
  const { h24 } = useDeviceCalendar();
  const [step, setStep] = useState<'goal' | 'reminders'>('goal');
  const [goal, setGoal] = useState('');
  const [checkInTime, setCheckInTime] = useState(DEFAULT_CHECK_IN_TIME);
  const [morningTime, setMorningTime] = useState(DEFAULT_MORNING_TIME);
  const [busy, setBusy] = useState(false);

  if (hasGoal && !busy) return <Redirect href="/" />;

  const orderOk = isMorningBeforeCheckIn(morningTime, checkInTime);
  const goalOk = goal.trim().length > 0;

  const finish = async (askPermission: boolean) => {
    setBusy(true);
    if (askPermission) await requestReminderPermission();
    const r = setupGoal({ goal, checkInTime, morningTime });
    if (r.ok) {
      feedback.success();
      router.replace('/');
    } else {
      setBusy(false);
      setStep('goal');
    }
  };

  if (step === 'reminders') {
    return (
      <Screen>
        <TopBar right={<LinkButton label="Back" onPress={() => setStep('goal')} />} />
        <View style={styles.block}>
          <Eyebrow>Reminders</Eyebrow>
          <Text style={type.h2}>
            One question at <Em>{formatClockTime(checkInTime, h24)}</Em>.
          </Text>
        </View>
        <Lede>
          Win Zero asks at your check-in time, and once more at {formatClockTime(morningTime, h24)} the next morning
          if you haven&apos;t answered yet. You can answer Yes or Not today right from the notification.
        </Lede>
        <Lede>If you&apos;re away for a while, reminders ease off to one gentle nudge a week.</Lede>
        <Fine>Reminders are scheduled on this phone. Nothing about your goal leaves it.</Fine>
        <View style={styles.block}>
          <Button label="Turn on reminders" onPress={() => finish(true)} disabled={busy} silent />
          <LinkButton label="Not now" onPress={() => finish(false)} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <TopBar />
      <Text style={type.h1} accessibilityRole="header">
        Every day you win, there&apos;s <Em>one more zero</Em> to shoot.
      </Text>
      <View style={styles.rules}>
        {RULES.map((r) => (
          <View key={r.mark} style={styles.rule}>
            <Text style={[styles.ruleMark, r.tone === 'flare' && { color: colors.flare }]}>{r.mark}</Text>
            <Text style={[type.body, styles.ruleText]}>{r.text}</Text>
          </View>
        ))}
      </View>

      <View style={styles.form}>
        <Field label="Your daily goal">
          <TextField
            value={goal}
            onChangeText={setGoal}
            placeholder="Something you'll do, or stop doing"
            maxLength={GOAL_MAX_LENGTH}
            returnKeyType="done"
            autoCapitalize="sentences"
            accessibilityLabel="Your daily goal"
          />
          <View style={styles.chips}>
            {SUGGESTIONS.map((s) => (
              <Chip key={s} label={s} selected={goal.trim() === s} onPress={() => setGoal(s)} />
            ))}
          </View>
        </Field>
        <TimeField
          label="Check-in time"
          value={checkInTime}
          onChange={setCheckInTime}
          h24={h24}
          hint="An evening time works best, once your day is done."
        />
        <TimeField
          label="Morning reminder"
          value={morningTime}
          onChange={setMorningTime}
          h24={h24}
          hint="Only if you haven't answered by then."
          error={orderOk ? null : 'Pick a morning time before your check-in time.'}
        />
        <Button
          label="Start my streak"
          onPress={() => setStep('reminders')}
          disabled={!goalOk || !orderOk}
          accessibilityHint={goalOk ? undefined : 'Enter a goal first'}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  block: { gap: space.md },
  rules: { gap: space.md },
  rule: { flexDirection: 'row', gap: space.md, alignItems: 'baseline' },
  ruleMark: { width: 52, fontFamily: fonts.display, fontSize: 15, letterSpacing: 0.3, color: colors.amber },
  ruleText: { flex: 1 },
  form: { gap: 18 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
