// Moving between the app's screens. The store names an answer's screen the way the phone app's
// routes are named ('/play' for the round); the website's round lives at /play/round.
import { useCallback } from 'react';
import { useNavigate } from 'react-router';

import type { PendingRoute } from '@/store/types';

export const ROUTES = {
  home: '/',
  setup: '/setup',
  round: '/round',
  notice: '/notice',
  settings: '/settings',
  howItWorks: '/how-it-works',
} as const;

/** The bonus round a Game credit paid for. */
export const BONUS_ROUND = `${ROUTES.round}?round=bonus`;

/** A goal's round. */
export function roundFor(goalId: string): string {
  return `${ROUTES.round}?goal=${encodeURIComponent(goalId)}`;
}

/** The screen an answer opens, for its goal, as a path in the website's app. */
export function pathForAnswer(route: PendingRoute): string {
  const path = route.path === '/play' ? ROUTES.round : ROUTES.notice;
  return `${path}?goal=${encodeURIComponent(route.goalId)}`;
}

/** Back to Home, replacing the current screen (a notice, a finished round) in the history. */
export function useGoHome(): () => void {
  const navigate = useNavigate();
  return useCallback(() => navigate(ROUTES.home, { replace: true }), [navigate]);
}
