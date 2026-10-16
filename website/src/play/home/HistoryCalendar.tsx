// One month of check-ins: yes / not today / shielded / missed, with misses after a long-break
// reset muted as "paused". Browsable from the first goal day to today.
import { useMemo, useState } from 'react';

import { calendarMark, type CalendarMark, type DayKey, type GoalState } from '@/engine';
import { addMonths, monthGrid, monthOf, monthSummary, weekdayInitials, type MonthKey } from '@/lib/calendar';
import { formatDayShort, formatMonth } from '@/lib/format';

import { announce } from '../platform/announce';
import { Eyebrow } from '../ui/bits';

type Mark = CalendarMark | 'pending';

const MARK_WORDS: Record<Mark, string> = {
  yes: 'Yes',
  no: 'Not today',
  shielded: 'Shielded',
  missed: 'Missed',
  paused: 'Paused',
  pending: 'Waiting for your answer',
};

const LEGEND: Mark[] = ['yes', 'no', 'shielded', 'missed', 'paused'];

function MarkGlyph({ mark }: { mark: Mark }) {
  return <span className={`glyph glyph-${mark}`} aria-hidden="true" />;
}

export function HistoryCalendar(props: { goal: GoalState; today: DayKey; pendingDay: DayKey | null; firstWeekday: number }) {
  const { goal, today, pendingDay, firstWeekday } = props;
  const first = monthOf(goal.firstDay);
  const last = monthOf(today);
  const [month, setMonth] = useState(last);
  const shown = month > last ? last : month < first ? first : month;

  const marks = useMemo(() => new Map(goal.history.map((e) => [e.day, calendarMark(e)])), [goal.history]);
  const weeks = useMemo(() => monthGrid(shown, firstWeekday), [shown, firstWeekday]);

  const markOf = (day: DayKey): Mark | null => marks.get(day) ?? (day === pendingDay ? 'pending' : null);

  const go = (to: MonthKey) => {
    setMonth(to);
    announce(monthSummary(to, marks));
  };
  const prev = addMonths(shown, -1);
  const next = addMonths(shown, 1);

  return (
    <section className="section" aria-labelledby="history-title">
      <div className="section-head">
        <Eyebrow header>
          <span id="history-title">History</span>
        </Eyebrow>
        <div className="month-nav">
          <button type="button" className="arrow" aria-label={`Previous month, ${formatMonth(prev)}`} disabled={shown <= first} onClick={() => go(prev)}>
            ‹
          </button>
          <span className="month" aria-label={monthSummary(shown, marks)}>
            {formatMonth(shown)}
          </span>
          <button type="button" className="arrow" aria-label={`Next month, ${formatMonth(next)}`} disabled={shown >= last} onClick={() => go(next)}>
            ›
          </button>
        </div>
      </div>

      <table className="calendar">
        <thead>
          <tr>
            {weekdayInitials(firstWeekday).map((d, i) => (
              <th key={i} scope="col" aria-hidden="true">
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week, w) => (
            <tr key={w}>
              {week.map((day, i) => {
                if (!day) return <td key={i} />;
                const mark = markOf(day);
                const outside = day < goal.firstDay || day > today;
                return (
                  <td key={day} className={outside ? 'outside' : undefined} aria-hidden={outside || undefined}>
                    <span className="sr-only">
                      {`${formatDayShort(day)}${day === today ? ', today' : ''}${mark ? `: ${MARK_WORDS[mark]}` : ''}`}
                    </span>
                    <span className={`date${day === today ? ' today' : ''}`} aria-hidden="true">
                      {Number(day.slice(8))}
                    </span>
                    <span className="glyph-slot">{mark ? <MarkGlyph mark={mark} /> : null}</span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <ul className="legend" aria-hidden="true">
        {LEGEND.map((m) => (
          <li key={m}>
            <MarkGlyph mark={m} />
            {MARK_WORDS[m]}
          </li>
        ))}
      </ul>
    </section>
  );
}
