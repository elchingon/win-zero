// Home's Game credits count in Win Zero Plus, with its secret: three quick taps give a free Game
// credit, announced with a popup and the Yes celebration's chime and haptic (played by the overlay
// at the root, which already holds the chime). Settings › Games drops a hint. The count looks and
// reads as it does in Win Zero, and its "i" still opens the hint.
import { useState, type ComponentProps } from 'react';
import { Modal } from 'react-native';

import { appStore } from '@/store';
import { StatTile } from '@/ui/bits';
import { yesCelebration } from '@/ui/celebrate';
import type { CreditNews } from '@/ui/copy/credits';
import { CreditPopup } from '@/ui/CreditPopup';

import { SECRET_COPY } from '../copy';
import { secretTaps } from './secretTaps';

export function SecretGameTile(props: Omit<ComponentProps<typeof StatTile>, 'onPress'>) {
  const [tap] = useState(secretTaps);
  const [news, setNews] = useState<CreditNews | null>(null);
  const close = () => setNews(null);

  const onPress = () => {
    if (!tap(Date.now())) return;
    const balance = appStore.getState().giftCredit();
    if (balance === null) return;
    yesCelebration.cue();
    setNews(SECRET_COPY.news(balance));
  };

  return (
    <>
      <StatTile {...props} onPress={onPress} />
      {/* A real Modal, so the popup covers the whole screen from inside Home's scroll. */}
      <Modal visible={news !== null} transparent animationType="none" onRequestClose={close} statusBarTranslucent>
        {news ? <CreditPopup news={news} onDismiss={close} /> : null}
      </Modal>
    </>
  );
}
