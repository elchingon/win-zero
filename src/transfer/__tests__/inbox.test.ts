// A move's link waits in the inbox. Win Zero acts on Plus's confirmation only once storage has been
// read, only for the move it sent, and only once that move has left where it was put.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { DAY0, newGoal, yesDays } from '@/engine/__tests__/fixtures';
import { harness, ready, withGoal } from '@/store/__tests__/harness';
import { isMovedOut } from '@/store/select';

import { clearImport, deliver, importDelivery, startMoveAcks, subscribe } from '../inbox';

beforeEach(async () => {
  await AsyncStorage.clear();
  clearImport();
});

describe('deliveries (Win Zero Plus)', () => {
  it('keeps the latest move to take in, counting each arrival', () => {
    const heard = jest.fn();
    const stop = subscribe(heard);
    deliver({ kind: 'import', t: 'aaaa-1111', d: null });
    const first = importDelivery();
    expect(first).toMatchObject({ t: 'aaaa-1111', d: null });
    deliver({ kind: 'import', t: 'aaaa-1111', d: null });
    expect(importDelivery()?.seq).toBeGreaterThan(first!.seq);
    clearImport();
    expect(importDelivery()).toBeNull();
    expect(heard).toHaveBeenCalledTimes(3);
    stop();
  });
});

describe('confirmations (Win Zero)', () => {
  const handedOver = { handedOver: () => true };

  it('confirms the move it sent once storage is read, including one that came with the launch', async () => {
    deliver({ kind: 'moved', t: 'goal-1' });
    const h = harness();
    const stop = startMoveAcks(h.store, handedOver);
    await ready(h.store);
    expect(h.store.getState().moveOut).toBeNull(); // no move sent: nothing to confirm
    h.store.getState().addGoal({ goal: 'Stop drinking', checkInTime: '20:00', morningTime: '09:00' });
    const id = h.store.getState().startMoveOut()!;
    deliver({ kind: 'moved', t: id });
    expect(isMovedOut(h.store.getState())).toBe(true);
    stop();
  });

  it('ignores a confirmation for another move, or one still waiting where it was left', async () => {
    const h = await withGoal(yesDays(newGoal(), DAY0, 3));
    const left = new Set<string>();
    const stop = startMoveAcks(h.store, { handedOver: (t) => !left.has(t) });
    const id = h.store.getState().startMoveOut()!;
    deliver({ kind: 'moved', t: 'someone-else' });
    left.add(id);
    deliver({ kind: 'moved', t: id });
    expect(h.store.getState().moveOut?.status).toBe('sent');
    left.delete(id);
    deliver({ kind: 'moved', t: id });
    expect(isMovedOut(h.store.getState())).toBe(true);
    stop();
  });

  it('stops listening on cleanup', async () => {
    const h = await withGoal(newGoal());
    startMoveAcks(h.store, handedOver)();
    deliver({ kind: 'moved', t: h.store.getState().startMoveOut()! });
    expect(h.store.getState().moveOut?.status).toBe('sent');
  });
});
