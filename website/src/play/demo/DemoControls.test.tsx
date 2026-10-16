// @vitest-environment jsdom
// In demo mode, on its copy of the progress: the demo controls offer practice rounds, and a
// practice round plays any size with every weapon. (Outside demo mode they don't: flow.test.tsx.)
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { routes } from '../router';
import { DemoControls } from './DemoControls';

vi.mock('../platform/mode', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../platform/mode')>()),
  isDemo: () => true,
}));

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext;
});

afterEach(cleanup);

describe('demo mode', () => {
  it('offers practice rounds in the demo controls', () => {
    const router = createMemoryRouter([{ path: '/', element: <DemoControls /> }]);
    render(<RouterProvider router={router} />);
    fireEvent.change(screen.getByLabelText('Zeros in the practice round'), { target: { value: '250' } });
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    expect(router.state.location.pathname).toBe('/round');
    expect(router.state.location.search).toBe('?practice=250');
  });

  it('plays a practice round of any size', async () => {
    const router = createMemoryRouter(routes, { initialEntries: ['/round?practice=250'] });
    render(<RouterProvider router={router} />);
    expect(await screen.findByRole('main', { name: 'Practice round' })).toBeTruthy();
    expect(screen.getByText('PRACTICE')).toBeTruthy();
    expect(screen.getByLabelText('250 of 250 zeros left')).toBeTruthy();
  });
});
