// Win Zero Plus's widgets (SPEC 9): their frames ahead, worded and linked in JavaScript; the Yes link
// read strictly; and a widget's Yes answered as the notification's is.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { describe, expect, it, jest } from '@jest/globals';

import { startBreak, type GoalState } from '@/engine';
import { at, DAY0, DENVER, newGoal, yesDays } from '@/engine/__tests__/fixtures';
import { harness, ready } from '@/store/__tests__/harness';
import { PLUS_LIMITS } from '@/store/limits';
import { DEFAULT_PERSISTED } from '@/store/migrate';
import type { GoalSlot, RoundRecord } from '@/store/types';

import { deliverWidgetYes, startWidgetLinks } from '../widget/inbox';
import { parseWidgetYes, yesLink } from '../widget/link';
import { WIDGET_MAX_FRAMES, widgetSnapshot, type SnapshotInput } from '../widget/snapshot';

const ID_A = '0a1b2c3d-1111-4222-8333-444455556666';
const ID_B = '0a1b2c3d-1111-4222-9333-444455556666';
const goal = (id: string, g: GoalState, patch: Partial<GoalState> = {}): GoalState => ({ ...g, ...patch, goalId: id });
const slot = (g: GoalState, round: RoundRecord | null = null): GoalSlot => ({ goal: g, round, seenThrough: g.lastSettledDay });
const input = (slots: GoalSlot[], patch: Partial<SnapshotInput> = {}): SnapshotInput => ({
  slots,
  now: at('2026-10-15', '12:00'),
  offsetMs: 0,
  tz: DENVER,
  h24: false,
  showGoal: false,
  scheme: 'winzeroplus',
  ...patch,
});
/** Answered Yes on 10-13 and 10-14: 10-15's check-in opens at 20:00. */
const twoDays = (id = ID_A) => goal(id, yesDays(newGoal(), DAY0, 2), { goal: 'Stop drinking' });
const frameAt = (snap: ReturnType<typeof widgetSnapshot>, day: string, time: string) =>
  [...snap.frames].reverse().find((f) => f.at <= at(day, time).getTime());

describe('widgetSnapshot', () => {
  it('waits for the next check-in, then asks for it with a Yes that answers that day', () => {
    const snap = widgetSnapshot(input([slot(twoDays())]));
    expect(snap.v).toBe(1);
    expect(snap.writtenAt).toBe(at('2026-10-15', '12:00').getTime());
    expect(snap.frames[0]?.goals[0]).toMatchObject({
      id: ID_A,
      label: 'Your goal',
      state: 'waiting',
      zeros: 2,
      headline: 'Next check-in',
      detail: 'Today 8:00 PM',
      inline: 'Next check-in Today 8:00 PM',
      url: 'winzeroplus://',
    });
    expect(frameAt(snap, '2026-10-15', '20:30')?.goals[0]).toMatchObject({
      state: 'open',
      headline: 'Check in',
      detail: 'Yes makes 3',
      inline: 'Check in · 2 zeros',
      yes: 'winzeroplus://checkin?goal=0a1b2c3d-1111-4222-8333-444455556666&day=2026-10-15&answer=yes',
    });
    // Midnight: the same check-in, still open.
    expect(frameAt(snap, '2026-10-16', '00:30')?.goals[0]?.yes).toContain('day=2026-10-15');
  });

  it('names a goal as its reminders do: its words only with Goal in reminders on', () => {
    const two = [slot(twoDays()), slot(goal(ID_B, twoDays(), { goal: 'Read' }))];
    expect(widgetSnapshot(input(two)).frames[0]?.goals.map((g) => g.label)).toEqual(['Your first goal', 'Your second goal']);
    const named = [slot(twoDays()), slot(goal(ID_B, twoDays(), { goal: 'Read', alias: 'Pages' }))];
    expect(widgetSnapshot(input(named)).frames[0]?.goals.map((g) => g.label)).toEqual(['Your first goal', 'Pages']);
    expect(widgetSnapshot(input(two, { showGoal: true })).frames[0]?.goals.map((g) => g.label)).toEqual(['Stop drinking', 'Read']);
    expect(JSON.stringify(widgetSnapshot(input(two)))).not.toContain('Stop drinking');
  });

  it('offers a round ready until its goal’s next day settles', () => {
    const g = twoDays();
    const round: RoundRecord = { day: '2026-10-14', n: 2, rewards: { bomb: false, shield: false, shieldCapped: false, weapons: [], credits: [] }, borrowed: [], played: false };
    const snap = widgetSnapshot(input([slot(g, round)]));
    expect(snap.frames[0]?.goals[0]).toMatchObject({ state: 'ready', headline: 'Day 2 round ready', url: 'winzeroplus://play?goal=0a1b2c3d-1111-4222-8333-444455556666' });
    // Its check-in opening comes first; once 10-15 is missed (midnight after 10-16), the round is gone.
    expect(frameAt(snap, '2026-10-15', '20:30')?.goals[0]?.state).toBe('open');
    expect(frameAt(snap, '2026-10-17', '00:30')?.goals[0]?.state).toBe('open');
    expect(snap.frames.some((f) => f.at > at('2026-10-17', '00:00').getTime() && f.goals[0]?.state === 'ready')).toBe(false);
    expect(widgetSnapshot(input([slot(g, { ...round, played: true })])).frames[0]?.goals[0]?.state).toBe('waiting');
  });

  it('says a goal is on a break, and when check-ins come back', () => {
    const r = startBreak(twoDays(), '2026-10-20', at('2026-10-15', '12:00'), DENVER);
    if (!r.ok) throw new Error(r.reason);
    const snap = widgetSnapshot(input([slot(r.state)], { now: at('2026-10-15', '13:00') }));
    expect(snap.frames[0]?.goals[0]).toMatchObject({
      state: 'break',
      headline: 'On a break',
      detail: 'Until Tue, Oct 20',
      inline: 'On a break until Oct 20',
      a11y: 'Your goal is on a break until Tue, Oct 20. Check-ins come back Wed 8:00 PM.',
    });
    expect(frameAt(snap, '2026-10-21', '20:30')?.goals[0]?.state).toBe('open');
  });

  it('puts open check-ins first, the earliest first, then rounds, the rest and breaks', () => {
    const late = goal(ID_B, yesDays(newGoal({ checkInTime: '19:00' }), DAY0, 2));
    const snap = widgetSnapshot(input([slot(twoDays()), slot(late)]));
    expect(frameAt(snap, '2026-10-15', '19:30')?.goals.map((g) => [g.id, g.state])).toEqual([
      [ID_B, 'open'],
      [ID_A, 'waiting'],
    ]);
    expect(frameAt(snap, '2026-10-15', '20:30')?.goals.map((g) => g.id)).toEqual([ID_B, ID_A]);
  });

  it('keeps frames in order, none the same as the one before, at most WIDGET_MAX_FRAMES', () => {
    const snap = widgetSnapshot(input([slot(twoDays()), slot(goal(ID_B, twoDays(), { goal: 'Read' }))]));
    const ats = snap.frames.map((f) => f.at);
    expect([...ats].sort((a, b) => a - b)).toEqual(ats);
    expect(snap.frames.length).toBeLessThanOrEqual(WIDGET_MAX_FRAMES);
    snap.frames.slice(1).forEach((f, i) => expect(f.goals).not.toEqual(snap.frames[i]?.goals));
  });

  it('times frames on the real clock while the debug clock runs ahead', () => {
    const offsetMs = 3 * 3_600_000;
    const plain = widgetSnapshot(input([slot(twoDays())]));
    const ahead = widgetSnapshot(input([slot(twoDays())], { offsetMs }));
    expect(ahead.writtenAt).toBe(plain.writtenAt - offsetMs);
    expect(ahead.frames.map((f) => f.at)).toEqual(plain.frames.map((f) => f.at - offsetMs));
  });

  it('has only its empty words with no goal', () => {
    expect(widgetSnapshot(input([]))).toMatchObject({
      frames: [],
      empty: { headline: 'Set up a goal', detail: 'Open Win Zero Plus to start.', url: 'winzeroplus://' },
    });
  });
});

describe('parseWidgetYes', () => {
  it('reads a Yes it made', () => {
    expect(parseWidgetYes(yesLink('winzeroplus', ID_A, '2026-10-15'))).toEqual({ goalId: ID_A, day: '2026-10-15' });
    expect(parseWidgetYes(`/checkin?goal=${ID_A}&day=2026-10-15&answer=yes`)).toEqual({ goalId: ID_A, day: '2026-10-15' });
  });

  it.each([
    ['another route', `winzeroplus://import?goal=${ID_A}&day=2026-10-15&answer=yes`],
    ['Not today', `winzeroplus://checkin?goal=${ID_A}&day=2026-10-15&answer=no`],
    ['a made-up goal', 'winzeroplus://checkin?goal=g1&day=2026-10-15&answer=yes'],
    ['a day that is not one', `winzeroplus://checkin?goal=${ID_A}&day=2026-02-30&answer=yes`],
    ['an extra value', `winzeroplus://checkin?goal=${ID_A}&day=2026-10-15&answer=yes&n=9`],
    ['a value twice', `winzeroplus://checkin?goal=${ID_A}&goal=${ID_B}&day=2026-10-15&answer=yes`],
    ['nothing', 'winzeroplus://checkin'],
    ['a bad escape', `winzeroplus://checkin?goal=%E0%A4&day=2026-10-15&answer=yes`],
  ])('turns down %s', (_why, url) => {
    expect(parseWidgetYes(url)).toBeNull();
  });
});

describe('startWidgetLinks', () => {
  async function store() {
    const h = harness({ limits: PLUS_LIMITS });
    await AsyncStorage.clear();
    await ready(h.store);
    h.store.setState({ ...DEFAULT_PERSISTED, goals: [slot(twoDays())] });
    return h;
  }

  it('answers Yes as the notification does, once, and brings Home forward', async () => {
    const { store: s, setTime } = await store();
    setTime('2026-10-15', '20:30');
    const toHome = jest.fn();
    const stop = startWidgetLinks(s, { toHome });
    deliverWidgetYes({ goalId: ID_A, day: '2026-10-15' });
    expect(s.getState().goals[0]?.goal.streak).toBe(3);
    expect(s.getState().goals[0]?.round).toMatchObject({ day: '2026-10-15', played: false });
    // Like the notification's Yes: the round waits on Home rather than opening.
    expect(s.getState().route).toBeNull();
    expect(toHome).toHaveBeenCalledTimes(1);
    stop();
  });

  it('drops the banner for a day already answered, and keeps one for a day gone by', async () => {
    const { store: s, setTime } = await store();
    setTime('2026-10-15', '12:00');
    const stop = startWidgetLinks(s, { toHome: () => {} });
    deliverWidgetYes({ goalId: ID_A, day: '2026-10-14' });
    expect(s.getState().rejection).toBeNull();
    deliverWidgetYes({ goalId: ID_A, day: '2026-10-01' });
    expect(s.getState().rejection).toMatchObject({ reason: 'expired' });
    stop();
  });

  it('only opens Home for a goal that isn’t here any more', async () => {
    const { store: s, setTime } = await store();
    setTime('2026-10-15', '20:30');
    const toHome = jest.fn();
    const stop = startWidgetLinks(s, { toHome });
    deliverWidgetYes({ goalId: ID_B, day: '2026-10-15' });
    expect(s.getState().goals[0]?.goal.streak).toBe(2);
    expect(toHome).toHaveBeenCalledTimes(1);
    stop();
  });
});
