// @vitest-environment jsdom
// The site bar: the website's links, with the narrow window's Menu that opens and closes them.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';

import { SiteBar } from './SiteBar';

afterEach(cleanup);

function open() {
  const router = createMemoryRouter([{ path: '*', element: <SiteBar /> }], { initialEntries: ['/round'] });
  render(<RouterProvider router={router} />);
  return router;
}

describe('SiteBar', () => {
  it('links to the apps, Plus, help and the privacy policy', () => {
    open();
    const links = screen.getAllByRole('link').map((a) => [a.textContent, a.getAttribute('href')]);
    expect(links).toEqual([
      ['winzero.app', '/'],
      ['Get the app', '/#get-the-app'],
      ['How it works', '/how-it-works'],
      ['Win Zero Plus', '/plus'],
      ['Support', '/support'],
      ['Privacy', '/privacy'],
    ]);
  });

  it('opens the menu, and closes it on Escape or a press elsewhere', () => {
    open();
    const menu = screen.getByRole('button', { name: 'Menu' });
    const list = document.getElementById(menu.getAttribute('aria-controls') ?? '');
    expect(menu.getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(menu);
    expect(menu.getAttribute('aria-expanded')).toBe('true');
    expect(list?.className).toContain('open');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(menu.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(menu);

    fireEvent.click(menu);
    fireEvent.pointerDown(screen.getByRole('link', { name: 'Support' }));
    expect(menu.getAttribute('aria-expanded')).toBe('true');
    fireEvent.pointerDown(document.body);
    expect(menu.getAttribute('aria-expanded')).toBe('false');
  });

  it('closes the menu on the way to How it works', () => {
    const router = open();
    const menu = screen.getByRole('button', { name: 'Menu' });
    fireEvent.click(menu);
    fireEvent.click(screen.getByRole('link', { name: 'How it works' }));
    expect(router.state.location.pathname).toBe('/how-it-works');
    expect(menu.getAttribute('aria-expanded')).toBe('false');
  });
});
