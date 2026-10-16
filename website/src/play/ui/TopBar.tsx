// The brand row, with an optional action on the right. The wordmark goes to the website's home.
import type { ReactNode } from 'react';

export function TopBar({ right }: { right?: ReactNode }) {
  return (
    <header className="topbar">
      <a className="brand" href="/" aria-label="Win Zero, winzero.app home">
        <span className="mark" aria-hidden="true" />
        <span className="word">WIN ZERO</span>
      </a>
      {right}
    </header>
  );
}
