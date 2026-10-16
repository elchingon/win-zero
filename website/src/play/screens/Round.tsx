// The round. (A stand-in until the canvas lands: it marks the round played and goes back.)
import { Navigate } from 'react-router';

import { ROUTES, useGoHome } from '../nav';
import { appStore, useApp } from '../store';
import { Button } from '../ui/Button';
import { Screen } from '../ui/Screen';

export function Round() {
  const round = useApp((s) => s.round);
  const goHome = useGoHome();
  if (!round) return <Navigate to={ROUTES.home} replace />;
  return (
    <Screen centered>
      <h1 className="h2">Day {round.n}</h1>
      <Button
        label="Finish round"
        onPress={() => {
          appStore.getState().finishRound();
          goHome();
        }}
      />
    </Screen>
  );
}
