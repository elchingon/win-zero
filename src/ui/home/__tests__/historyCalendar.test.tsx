// The history calendar's marks: Shielded's shape, and the rest-day mark (SPEC 9), only where
// goals check in on chosen days.
import { describe, expect, it } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';

import type { GoalState } from '@/engine';
import { answerDay, NEW_YORK, newGoal, yesDays } from '@/engine/__tests__/fixtures';

import { HistoryCalendar, MarkGlyph } from '../HistoryCalendar';

/** expo-localization's numbering: 1 = Sunday. */
const SUNDAY_FIRST = 1;

/**
 * Monday, Wednesday and Friday, set up on Monday 10-26 in New York, answered Yes through Monday
 * 11-2: across the US fall-back change on Sunday 11-1.
 */
function monWedFri(): GoalState {
  let goal = newGoal({ tz: NEW_YORK, day: '2026-10-26', days: [1, 3, 5] });
  for (const day of ['2026-10-26', '2026-10-28', '2026-10-30', '2026-11-02']) {
    goal = answerDay(goal, day, 'yes', { tz: NEW_YORK }).state;
  }
  return goal;
}

/** The legend is hidden from screen readers (each day says its own mark), so ask for hidden text too. */
const legend = (word: string) => screen.queryByText(word, { includeHiddenElements: true });

async function show(goal: GoalState, today: string, restDays?: boolean) {
  await render(
    <HistoryCalendar goal={goal} today={today} pendingDay={null} firstWeekday={SUNDAY_FIRST} restDays={restDays} />,
  );
}

describe('rest days on the history calendar', () => {
  it('marks the days between check-in days, through the clock change, up to today', async () => {
    await show(monWedFri(), '2026-11-03', true);
    expect(screen.getByLabelText('Nov 1: Rest day')).toBeTruthy(); // the Sunday the clocks went back
    expect(screen.getByLabelText('Nov 2: Yes')).toBeTruthy();
    expect(screen.getByLabelText('Nov 3, today: Rest day')).toBeTruthy();
    // Tomorrow, and any day before the goal began: no mark, and hidden from screen readers.
    expect(screen.getByLabelText('Nov 4', { includeHiddenElements: true })).toBeTruthy();
    expect(legend('Rest day')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Previous month, October 2026' }));
    for (const day of [27, 29, 31]) expect(screen.getByLabelText(`Oct ${day}: Rest day`)).toBeTruthy();
    for (const day of [26, 28, 30]) expect(screen.getByLabelText(`Oct ${day}: Yes`)).toBeTruthy();
    expect(screen.getByLabelText('Oct 25', { includeHiddenElements: true })).toBeTruthy();
  });

  it('marks none for a goal that checks in every day, and keeps the five-mark legend', async () => {
    await show(yesDays(newGoal({ tz: NEW_YORK }), '2026-10-13', 5, NEW_YORK), '2026-10-18', true);
    expect(screen.queryByLabelText(/Rest day/)).toBeNull();
    expect(legend('Rest day')).toBeNull();
    for (const word of ['Yes', 'Not today', 'Shielded', 'Missed', 'Paused']) expect(legend(word)).toBeTruthy();
  });

  it('works out nothing where the app has no check-in days, as in Win Zero', async () => {
    await show(monWedFri(), '2026-11-03');
    expect(screen.queryByLabelText(/Rest day/)).toBeNull();
    expect(screen.getByLabelText('Nov 1')).toBeTruthy();
    expect(legend('Rest day')).toBeNull();
  });
});

describe('the Shielded mark', () => {
  it("has a dot inside its ring, so it isn't told from Yes by color alone", async () => {
    const parts = async (mark: 'yes' | 'shielded') => {
      const { toJSON } = await render(<MarkGlyph mark={mark} />);
      return (toJSON() as { children: unknown[] | null }).children?.length ?? 0;
    };
    expect(await parts('yes')).toBe(0);
    expect(await parts('shielded')).toBe(1);
  });
});
