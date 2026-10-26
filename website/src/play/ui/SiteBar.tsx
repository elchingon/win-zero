// The website's links, over every screen of the app and the round too, so getting the apps, Win
// Zero Plus and help are a tap away mid-game. Wide windows show every link; narrow ones fold all
// but Get the app under Menu. The site links leave the app; a round left that way waits on Home,
// as after ✕, and its Yes is already saved.
import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router';

import { ROUTES } from '../nav';

/** Pages of the site, beside the app's own How it works. */
const SITE_LINKS = [
  { href: '/plus', label: 'Win Zero Plus' },
  { href: '/support', label: 'Support' },
  { href: '/privacy', label: 'Privacy' },
] as const;

export function SiteBar() {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const bar = useRef<HTMLElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);

  // Escape, or a press anywhere else, closes the menu.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      toggle.current?.focus();
    };
    const onPress = (e: PointerEvent) => {
      if (!(e.target instanceof Node) || !bar.current?.contains(e.target)) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onPress, { capture: true });
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onPress, { capture: true });
    };
  }, [open]);

  return (
    <header ref={bar} className="sitebar">
      <a className="sitebar-home" href="/">
        <span className="sitebar-mark" aria-hidden="true" />
        winzero.app
      </a>
      <nav className="sitebar-nav" aria-label="Site">
        <a className="sitebar-cta" href="/#get-the-app">
          Get the app
        </a>
        <button
          ref={toggle}
          type="button"
          className="sitebar-toggle"
          aria-expanded={open}
          aria-controls={menuId}
          onClick={() => setOpen((o) => !o)}
        >
          Menu
        </button>
        <ul id={menuId} className={`sitebar-links${open ? ' open' : ''}`}>
          <li>
            <Link to={ROUTES.howItWorks} onClick={() => setOpen(false)}>
              How it works
            </Link>
          </li>
          {SITE_LINKS.map((l) => (
            <li key={l.href}>
              <a href={l.href}>{l.label}</a>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
