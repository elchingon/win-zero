// Touch targets: every small control is at least MIN_TARGET by its own bounds, which is what
// Android's Accessibility Scanner measures (hitSlop doesn't count there).
import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import { StyleSheet, type ViewStyle } from 'react-native';

import { newGoal } from '@/engine/__tests__/fixtures';
import { WeekdayPicker } from '@/plus/goals/WeekdayPicker';
import { GoalPicker } from '@/plus/home/GoalPicker';
import { HomeTabs } from '@/plus/home/HomeTabs';
import { CallButton } from '@/plus/ui/CallButton';
import { Chip, StatTile } from '@/ui/bits';
import { Button, LinkButton } from '@/ui/Button';
import { HistoryCalendar } from '@/ui/home/HistoryCalendar';
import { MIN_TARGET } from '@/ui/target';

/** The control's own size, by its style: [width, height], from min sizes or fixed ones. */
function bounds(el: { props: { style?: unknown } }): [number, number] {
  const s = (StyleSheet.flatten(el.props.style as ViewStyle) ?? {}) as ViewStyle;
  const size = (fixed: unknown, min: unknown) => Math.max(Number(fixed) || 0, Number(min) || 0);
  return [size(s.width, s.minWidth), size(s.height, s.minHeight)];
}

const tall = (el: { props: { style?: unknown } }) => expect(bounds(el)[1]).toBeGreaterThanOrEqual(MIN_TARGET);
const square = (el: { props: { style?: unknown } }) => {
  const [w, h] = bounds(el);
  expect(Math.min(w, h)).toBeGreaterThanOrEqual(MIN_TARGET);
};

describe('touch targets', () => {
  it('chips, even short ones', async () => {
    await render(<Chip label="10" selected={false} onPress={() => {}} />);
    square(screen.getByRole('button', { name: '10' }));
  });

  it('small buttons and links', async () => {
    await render(
      <>
        <Button small variant="ghost" label="Turn on" onPress={() => {}} />
        <LinkButton label="Erase all data" onPress={() => {}} />
      </>,
    );
    tall(screen.getByRole('button', { name: 'Turn on' }));
    tall(screen.getByRole('button', { name: 'Erase all data' }));
  });

  it("a stat tile's hint", async () => {
    await render(<StatTile label="Game credits" value="2" help={{ label: 'About Game credits', onPress: () => {} }} />);
    square(screen.getByRole('button', { name: 'About Game credits' }));
  });

  it("the calendar's month arrows", async () => {
    await render(<HistoryCalendar goal={newGoal()} today="2026-10-15" pendingDay={null} firstWeekday={1} />);
    for (const el of screen.getAllByRole('button', { name: /month/ })) square(el);
  });

  it("Win Zero Plus's goal chips, tabs, weekday toggles and call buttons", async () => {
    const goal = newGoal();
    await render(
      <>
        <GoalPicker slots={[{ goal, round: null, seenThrough: null }]} picked={goal.goalId} onPick={() => {}} onAdd={() => {}} />
        <HomeTabs tab="goals" onTab={() => {}} />
        <WeekdayPicker days={[1, 3, 5]} onChange={() => {}} />
        <CallButton label="Edit" onPress={() => {}} />
      </>,
    );
    tall(screen.getByRole('radio', { name: goal.goal }));
    for (const el of screen.getAllByRole('tab')) tall(el);
    for (const el of screen.getAllByRole('checkbox')) tall(el);
    tall(screen.getByRole('button', { name: 'Add goal' }));
    tall(screen.getByRole('button', { name: 'Edit' }));
  });
});
