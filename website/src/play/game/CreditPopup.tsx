// The popup after the first play of a round whose Yes earned a Game credit, as on the app: a big
// amber "+1", why it came and how many there are now, and its button. A click outside the card or
// Escape dismisses it too; then the result sheet rises. The round plays the chime.
import { useId } from 'react';

import type { CreditNews } from '@/ui/copy/credits';

import { Button } from '../ui/Button';
import { Popup } from '../ui/Popup';

export function CreditPopup({ news, onDismiss }: { news: CreditNews; onDismiss: () => void }) {
  const title = useId();
  return (
    // The button takes focus, so Enter, Space or Escape moves on.
    <Popup onDismiss={onDismiss} labelledBy={title}>
      <h2 id={title} className="popup-title credit-title">
        <span className="credit-badge">{news.badge}</span> {news.title}
      </h2>
      {news.lines.map((line) => (
        <p key={line} className="credit-line">
          {line}
        </p>
      ))}
      <Button label={news.button} onPress={onDismiss} />
    </Popup>
  );
}
