// Win Zero Plus: taking in a move from Win Zero (SPEC 9). +native-intent left the move's link in
// the inbox. This reads the move as untrusted data and shows what would arrive, with a choice
// for any goal both apps have, before anything changes. Then it saves the move and tells Win
// Zero, which opens for a moment to stop its own reminders. Win Zero has this route too, and
// leaves it for Home.
import { Redirect, router } from 'expo-router';
import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { formatDayShort, joinAnd, plural } from '@/lib/format';
import { requestSync } from '@/notifications';
import { requestReminderPermission } from '@/notifications/permissions';
import { appStore, useApp } from '@/store';
import { readMove, type ReceivedMove } from '@/transfer/envelope';
import { clearImport, importDelivery, subscribe, type PendingImport } from '@/transfer/inbox';
import { applyImport, planImport, type GoalCopy, type GoalPreview, type ImportPlan, type IncomingGoal } from '@/transfer/merge';
import { transport } from '@/transfer/transport';
import { space, type } from '@/theme/tokens';
import { Card, Chip, Eyebrow, Fine, Lede } from '@/ui/bits';
import { TopBar } from '@/ui/Brand';
import { Button, LinkButton } from '@/ui/Button';
import { creditCount } from '@/ui/copy/credits';
import { Screen } from '@/ui/Screen';
import { openPage } from '@/ui/support';
import { FEATURES, PLUS_STORE_URL } from '@/variant';

/** Plus's own store page, for an update. */
const STORE_URL = PLUS_STORE_URL;

export default function Import() {
  if (!FEATURES.importIn) return <Redirect href="/" />;
  return <ImportScreen />;
}

function ImportScreen() {
  const hydrated = useApp((s) => s.hydrated);
  const delivery = useSyncExternalStore(subscribe, importDelivery);
  if (!hydrated) return null;
  if (!delivery) {
    return (
      <Message title="Nothing to move yet.">
        To bring your progress over, open Win Zero and go to Settings, then About, then Move to Win Zero Plus.
      </Message>
    );
  }
  // A new arrival starts over, even the same link again.
  return <Arrival key={delivery.seq} delivery={delivery} />;
}

type Arrived =
  | { kind: 'missing' }
  | { kind: 'refused'; reason: 'not-a-move' | 'update-needed' | 'unreadable' | 'too-large' }
  | { kind: 'read'; move: ReceivedMove; plan: ImportPlan };

function readDelivery(delivery: PendingImport): Arrived {
  const s = appStore.getState();
  const text = transport.receive(delivery);
  if (text === null) return { kind: 'missing' };
  const read = readMove(text, { id: delivery.t, now: s.now(), tz: s.timeZone() });
  if (!read.ok) return { kind: 'refused', reason: read.reason };
  const plan = planImport(s, read.incoming, { transferId: delivery.t, limits: s.limits, now: s.now(), tz: s.timeZone() });
  return { kind: 'read', move: read, plan };
}

/** Leave for Home, done with this delivery. */
function goHome() {
  router.replace('/');
  clearImport();
}

function Arrival({ delivery }: { delivery: PendingImport }) {
  // Read once: what's shown stays put while the user decides.
  const [arrived] = useState(() => readDelivery(delivery));

  if (arrived.kind === 'missing' || (arrived.kind === 'refused' && arrived.reason !== 'update-needed')) {
    return (
      <Message title="This move couldn't be read.">
        Nothing has changed here or in Win Zero. Open Win Zero and try the move again.
      </Message>
    );
  }
  if (arrived.kind === 'refused') {
    return (
      <Message
        title="Update Win Zero Plus first."
        action={STORE_URL ? { label: 'Update Win Zero Plus', onPress: () => openPage(STORE_URL) } : undefined}
      >
        This move comes from a newer Win Zero. Update Win Zero Plus, then start the move again from Win Zero. Nothing has
        changed.
      </Message>
    );
  }
  const { plan, move } = arrived;
  if (plan.kind === 'already') return <AlreadyHere t={delivery.t} />;
  if (plan.kind === 'full') {
    return (
      <Message
        title="Make room first."
        action={{
          label: 'Manage goals',
          onPress: () => {
            goHome();
            router.push('/settings');
          },
        }}
      >
        Win Zero Plus has room for {plan.maxGoals} goals, and all {plan.maxGoals} are in use. Archive one in Settings, then
        start the move again from Win Zero.
      </Message>
    );
  }
  return <Preview t={delivery.t} move={move} plan={plan} />;
}

/** Win Zero tried again without hearing back: tell it again, so it can stop its reminders. */
function AlreadyHere({ t }: { t: string }) {
  useEffect(() => {
    transport.discard(t);
    void transport.acknowledge(t);
  }, [t]);
  return (
    <Message title="Your progress is already here.">
      Win Zero Plus has this move from Win Zero, and nothing was added twice.
    </Message>
  );
}

function summary(p: GoalPreview): string {
  const parts = [`Streak ${p.streak}`, `best run ${p.bestStreak}`, plural(p.yesDays, 'Yes day')];
  if (p.lastAnswered) parts.push(`last check-in ${formatDayShort(p.lastAnswered)}`);
  return parts.join(' · ');
}

function Preview(props: { t: string; move: ReceivedMove; plan: Extract<ImportPlan, { kind: 'preview' }> }) {
  const { t, move, plan } = props;
  const [choices, setChoices] = useState<Record<string, GoalCopy>>(() =>
    Object.fromEntries(plan.goals.filter((g) => g.existing).map((g) => [g.incoming.goalId, g.suggested])),
  );
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const credits = [
    ...(plan.credits.game > 0 ? [creditCount('game', plan.credits.game)] : []),
    ...(plan.credits.weapon > 0 ? [creditCount('weapon', plan.credits.weapon)] : []),
  ];

  const bring = async () => {
    setBusy(true);
    await requestReminderPermission();
    const s = appStore.getState();
    const result = s.importMove((current, now) =>
      applyImport(current, move.incoming, choices, { transferId: t, createdAt: move.createdAt, now, limits: s.limits }),
    );
    if (!result.ok) {
      setBusy(false);
      setFailed(true);
      return;
    }
    void requestSync({ force: true });
    goHome();
    transport.discard(t);
    void transport.acknowledge(t);
  };

  return (
    <Screen>
      <TopBar />
      <View style={styles.block}>
        <Eyebrow>From Win Zero</Eyebrow>
        <Text style={type.h2} accessibilityRole="header">
          Bring your progress over
        </Text>
        <Lede>Here&apos;s what&apos;s arriving. Nothing changes until you say so.</Lede>
      </View>

      {plan.goals.map((g) => (
        <GoalCard
          key={g.incoming.goalId}
          goal={g}
          choice={choices[g.incoming.goalId]}
          onChoose={(c) => setChoices({ ...choices, [g.incoming.goalId]: c })}
        />
      ))}

      <View style={styles.block}>
        {credits.length > 0 ? <Text style={type.body}>Credits: {joinAnd(credits)}.</Text> : null}
        {plan.takesSettings ? <Text style={type.body}>Your sound, haptics and reminder settings come too.</Text> : null}
        <Fine>Win Zero Plus will remind you to check in, so your phone may ask whether that&apos;s OK.</Fine>
        <Fine>Next, Win Zero opens for a moment to stop its own reminders.</Fine>
      </View>

      {failed ? (
        <Card>
          <Text style={type.body} accessibilityLiveRegion="polite">
            That didn&apos;t work. Nothing has changed. Please try again from Win Zero.
          </Text>
        </Card>
      ) : null}

      <Button label="Bring it over" disabled={busy || failed} onPress={bring} />
      <LinkButton label="Not now" accessibilityHint="Leaves everything as it is" onPress={goHome} />
    </Screen>
  );
}

function GoalCard(props: { goal: IncomingGoal; choice: GoalCopy | undefined; onChoose: (c: GoalCopy) => void }) {
  const { goal, choice, onChoose } = props;
  return (
    <Card>
      <Text style={type.question}>{goal.incoming.text}</Text>
      <Fine>{summary(goal.incoming)}</Fine>
      {goal.existing ? (
        goal.canTakeIncoming ? (
          <View style={styles.block}>
            <Text style={type.body}>Win Zero Plus already has this goal. Which one should it keep?</Text>
            <Chip label={`From Win Zero: ${summary(goal.incoming)}`} selected={choice === 'incoming'} onPress={() => onChoose('incoming')} />
            <Chip label={`Already here: ${summary(goal.existing)}`} selected={choice === 'existing'} onPress={() => onChoose('existing')} />
          </View>
        ) : (
          <Fine>Win Zero Plus already has this goal, archived, and its goals are full, so it keeps its own.</Fine>
        )
      ) : null}
    </Card>
  );
}

function Message(props: { title: string; children: ReactNode; action?: { label: string; onPress: () => void } }) {
  const { title, children, action } = props;
  return (
    <Screen>
      <TopBar />
      <View style={styles.block}>
        <Text style={type.h2} accessibilityRole="header">
          {title}
        </Text>
        <Lede>{children}</Lede>
      </View>
      {action ? <Button label={action.label} onPress={action.onPress} /> : null}
      {action ? (
        <LinkButton label="Not now" onPress={goHome} />
      ) : (
        <Button label="Go to Home" onPress={goHome} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  block: { gap: space.md },
});
