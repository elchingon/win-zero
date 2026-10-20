// Before a round not yet played (a day's or a bonus round), ask which game to play it in, then start
// the round. The pick is saved, as in Settings › Games, so the next round starts on it. A replay
// keeps its game and isn't asked; leaving and coming back to a round not yet played asks again.
import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { availableModes, equippedWeapon, type ModeId } from '@/engine';
import { appStore, arsenalBestOf, gameModeOf, useApp } from '@/store';
import { colors } from '@/theme/tokens';

import { ModePicker } from './ModePicker';

export function ModeGate({ fresh, children }: { fresh: boolean; children: ReactNode }) {
  const best = useApp(arsenalBestOf);
  const modesEnabled = useApp((s) => s.limits.modesEnabled);
  const weapon = useApp((s) => equippedWeapon(s.weapon, best).id);
  const [current] = useState(() => gameModeOf(appStore.getState()));
  const [asked, setAsked] = useState(!fresh);
  const modes = availableModes(best, { modesEnabled });
  if (asked || modes.length < 2) return children;

  const pick = (id: ModeId) => {
    if (id !== current) appStore.getState().setGameMode(id);
    setAsked(true);
  };
  return (
    <View style={styles.root}>
      <ModePicker modes={modes} current={current} weapon={weapon} onPick={pick} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
});
