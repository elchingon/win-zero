// The sections Win Zero Plus adds between Settings' toggles and About: Games, Themes, App icon.
import { FEATURES } from '@/variant';

import { AppIconSection } from './AppIconSection';
import { GamesSection } from './GamesSection';
import { ThemesSection } from './ThemesSection';

export function PlusSections() {
  return (
    <>
      {FEATURES.extraModes ? <GamesSection /> : null}
      {FEATURES.themes ? <ThemesSection /> : null}
      {FEATURES.altIcons ? <AppIconSection /> : null}
    </>
  );
}
