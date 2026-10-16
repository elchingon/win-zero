// The big zero on the Reset / Shielded / Slipping screens (the prototype's .reset-zero), with a
// small motion for each, in CSS: a reset settles in, a shield pulses as it absorbs, a slip sheds
// a zero. Still under reduce motion (app.css).
import type { NoticeMotion } from '@/ui/copy/notice';

export function NoticeZero({ tone, motion }: { tone: 'amber' | 'flare' | 'teal'; motion: NoticeMotion }) {
  return (
    <div className={`notice-zero tone-${tone} motion-${motion}`} aria-hidden="true">
      {motion === 'absorb' ? <span className="nz-pulse" /> : null}
      <span className="nz-ring" />
      {motion === 'shed' ? <span className="nz-small" /> : null}
    </div>
  );
}
