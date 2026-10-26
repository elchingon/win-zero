// Home's tip after the first Yes's round (SPEC 6): a word for starting, how the app works, and when
// the next check-in comes. Shown once, when Home is back in front: Home stays mounted under the
// round, and the popup is a Modal, which would otherwise open over it.
import { useIsFocused } from 'expo-router';
import { Text } from 'react-native';

import { isEveryDay, nextWindow } from '@/engine';
import { formatWhen } from '@/lib/format';
import { appStore, firstRoundTipSlot, useApp } from '@/store';
import { type } from '@/theme/tokens';
import { firstRoundTip } from '@/ui/copy/tips';
import { HintPopup } from '@/ui/HintPopup';
import { useDeviceCalendar } from '@/ui/useDevice';

export function FirstRoundTip() {
  const slot = useApp(firstRoundTipSlot);
  const focused = useIsFocused();
  const { h24 } = useDeviceCalendar();

  const store = appStore.getState();
  const tip = slot?.round
    ? firstRoundTip({
        next: slot.round.n + 1,
        nextWhen: formatWhen(nextWindow(slot.goal).opensAt, store.now(), store.timeZone(), h24),
        everyDay: isEveryDay(slot.goal),
        earnedCredit: slot.round.rewards.credits.some((g) => g.kind === 'game'),
      })
    : null;

  return (
    <HintPopup
      visible={tip !== null && focused}
      title={tip?.title ?? ''}
      closeLabel={tip?.button}
      onClose={() => appStore.getState().seeTip('first-round')}
    >
      {tip?.lines.map((line) => (
        <Text key={line} style={type.body}>
          {line}
        </Text>
      ))}
    </HintPopup>
  );
}
