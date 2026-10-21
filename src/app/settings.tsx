// Settings: goal wording, times (through the engine, so an open window is respected),
// sound / haptics / weekly nudge, reminder permission, how it works, support, accessibility
// switches that change the app for whoever turns them on, about (privacy policy, help, email, the
// move to Win Zero Plus once it's on the store, version), and erase.
// Win Zero Plus adds check-in days and more goals, each with its own screen once there are
// several, and its games, themes and app icons (SPEC 9).
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useState, type ComponentType } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { ReminderPermission } from '@/notifications/permissions';
import { appStore, isMovedOut, primaryGoal, useApp } from '@/store';
import { colors, space, type } from '@/theme/tokens';
import { Card, Eyebrow, Fine, Row, shared, ToggleRow } from '@/ui/bits';
import { TopBar } from '@/ui/Brand';
import { Button, LinkButton } from '@/ui/Button';
import { feedback } from '@/ui/feedback';
import { Screen } from '@/ui/Screen';
import { GoalFields } from '@/ui/settings/GoalFields';
import { APP_LINKS, callSupportLine, emailSupport, openPage, SUPPORT_LINE } from '@/ui/support';
import { useReminderPermission } from '@/ui/useReminderPermission';
import { APP_NAME, FEATURES, PLUS_STORE_URL } from '@/variant';

// Development builds only: Metro folds __DEV__ to false in production and drops the require.
const DebugSection: ComponentType | null = __DEV__
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('@/dev/DebugSection').DebugSection
  : null;

// Win Zero Plus only: the literal comparison folds per file, so Win Zero's bundle leaves it out.
const PlusSettings: typeof import('@/plus/settings') | null =
  process.env.EXPO_PUBLIC_APP_VARIANT === 'plus'
    ? // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('@/plus/settings')
    : null;

/** The app version from the app's config, as built. */
const APP_VERSION = Constants.expoConfig?.version;
const APP_LABEL = APP_VERSION ? `${APP_NAME} ${APP_VERSION}` : APP_NAME;
/** From the environment; a build without them leaves their rows out (see APP_LINKS). */
const PRIVACY_URL = APP_LINKS.privacy;
const SUPPORT_URL = APP_LINKS.support;
/** Win Zero offers the move once Win Zero Plus is on the store for this platform (SPEC 9). */
const MOVE_OFFERED = FEATURES.moveOut && PLUS_STORE_URL !== null;

const PERMISSION_WORDS: Record<ReminderPermission, string> = {
  granted: 'On',
  denied: 'Off in system settings',
  undetermined: 'Not turned on yet',
};

export default function Settings() {
  const goal = useApp(primaryGoal);
  const prefs = useApp((s) => s.prefs);
  const moved = useApp(isMovedOut);
  // Win Zero Plus with several goals lists them, each with its own screen (SPEC 9). Below,
  // PlusSettings comes first in each condition, so Win Zero's build folds the branch away.
  const several = useApp((s) => s.goals.length > 1);
  const pastGoals = useApp((s) => s.archived.length > 0);
  const { permission, turnOn } = useReminderPermission();
  const [eraseArmed, setEraseArmed] = useState(false);

  // Erasing empties the goal on the way out; render nothing while the screen leaves.
  if (!goal) return null;

  const store = appStore.getState();

  const erase = () => {
    feedback.press();
    store.erase();
    router.dismissTo('/');
  };

  return (
    <Screen>
      <TopBar right={<LinkButton label="Done" onPress={() => router.back()} />} />
      <Text style={type.h2} accessibilityRole="header">
        Settings
      </Text>

      {PlusSettings && several ? (
        <PlusSettings.GoalsList />
      ) : (
        <>
          <GoalFields key={goal.goalId} goal={goal} />
          {PlusSettings ? <PlusSettings.DaysField key={`${goal.goalId}-days`} goal={goal} /> : null}
          {PlusSettings ? <PlusSettings.GoalsGroup /> : null}
        </>
      )}

      <View style={shared.list}>
        <ToggleRow label="Sound" detail="A chime for each Yes, and pops and booms in the round." value={prefs.sound} onChange={(v) => store.setPref('sound', v)} />
        <ToggleRow label="Haptics" detail="Taps and buzzes." value={prefs.haptics} onChange={(v) => store.setPref('haptics', v)} />
        <ToggleRow
          label="Weekly nudge"
          detail="If check-ins stop for a while, one gentle reminder a week."
          value={prefs.reengage}
          onChange={(v) => store.setPref('reengage', v)}
        />
        <ToggleRow
          label="Goal in reminders"
          detail={
            PlusSettings && several
              ? PlusSettings.SETTINGS_COPY.goalInReminders
              : 'Off keeps your goal private on the lock screen. Reminders just say “your goal”.'
          }
          value={prefs.goalInReminders}
          onChange={(v) => store.setPref('goalInReminders', v)}
        />
        <Row
          label="Reminders"
          detail={permission ? PERMISSION_WORDS[permission] : ' '}
          right={
            permission === 'denied' ? (
              <Button small variant="ghost" label="Open settings" onPress={turnOn} />
            ) : permission === 'undetermined' ? (
              <Button small variant="ghost" label="Turn on" onPress={turnOn} />
            ) : null
          }
        />
        <Row
          label="How it works"
          detail="The slide, shields, missed days and rewards."
          right={<Text style={styles.call}>Read</Text>}
          hint="Opens the rules in plain words"
          onPress={() => router.push('/how-it-works')}
        />
        <Row
          label="Need support?"
          detail={`${SUPPORT_LINE.name}: ${SUPPORT_LINE.display}. ${SUPPORT_LINE.detail}`}
          right={<Text style={styles.call}>Call</Text>}
          hint="Calls the helpline"
          onPress={callSupportLine}
        />
      </View>

      <View style={shared.section}>
        <Eyebrow header>Accessibility</Eyebrow>
        <View style={shared.list}>
          <ToggleRow
            label="Reduce effects"
            detail="Less shake, softer flashes and fewer particles, and a still background. Always on while your phone's Reduce Motion is on."
            value={prefs.reduceEffects}
            onChange={(v) => store.setPref('reduceEffects', v)}
          />
          <ToggleRow
            label="Auto-fire"
            detail="Once you touch the screen in a round, firing keeps going on its own. Tap or drag to aim."
            value={prefs.autoFire}
            onChange={(v) => store.setPref('autoFire', v)}
          />
        </View>
      </View>

      {PlusSettings ? <PlusSettings.PlusSections /> : null}

      <View style={shared.section}>
        <Eyebrow header>About</Eyebrow>
        <View style={shared.list}>
          {PRIVACY_URL ? (
            <Row
              label="Privacy policy"
              detail="Your goal and history stay on this phone."
              right={<Text style={styles.call}>Open</Text>}
              hint="Opens the privacy policy in your browser"
              onPress={() => openPage(PRIVACY_URL)}
            />
          ) : null}
          {SUPPORT_URL ? (
            <Row
              label="Help and support"
              detail={`How ${APP_NAME} works, and fixes for common questions.`}
              right={<Text style={styles.call}>Open</Text>}
              hint="Opens the support page in your browser"
              onPress={() => openPage(SUPPORT_URL)}
            />
          ) : null}
          <Row
            label="Email us"
            detail={APP_LINKS.email}
            right={<Text style={styles.call}>Email</Text>}
            hint={`Starts an email to ${APP_NAME} support`}
            onPress={() => emailSupport(APP_LABEL)}
          />
          {MOVE_OFFERED && !moved ? (
            <Row
              label="Move to Win Zero Plus"
              detail="Bring your goal, history and rewards to the Plus app on this phone."
              right={<Text style={styles.call}>Read</Text>}
              hint="Explains what moves, before anything happens"
              onPress={() => router.push('/move')}
            />
          ) : null}
        </View>
        <Fine>{APP_LABEL} · © 2026 E7 Systems</Fine>
      </View>

      {eraseArmed ? (
        <Card style={styles.erase}>
          <Text style={styles.eraseTitle}>Erase everything?</Text>
          <Fine>
            {PlusSettings && (several || pastGoals)
              ? PlusSettings.SETTINGS_COPY.erase
              : "This deletes your goal, streak, history and rewards from this phone. It can't be undone."}
          </Fine>
          <View style={styles.eraseRow}>
            <Button variant="danger" label="Erase everything" onPress={erase} silent style={styles.flex} />
            <Button variant="ghost" label="Keep my data" onPress={() => setEraseArmed(false)} style={styles.flex} />
          </View>
        </Card>
      ) : (
        <LinkButton label="Erase all data" color={colors.flare} onPress={() => setEraseArmed(true)} />
      )}

      {DebugSection ? <DebugSection /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  call: { ...type.eyebrow, color: colors.amber },
  erase: { borderColor: colors.flare, gap: space.md },
  eraseTitle: { ...type.question },
  eraseRow: { flexDirection: 'row', gap: space.md },
  flex: { flex: 1 },
});
