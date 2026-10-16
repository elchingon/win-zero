// A screen's frame: the 480px column with the prototype's 20px gutter and 22px section gap.
// The backdrop is the shared ZeroField behind every screen.
import type { ReactNode } from 'react';

export function Screen(props: { children: ReactNode; centered?: boolean; label?: string }) {
  return (
    <main id="main" className={`screen${props.centered ? ' centered' : ''}`} aria-label={props.label}>
      {props.children}
    </main>
  );
}
