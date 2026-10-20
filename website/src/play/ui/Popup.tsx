// A card that pops up over the round and dims what's behind it: the encouragement after a round,
// and the question before one. `fixed` pins it over the window instead, for a scrolling screen's
// hints. Escape or a click outside the card dismisses it, and keyboard and
// screen reader users land on its first button, or on the one marked data-autofocus.
import { useEffect, useRef, type ReactNode } from 'react';

export function Popup(props: { onDismiss: () => void; labelledBy: string; fixed?: boolean; children: ReactNode }) {
  const { onDismiss, labelledBy, fixed, children } = props;
  const card = useRef<HTMLElement>(null);

  useEffect(() => {
    const target = card.current?.querySelector<HTMLElement>('[data-autofocus]') ?? card.current?.querySelector('button');
    target?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onDismiss]);

  return (
    // A click on the dimmed round dismisses; the keyboard has Escape and the card's buttons.
    <div className={`popup-backdrop${fixed ? ' fixed' : ''}`} onClick={onDismiss}>
      <section
        ref={card}
        className="card popup"
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </section>
    </div>
  );
}
