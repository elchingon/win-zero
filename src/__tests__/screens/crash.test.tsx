// The crash screens the root layout and the round export as error boundaries: plain words that
// nothing is lost, and Back to base. The layout's shared field and the round's canvas (Skia)
// are stood in for; only the boundaries render.
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import { ErrorBoundary as RootErrorBoundary } from '@/app/_layout';
import { ErrorBoundary as RoundErrorBoundary } from '@/app/play';
import { APP_LINKS } from '@/ui/support';

jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
jest.mock('@/notifications', () => ({ startNotifications: () => () => {} }));
jest.mock('@/ui/ZeroField', () => ({ ZeroField: () => null }));
jest.mock('@/ui/YesCelebration', () => ({ YesCelebration: () => null }));
jest.mock('@/ui/LaunchSplash', () => ({ LaunchSplash: () => null }));
jest.mock('@/game/GameCanvas', () => ({ GameCanvas: () => null }));
jest.mock('@/game/Hud', () => ({ Hud: () => null }));
jest.mock('@/game/ResultSheet', () => ({ ResultSheet: () => null }));
jest.mock('@/game/sfx', () => ({ useSfx: () => ({}) }));

afterEach(() => {
  jest.restoreAllMocks();
});

describe('crash screens', () => {
  it('outside the round: says nothing is lost, gives the support email, and renders the app again', async () => {
    const retry = jest.fn(async () => {});
    await render(<RootErrorBoundary error={new Error('boom')} retry={retry} />);
    expect(screen.getByRole('header', { name: 'Win Zero hit a snag.' })).toBeOnTheScreen();
    expect(screen.getByText('Your streak, history and rewards are saved on this phone.')).toBeOnTheScreen();
    expect(screen.getByText(new RegExp(APP_LINKS.email))).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Back to base' }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('in the round: says the Yes is banked, and goes back to Home', async () => {
    const dismissTo = jest.spyOn(router, 'dismissTo').mockImplementation(() => {});
    await render(<RoundErrorBoundary error={new Error('boom')} retry={async () => {}} />);
    expect(screen.getByRole('header', { name: 'The round hit a snag.' })).toBeOnTheScreen();
    expect(screen.getByText(/rewards are already banked/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Back to base' }));
    expect(dismissTo).toHaveBeenCalledWith('/');
  });

  it('shows the error itself only in development builds', async () => {
    await render(<RootErrorBoundary error={new Error('Cannot read x of undefined')} retry={async () => {}} />);
    expect(screen.getByText('Cannot read x of undefined')).toBeOnTheScreen(); // jest runs as __DEV__
  });
});
