// Onboarding: the goal, the two times, then a short word about reminders before the OS asks.
import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { DEFAULT_CHECK_IN_TIME, DEFAULT_MORNING_TIME, EVERY_DAY, firstCheckInOpenAt, type Weekday } from '@/engine';
import { formatClockTime } from '@/lib/format';
import { requestReminderPermission } from '@/notifications/permissions';
import { appStore, useApp } from '@/store';
import { colors, fonts, space, type } from '@/theme/tokens';
import { Chip, Em, Eyebrow, Field, Fine, Lede, shared, TextField } from '@/ui/bits';
import { TopBar } from '@/ui/Brand';
import { Button, LinkButton } from '@/ui/Button';
import { GOAL_MAX_LENGTH, reminderWhen, rules, SUGGESTIONS } from '@/ui/copy/rules';
import { feedback } from '@/ui/feedback';
import { Screen } from '@/ui/Screen';
import { TimeField } from '@/ui/TimeField';
import { useDeviceCalendar } from '@/ui/useDevice';
import { APP_NAME } from '@/variant';

const RULES = rules(APP_NAME);

// Win Zero Plus only: check-in days (SPEC 9). The literal comparison folds per file, so Win Zero's
// bundle leaves it out, and Win Zero's goal checks in every day.
const PlusGoals: typeof import('@/plus/goals') | null =
  process.env.EXPO_PUBLIC_APP_VARIANT === 'plus'
    ? // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('@/plus/goals')
    : null;

export default function Setup() {
  const hasGoal = useApp((s) => s.goals.length > 0);
  const addGoal = useApp((s) => s.addGoal);
  const { h24 } = useDeviceCalendar();
  const [step, setStep] = useState<'goal' | 'reminders'>('goal');
  const [goal, setGoal] = useState('');
  const [checkInTime, setCheckInTime] = useState(DEFAULT_CHECK_IN_TIME);
  const [morningTime, setMorningTime] = useState(DEFAULT_MORNING_TIME);
  const [days, setDays] = useState<Weekday[]>([...EVERY_DAY]);
  const [busy, setBusy] = useState(false);
  /** Chosen days in Win Zero Plus; Win Zero's goal checks in every day. */
  const chosenDays = PlusGoals ? days : undefined;

  if (hasGoal && !busy) return <Redirect href="/" />;

  const goalOk = goal.trim().length > 0;

  const finish = async (askPermission: boolean) => {
    setBusy(true);
    if (askPermission) await requestReminderPermission();
    const r = addGoal({ goal, checkInTime, morningTime, days: chosenDays });
    if (r.ok) {
      feedback.success();
      router.replace('/');
    } else {
      setBusy(false);
      setStep('goal');
    }
  };

  if (step === 'reminders') {
    const store = appStore.getState();
    // Past check-in time already: the first question is about today, straight away.
    const todayCounts = firstCheckInOpenAt({ checkInTime, days: chosenDays, now: store.now(), tz: store.timeZone() });
    return (
      <Screen>
        <TopBar right={<LinkButton label="Back" onPress={() => setStep('goal')} />} />
        <View style={styles.block}>
          <Eyebrow>Reminders</Eyebrow>
          <Text style={type.h2}>
            One question at <Em>{formatClockTime(checkInTime, h24)}</Em>.
          </Text>
        </View>
        {todayCounts ? (
          <Lede>
            It&apos;s already past {formatClockTime(checkInTime, h24)}, so today counts. Your first check-in opens as
            soon as you start, and you can answer it until midnight tomorrow.
          </Lede>
        ) : null}
        <Lede>
          {APP_NAME} asks at your check-in time. {reminderWhen(checkInTime, formatClockTime(morningTime, h24), morningTime)}{' '}
          There&apos;s no rush: you can answer until midnight the next day, right from the notification or in the app.
        </Lede>
        <Lede>If you&apos;re away for a while, reminders ease off to one gentle nudge a week.</Lede>
        <Fine>
          Reminders are scheduled on this phone. Nothing about your goal leaves it, and reminders don&apos;t show its
          wording unless you turn that on in Settings.
        </Fine>
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
          <View style={shared.chips}>
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
          label="Reminder"
          value={morningTime}
          onChange={setMorningTime}
          h24={h24}
          hint="Only if you haven't answered by then: the next morning, or later the same day if it's after check-in time."
        />
        {PlusGoals ? <PlusGoals.ChooseDays days={days} onChange={setDays} /> : null}
        <Button
          label="Start my streak"
          onPress={() => setStep('reminders')}
          disabled={!goalOk}
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
});
