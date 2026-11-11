// Keeping Win Zero Plus's widgets current (SPEC 9): a snapshot once storage is read, after a change,
// once for changes close together, again on a return to the foreground, and not written again when
// it comes out the same. Erase leaves no goal on a widget.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { afterEach, describe, expect, it, jest } from '@jest/globals';

import { DAY0, newGoal, yesDays } from '@/engine/__tests__/fixtures';
import { fakeAppState, harness, ready } from '@/store/__tests__/harness';
import { PLUS_LIMITS } from '@/store/limits';
import { DEFAULT_PERSISTED } from '@/store/migrate';

import type { WidgetSnapshot } from '../widget/snapshot';
import { startWidgetSync, WIDGET_SETTLE_MS } from '../widget/sync';

const ID = '0a1b2c3d-1111-4222-8333-444455556666';

async function setup() {
  await AsyncStorage.clear();
  const h = harness({ limits: PLUS_LIMITS });
  await ready(h.store);
  // Answered on 10-13 and 10-14; 10-15's check-in opens at 20:00.
  h.setTime('2026-10-15', '12:00');
  h.store.setState({ ...DEFAULT_PERSISTED, goals: [{ goal: { ...yesDays(newGoal(), DAY0, 2), goalId: ID }, round: null, seenThrough: null }] });
  const written: { snapshot: WidgetSnapshot; group: string }[] = [];
  const writer = {
    setSnapshotAsync: jest.fn(async (json: string, group: string) => {
      written.push({ snapshot: JSON.parse(json) as WidgetSnapshot, group });
    }),
  };
  const appState = fakeAppState();
  jest.useFakeTimers();
  const stop = startWidgetSync(h.store, writer, appState, () => true);
  return { ...h, written, writer, appState, stop };
}

afterEach(() => {
  jest.useRealTimers();
});

describe('startWidgetSync', () => {
  it('writes a snapshot once storage is read, into the App Group, in 24-hour time if the phone is', async () => {
    const { written, stop } = await setup();
    await jest.advanceTimersByTimeAsync(WIDGET_SETTLE_MS);
    expect(written).toHaveLength(1);
    expect(written[0]?.group).toBe('group.com.e7systems.winzero');
    expect(written[0]?.snapshot.frames[0]?.goals[0]).toMatchObject({ id: ID, state: 'waiting', detail: 'Today 20:00' });
    stop();
  });

  it('writes once for changes close together, and not again when nothing changed', async () => {
    const { store, written, stop } = await setup();
    await jest.advanceTimersByTimeAsync(WIDGET_SETTLE_MS);
    store.getState().setPref('goalInReminders', true);
    store.getState().setGoalAlias(ID, 'Run');
    await jest.advanceTimersByTimeAsync(WIDGET_SETTLE_MS);
    expect(written).toHaveLength(2);
    expect(written[1]?.snapshot.frames[0]?.goals[0]?.label).toBe('Stop drinking');
    // An edit that changes nothing a widget shows.
    store.getState().setMorningTime(ID, '08:00');
    await jest.advanceTimersByTimeAsync(WIDGET_SETTLE_MS);
    expect(written).toHaveLength(2);
    stop();
  });

  it('writes again on a return to the foreground, once the clock has moved', async () => {
    const { written, appState, clock, stop } = await setup();
    await jest.advanceTimersByTimeAsync(WIDGET_SETTLE_MS);
    clock.t += 9 * 3_600_000;
    appState.emit('active');
    await jest.advanceTimersByTimeAsync(WIDGET_SETTLE_MS);
    expect(written).toHaveLength(2);
    expect(written[1]?.snapshot.frames[0]?.goals[0]?.state).toBe('open');
    stop();
    expect(appState.count()).toBe(0);
  });

  it('leaves no goal on a widget after Erase', async () => {
    const { store, written, stop } = await setup();
    await jest.advanceTimersByTimeAsync(WIDGET_SETTLE_MS);
    store.getState().erase();
    await jest.advanceTimersByTimeAsync(WIDGET_SETTLE_MS);
    expect(written.at(-1)?.snapshot.frames).toEqual([]);
    expect(JSON.stringify(written.at(-1))).not.toContain(ID);
    stop();
  });

  it('does nothing in a build without the widgets module', async () => {
    const h = harness({ limits: PLUS_LIMITS });
    await ready(h.store);
    expect(() => startWidgetSync(h.store, null)()).not.toThrow();
  });
});
