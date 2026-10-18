// Reset / Shielded / Slipping: what a Not today, or a run of missed days, did to the streak.
// Shown once. The copy is shared with the phone app: supportive and plain, because some people
// here are working on sobriety.
import { useEffect, useState } from 'react';
import { Navigate } from 'react-router';

import { pendingWindow } from '@/engine';
import { UNDO_MS_SCREEN_READER } from '@/store/createAppStore';
import { slotById } from '@/store/select';
import { colors } from '@/theme/tokens';
import { copyFor, noticeColors, UNDONE } from '@/ui/copy/notice';
import { SUPPORT_LINE } from '@/ui/copy/support';

import { ROUTES, useGoHome } from '../nav';
import { announce } from '../platform/announce';
import { appStore, useApp } from '../store';
import { Em, Eyebrow, Lede } from '../ui/bits';
import { Button } from '../ui/Button';
import { NoticeZero } from '../ui/NoticeZero';
import { Screen } from '../ui/Screen';

const toneOf = (hex: string) => (hex === colors.flare ? 'flare' : hex === colors.teal ? 'teal' : 'amber');

export function Notice() {
  // Snapshot it, and mark it shown: it appears once, and the store may move on while it's up.
  const [pending] = useState(() => appStore.getState().nextNotice());
  const goal = useApp((s) => (pending ? (slotById(s, pending.goalId)?.goal ?? null) : null));
  const route = useApp((s) => s.route);
  const undo = useApp((s) => s.undo);
  const goHome = useGoHome();
  const [, setTick] = useState(0);

  useEffect(() => {
    if (pending) appStore.getState().noticeShown(pending);
  }, [pending]);

  // A Not today shown here can be taken back for a few seconds, in case it was a mis-tap. A page
  // can't tell whether a screen reader is on, so everyone gets the screen reader's longer window.
  const undoEndsAt = pending?.source === 'answer' && undo?.notice === pending.notice ? undo.at + UNDO_MS_SCREEN_READER : null;
  const canUndo = undoEndsAt !== null && appStore.getState().now().getTime() < undoEndsAt;
  useEffect(() => {
    if (undoEndsAt === null) return;
    const id = window.setTimeout(() => setTick((t) => t + 1), Math.max(0, undoEndsAt - appStore.getState().now().getTime()));
    return () => window.clearTimeout(id);
  }, [undoEndsAt]);

  if (!pending || !goal) return <Navigate to={ROUTES.home} replace />;

  const { notice } = pending;
  const copy = copyFor(notice);
  // An answer can land while this is up (another tab), so the way on is read live.
  const canAnswer = pendingWindow(goal, appStore.getState().now()) !== null;
  const next = route?.path === '/play' ? 'Play your round' : canAnswer && notice.kind !== 'noted' ? 'Check in now' : 'Got it';
  const takeBack = () => {
    // Turned down (the check-in just closed, say): the button goes, as the store drops the undo.
    if (!appStore.getState().undoNotToday(UNDO_MS_SCREEN_READER)) return;
    announce(UNDONE);
    goHome();
  };

  return (
    <Screen centered>
      <NoticeZero tone={toneOf(noticeColors[notice.kind])} motion={copy.motion} />
      <div className="block">
        <Eyebrow>{copy.eyebrow}</Eyebrow>
        <h1 className="h2">
          {copy.title[0]}
          <Em tone={notice.kind === 'shielded' ? 'teal' : 'amber'}>{copy.title[1]}</Em>
        </h1>
      </div>
      <div className="block">
        {copy.body.map((line) => (
          <Lede key={line}>{line}</Lede>
        ))}
      </div>
      <div className="block">
        <Button label={next} onPress={goHome} />
        {canUndo ? <Button variant="ghost" label="Undo Not today" hint="Puts the check-in back so you can answer again" onPress={takeBack} /> : null}
        {copy.support ? (
          <p className="support-line">
            Need support? {SUPPORT_LINE.name}: <a href={SUPPORT_LINE.tel}>{SUPPORT_LINE.display}</a>. {SUPPORT_LINE.detail}{' '}
            {SUPPORT_LINE.text}
          </p>
        ) : null}
      </div>
    </Screen>
  );
}
