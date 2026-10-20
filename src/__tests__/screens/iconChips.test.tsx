// Win Zero Plus's debug icon chips (SPEC 9): every icon, with the ones not earned yet marked, and a
// tap switches the home-screen icon, even to a locked one, since this is for trying them on a phone.
import './env/plus';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { THEME_UNLOCK_GOLD } from '@/engine';
import { IconChips } from '@/dev/IconChips';
import { appStore } from '@/store';
import { DEFAULT_PERSISTED } from '@/store/migrate';

import AppIcons from '../../../modules/app-icons';

const LABELS = ['Win Zero Plus', 'Classic', 'Neon Arcade', 'Mono CRT', 'Pastel', 'Ember', 'Aurora', 'Gold Year'];

beforeEach(async () => {
  await AsyncStorage.clear();
  await AppIcons.setIconAsync(null);
  appStore.setState({ ...DEFAULT_PERSISTED });
});

async function show() {
  await render(<IconChips />);
  await act(async () => {});
}

describe('the debug icon chips', () => {
  it('lists every icon, marking the three not earned at a best of 0, with the app’s own selected', async () => {
    await show();
    expect(screen.getByText('App icon')).toBeTruthy();
    for (const label of ['Win Zero Plus', 'Classic', 'Neon Arcade', 'Mono CRT', 'Pastel']) {
      expect(screen.getByText(label)).toBeTruthy();
    }
    expect(screen.getByText('Ember · locked until 30')).toBeTruthy();
    expect(screen.getByText('Aurora · locked until 180')).toBeTruthy();
    expect(screen.getByText('Gold Year · locked until 365')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Win Zero Plus' }).props.accessibilityState).toMatchObject({ selected: true });
  });

  it('switches the icon on a tap, and selects it', async () => {
    await show();
    await fireEvent.press(screen.getByText('Neon Arcade'));
    await act(async () => {});
    expect(await AppIcons.getIconAsync()).toBe('neon');
    expect(screen.getByRole('button', { name: 'Neon Arcade' }).props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByRole('button', { name: 'Win Zero Plus' }).props.accessibilityState).toMatchObject({ selected: false });
  });

  it('switches to a locked icon too, for trying it out', async () => {
    await show();
    await fireEvent.press(screen.getByText('Gold Year · locked until 365'));
    await act(async () => {});
    expect(await AppIcons.getIconAsync()).toBe('gold');
  });

  it('marks nothing as locked at a best of 365', async () => {
    appStore.setState({ arsenalBest: THEME_UNLOCK_GOLD });
    await show();
    for (const label of LABELS) expect(screen.getByText(label)).toBeTruthy();
    expect(screen.queryByText(/locked/)).toBeNull();
  });
});
