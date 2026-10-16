// Home's numbers: the streak, the best run (and when it was), Yes days in all and this month,
// bombs and shields.
import { historyStats, SHIELD_CAP, type DayKey, type GoalState } from '@/engine';
import { formatDayRange, plural } from '@/lib/format';

import { StatTile } from '../ui/bits';

export function Stats({ goal, today }: { goal: GoalState; today: DayKey }) {
  const { yesDays, yesThisMonth, bestRun } = historyStats(goal, today);
  return (
    <div className="stats">
      <StatTile label="Current streak" value={String(goal.streak)} hero spoken={`Current streak: ${plural(goal.streak, 'zero')}`} />
      <StatTile
        label="Best run"
        value={String(goal.bestStreak)}
        caption={bestRun ? formatDayRange(bestRun.from, bestRun.to, today) : undefined}
        spoken={`Best run: ${plural(goal.bestStreak, 'day')}${bestRun ? `, ${formatDayRange(bestRun.from, bestRun.to, today, ' to ')}` : ''}`}
      />
      <StatTile label="Yes days" value={String(yesDays)} spoken={`Yes days: ${yesDays}`} />
      <StatTile label="Yes this month" value={String(yesThisMonth)} spoken={`Yes days this month: ${yesThisMonth}`} />
      <StatTile label="Bombs" value={String(goal.bombs)} />
      <StatTile label="Shields" value={`${goal.shields}/${SHIELD_CAP}`} spoken={`Shields: ${goal.shields} of ${SHIELD_CAP}`} />
    </div>
  );
}
