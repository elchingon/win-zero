// Home's tip after the first Yes's round (SPEC 6): a word for starting, how the app works, and when
// the next check-in comes. Shown once, when Home is back in front: Home stays mounted under the
// round, and the popup is a Modal, which would otherwise open over it. Home's popups come one at a
// time (homePopupOf), this one first.
import { useIsFocused } from 'expo-router';
import { Text } from 'react-native';

import { isEveryDay, isHeadStart, nextWindow } from '@/engine';
import { formatWhen } from '@/lib/format';
import { appStore, firstRoundTipSlot, homePopupOf, useApp } from '@/store';
import { type } from '@/theme/tokens';
import { firstRoundTip } from '@/ui/copy/tips';
import { HintPopup } from '@/ui/HintPopup';
import { useDeviceCalendar } from '@/ui/useDevice';

/**
 * `afterHeadStart`: the title and first line for a goal that came in with a head start (Win Zero
 * Plus, SPEC 9), whose first check-in isn't its day one.
 */
export function FirstRoundTip({ afterHeadStart }: { afterHeadStart?: { title: string; line: string } } = {}) {
  const slot = useApp(firstRoundTipSlot);
  const first = useApp(homePopupOf) === 'first-round';
  const focused = useIsFocused();
  const { h24 } = useDeviceCalendar();

  const store = appStore.getState();
  const words = slot?.round
    ? firstRoundTip({
        next: slot.round.n + 1,
        nextWhen: formatWhen(nextWindow(slot.goal).opensAt, store.now(), store.timeZone(), h24),
        everyDay: isEveryDay(slot.goal),
        earnedCredit: slot.round.rewards.credits.some((g) => g.kind === 'game'),
      })
    : null;
  const tip =
    words && afterHeadStart && slot?.goal.history.some(isHeadStart)
      ? { ...words, title: afterHeadStart.title, lines: [afterHeadStart.line, ...words.lines.slice(1)] }
      : words;

  return (
    <HintPopup
      visible={tip !== null && focused && first}
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
