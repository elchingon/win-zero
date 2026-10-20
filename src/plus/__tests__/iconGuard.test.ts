// An earned theme's icon leaves the home screen only when it stops being earned: Erase all data, or
// the debug Jump to day, lowering the arsenal's reach (SPEC 9). Nothing else ever switches it.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { THEME_UNLOCK_AURORA, THEME_UNLOCK_GOLD } from '@/engine';
import { DAY0, newGoal, yesDays } from '@/engine/__tests__/fixtures';
import { flush, gid, withGoal } from '@/store/__tests__/harness';
import { PLUS_LIMITS } from '@/store/limits';

import AppIcons from '../../../modules/app-icons';
import { currentIcon, setIcon } from '../appIcon';
import { startIconGuard } from '../iconGuard';

let stop: (() => void) | null = null;

beforeEach(async () => {
  await AsyncStorage.clear();
  await AppIcons.setIconAsync(null);
});
afterEach(() => {
  stop?.();
  stop = null;
});

async function plusAt(best: number) {
  const h = await withGoal(newGoal(), { limits: PLUS_LIMITS });
  h.store.setState({ arsenalBest: best });
  stop = startIconGuard(h.store);
  return h;
}

async function settle() {
  for (let i = 0; i < 5; i++) await flush();
}

describe('the icon guard', () => {
  it('puts back the app’s own icon when Erase un-earns Gold Year', async () => {
    const h = await plusAt(THEME_UNLOCK_GOLD);
    await setIcon('gold');
    h.store.getState().erase();
    await settle();
    expect(await currentIcon()).toBe('default');
  });

  it('keeps an included theme’s icon through Erase, without switching', async () => {
    const h = await plusAt(THEME_UNLOCK_GOLD);
    await setIcon('neon');
    jest.mocked(AppIcons.setIconAsync).mockClear();
    h.store.getState().erase();
    await settle();
    expect(await currentIcon()).toBe('neon');
    expect(AppIcons.setIconAsync).not.toHaveBeenCalled();
  });

  it('when the reach drops but not to zero, keeps what is still earned', async () => {
    const h = await plusAt(400);
    await setIcon('aurora');
    h.store.setState({ arsenalBest: 200 });
    await settle();
    expect(await currentIcon()).toBe('aurora');
    await setIcon('gold');
    h.store.setState({ arsenalBest: THEME_UNLOCK_AURORA });
    await settle();
    expect(await currentIcon()).toBe('default');
  });

  it('follows the debug Jump to day when it rebuilds a shorter run', async () => {
    const h = await withGoal(yesDays(newGoal(), DAY0, 3), { limits: PLUS_LIMITS, dev: true });
    h.store.setState({ arsenalBest: THEME_UNLOCK_GOLD });
    stop = startIconGuard(h.store);
    await setIcon('gold');
    h.store.getState().devJumpToDay(gid(h.store), 30);
    await settle();
    expect(await currentIcon()).toBe('default');
  });

  it('never switches as the reach grows or holds, or once stopped', async () => {
    const h = await plusAt(0);
    await setIcon('gold');
    jest.mocked(AppIcons.setIconAsync).mockClear();
    h.store.setState({ arsenalBest: 10 });
    h.store.setState({ arsenalBest: 10 });
    await settle();
    stop?.();
    stop = null;
    h.store.setState({ arsenalBest: 0 });
    await settle();
    expect(AppIcons.setIconAsync).not.toHaveBeenCalled();
    expect(await currentIcon()).toBe('gold');
  });
});
