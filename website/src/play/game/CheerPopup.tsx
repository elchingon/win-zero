// The encouragement that pops up over the filled screen when a round lands: one line to carry
// into the next check-in, and Got it. A click outside the card or Escape dismisses it too; then
// the result sheet rises. The round plays the fanfare.
import { useState } from 'react';

import { cheerDeck } from '@/ui/copy/cheers';

import { Button } from '../ui/Button';
import { Popup } from '../ui/Popup';

/** One deck for the session, so a replay gets the next line rather than a fresh shuffle. */
const nextCheer = cheerDeck();

export function CheerPopup({ onDismiss }: { onDismiss: () => void }) {
  // Picked once: the line stays put while the popup is up.
  const [text] = useState(nextCheer);

  return (
    // Got it takes focus, so Enter, Space or Escape moves on.
    <Popup onDismiss={onDismiss} labelledBy="cheer-text">
      <p id="cheer-text" className="cheer-text">
        {text}
      </p>
      <Button label="Got it" onPress={onDismiss} />
    </Popup>
  );
}
