// The app's screens under /play, as the phone app's routes. The round is loaded on demand, so
// Home opens without the game code.
import { createBrowserRouter, Navigate, useRouteError } from 'react-router';

import { ROUTES } from './nav';
import { Home } from './screens/Home';
import { HowItWorks } from './screens/HowItWorks';
import { Layout } from './screens/Layout';
import { Notice } from './screens/Notice';
import { Settings } from './screens/Settings';
import { Setup } from './screens/Setup';
import { CrashScreen } from './ui/CrashScreen';

/** A screen crashed. Everything is saved as it changes, so nothing is lost. */
function ScreenError() {
  const error = useRouteError();
  return (
    <CrashScreen
      eyebrow="Something went wrong"
      title={['This screen hit ', 'a snag.']}
      body={['Your goal, streak and history are saved. Nothing is lost.']}
      action="Back to base"
      onAction={() => window.location.assign('/play')}
      error={error}
    />
  );
}

/** The round crashed. The Yes and its rewards were saved when it was answered. */
function RoundError() {
  const error = useRouteError();
  return (
    <CrashScreen
      eyebrow="Round stopped"
      title={['The round hit ', 'a snag.']}
      body={['Your Yes counts, and its rewards are already banked. Nothing is lost.']}
      action="Back to base"
      onAction={() => window.location.assign('/play')}
      error={error}
    />
  );
}

export const router = createBrowserRouter(
  [
    {
      path: ROUTES.home,
      element: <Layout />,
      errorElement: <ScreenError />,
      children: [
        { index: true, element: <Home /> },
        { path: ROUTES.setup.slice(1), element: <Setup /> },
        {
          path: ROUTES.round.slice(1),
          lazy: async () => ({ Component: (await import('./screens/Round')).Round }),
          errorElement: <RoundError />,
        },
        { path: ROUTES.notice.slice(1), element: <Notice /> },
        { path: ROUTES.settings.slice(1), element: <Settings /> },
        { path: ROUTES.howItWorks.slice(1), element: <HowItWorks /> },
        { path: '*', element: <Navigate to={ROUTES.home} replace /> },
      ],
    },
  ],
  { basename: '/play' },
);
