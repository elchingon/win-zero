// Settings › Games (SPEC 9): the game every round plays in, with its hint and the power-up the
// arsenal's reach gives it now.
import { View } from 'react-native';

import { availableModes, equippedWeapon, modeTier } from '@/engine';
import { appStore, arsenalBestOf, gameModeOf, useApp } from '@/store';
import { Eyebrow, Fine, shared } from '@/ui/bits';
import { MODE_COPY } from '@/ui/copy/modes';

import { GAMES_COPY } from '../copy';
import { ChoiceRow } from '../ui/ChoiceRow';

export function GamesSection() {
  const best = useApp(arsenalBestOf);
  const pick = useApp((s) => s.weapon);
  const modesEnabled = useApp((s) => s.limits.modesEnabled);
  const mode = useApp(gameModeOf);
  const weapon = equippedWeapon(pick, best);
  return (
    <View style={shared.section}>
      <Eyebrow header>{GAMES_COPY.title}</Eyebrow>
      <Fine>{GAMES_COPY.lede}</Fine>
      <View style={shared.list} accessibilityRole="radiogroup">
        {availableModes(best, { modesEnabled }).map((m) => (
          <ChoiceRow
            key={m.id}
            label={m.name}
            detail={`${MODE_COPY[m.id].hint}. ${MODE_COPY[m.id].tier}: ${modeTier(m.id, weapon.id)}`}
            checked={m.id === mode}
            accessibilityHint={GAMES_COPY.optionHint}
            onPress={() => appStore.getState().setGameMode(m.id)}
          />
        ))}
      </View>
    </View>
  );
}
