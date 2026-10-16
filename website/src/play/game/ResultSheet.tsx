// The result sheet over the filled screen: the day, "N zeros down", what the Yes earned and the
// next unlock (the shared resultLines), Back to base, Replay, and sharing a milestone.
import { useEffect, useRef, useState } from 'react';

import { resultLines, sheetEyebrow, type ResultMode } from '@/game/result';
import { milestoneShareText } from '@/game/shareText';
import { formatCount } from '@/lib/format';
import type { RoundRecord } from '@/store/types';

import { shareText } from '../platform/share';
import { useApp } from '../store';
import { Em } from '../ui/bits';
import { Button } from '../ui/Button';

/** The sheet rises over this long, then takes focus. */
const RISE_MS = 500;

export function ResultSheet(props: { n: number; mode: ResultMode; record: RoundRecord | null; onBack: () => void; onReplay: () => void }) {
  const { n, mode, record, onBack, onReplay } = props;
  const goal = useApp((s) => s.goal);
  const credits = useApp((s) => s.credits);
  const heading = useRef<HTMLHeadingElement>(null);
  const [shareNote, setShareNote] = useState<string | null>(null);
  // A round that earned something can be shared; practice rounds earn nothing.
  const share = mode !== 'practice' && record ? milestoneShareText(record.n, record.rewards) : null;
  const lines = resultLines(n, mode, record, goal, credits);

  // Keyboard and screen reader users land on "N zeros down" as the sheet arrives.
  useEffect(() => {
    const id = window.setTimeout(() => heading.current?.focus(), RISE_MS);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <section className="result" role="dialog" aria-modal="true" aria-labelledby="result-title">
      <p className="eyebrow">{sheetEyebrow(mode, n, goal)}</p>
      <h2 id="result-title" className="h2" ref={heading} tabIndex={-1}>
        <Em>{formatCount(n)}</Em> {n === 1 ? 'zero' : 'zeros'} down
      </h2>
      <div className="result-lines">
        {lines.map((l) => (
          <p key={l.text} className={l.news ? 'news' : undefined}>
            {l.text}
          </p>
        ))}
      </div>
      <div className="result-actions">
        <Button label="Back to base" onPress={onBack} className="primary" />
        <Button label="Replay" variant="ghost" onPress={onReplay} />
      </div>
      {share ? (
        <div className="share">
          <button
            type="button"
            className="link-btn"
            title="Your goal's wording isn't included."
            onClick={() => {
              void shareText(share).then((r) => setShareNote(r === 'copied' ? 'Copied. Paste it wherever you like.' : null));
            }}
          >
            Share this milestone
          </button>
          {shareNote ? (
            <p className="fine" role="status">
              {shareNote}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
