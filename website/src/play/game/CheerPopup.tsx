// The encouragement that pops up over the filled screen when a round lands: one line to carry
// into the next check-in, and Got it. A click outside the card or Escape dismisses it too; then
// the result sheet rises. The round plays the fanfare.
import { useEffect, useRef, useState } from 'react';

import { cheerDeck } from '@/ui/copy/cheers';

import { Button } from '../ui/Button';

/** One deck for the session, so a replay gets the next line rather than a fresh shuffle. */
const nextCheer = cheerDeck();

export function CheerPopup({ onDismiss }: { onDismiss: () => void }) {
  // Picked once: the line stays put while the popup is up.
  const [text] = useState(nextCheer);
  const card = useRef<HTMLElement>(null);

  // Keyboard and screen reader users land on Got it, so Enter, Space or Escape moves on.
  useEffect(() => {
    card.current?.querySelector('button')?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onDismiss]);

  return (
    // A click on the dimmed zeros dismisses; the keyboard has Escape and Got it.
    <div className="cheer-backdrop" onClick={onDismiss}>
      <section
        ref={card}
        className="card cheer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cheer-text"
        onClick={(e) => e.stopPropagation()}
      >
        <p id="cheer-text" className="cheer-text">
          {text}
        </p>
        <Button label="Got it" onPress={onDismiss} />
      </section>
    </div>
  );
}
