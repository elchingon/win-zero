// A clock time, through the browser's own time picker. ClockTime is 'HH:MM', as <input type=time>.
import { isValidClockTime, type ClockTime } from '@/engine';

import { Field } from './bits';

export function TimeField(props: { label: string; value: ClockTime; onChange: (t: ClockTime) => void; hint?: string }) {
  return (
    <Field label={props.label} hint={props.hint}>
      {(id, describedBy) => (
        <input
          id={id}
          className="input time"
          type="time"
          step={60}
          required
          value={props.value}
          aria-describedby={describedBy}
          onChange={(e) => {
            const t = e.target.value.slice(0, 5);
            if (isValidClockTime(t)) props.onChange(t);
          }}
        />
      )}
    </Field>
  );
}
