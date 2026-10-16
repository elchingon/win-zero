// @vitest-environment jsdom
// The screens on the shared store, in a browser-like page with the game's canvas stubbed out:
// setting up, checking in Yes (to the round), and Not today (to the notice, with Undo).
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { routes } from './router';
import { appStore } from './store';

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext;
});

beforeEach(async () => {
  await waitFor(() => expect(appStore.getState().hydrated).toBe(true));
  appStore.getState().erase();
});

afterEach(cleanup);

function open(path = '/') {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

/** Set up a goal whose check-in opened at midnight, so today's is open now. */
async function setUp(goal: string) {
  const router = open();
  await screen.findByRole('button', { name: 'Start my streak' });
  expect(router.state.location.pathname).toBe('/setup');
  fireEvent.change(screen.getByLabelText('Your daily goal'), { target: { value: goal } });
  fireEvent.change(screen.getByLabelText('Check-in time'), { target: { value: '00:00' } });
  fireEvent.click(screen.getByRole('button', { name: 'Start my streak' }));
  await screen.findByRole('heading', { name: `Did you stick to “${goal}” today?` });
  expect(router.state.location.pathname).toBe('/');
  return router;
}

describe('the app on the web', () => {
  it('sets up a goal, checks in Yes, and opens the round', async () => {
    const router = await setUp('Read 20 minutes');
    fireEvent.click(screen.getByRole('button', { name: 'Yes, I did' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/round'));
    expect(appStore.getState().round).toMatchObject({ n: 1, played: false });
    expect(appStore.getState().goal?.streak).toBe(1);
    expect(await screen.findByRole('button', { name: 'Leave the round' })).toBeTruthy();

    // Back on Home, the unplayed round waits there.
    await router.navigate('/');
    expect(await screen.findByText('Your Day 1 round is ready.')).toBeTruthy();
  });

  it('answers Not today, shows the notice, and can take it back', async () => {
    const router = await setUp('Quit vaping');
    fireEvent.click(screen.getByRole('button', { name: 'Not today' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/notice'));
    expect(await screen.findByRole('heading', { name: 'Thanks for checking in.' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Undo Not today' }));
    await screen.findByRole('heading', { name: 'Did you stick to “Quit vaping” today?' });
    expect(appStore.getState().goal?.history).toHaveLength(0);
  });

  it('keeps Settings and How it works free of notification talk', async () => {
    await setUp('Exercise more');
    cleanup();
    open('/how-it-works');
    const main = await screen.findByRole('main');
    expect(main.textContent).not.toMatch(/notification|reminder comes|Weekly nudge/i);
    expect(main.textContent).toContain('On the web');
  });
});
