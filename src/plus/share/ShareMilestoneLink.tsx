// Win Zero Plus's Share this milestone (SPEC 9): a picture of the round's zeros, in its theme, with
// the day and what the round earned, made on the phone. The text share stands in when the card
// can't be made or sent.
import { useFont } from '@shopify/react-native-skia';
import { useState } from 'react';

import type { ModeId } from '@/engine';
import { appStore, themeOf } from '@/store';
import type { RoundRewards } from '@/store/types';
import { fontAssets } from '@/theme/fonts';
import { THEME_LOOKS } from '@/theme/themes';
import { LinkButton } from '@/ui/Button';
import { APP_NAME } from '@/variant';

import { SHARE_CARD_COPY } from '../copy';
import { renderCard } from './render';
import { sendCard } from './send';
import { cardWords } from './words';

/** The card makes its own sizes from the typefaces; this only loads them. */
const FONT_LOAD_SIZE = 16;

export function ShareMilestoneLink(props: { n: number; rewards: RoundRewards; mode: ModeId; text: string }) {
  const display = useFont(fontAssets.Bungee_400Regular, FONT_LOAD_SIZE);
  const body = useFont(fontAssets.Barlow_600SemiBold, FONT_LOAD_SIZE);
  const mono = useFont(fontAssets.JetBrainsMono_600SemiBold, FONT_LOAD_SIZE);
  const [busy, setBusy] = useState(false);

  const share = async () => {
    if (busy) return;
    setBusy(true);
    let png: Uint8Array | null = null;
    try {
      const look = THEME_LOOKS[themeOf(appStore.getState())];
      if (display && body && mono) png = renderCard(props.n, look, { display, body, mono }, cardWords(props.n, props.rewards, props.mode, APP_NAME));
    } catch {
      png = null;
    }
    await sendCard(png, props.text);
    setBusy(false);
  };

  return <LinkButton label={SHARE_CARD_COPY.label} accessibilityHint={SHARE_CARD_COPY.hint} onPress={share} />;
}
