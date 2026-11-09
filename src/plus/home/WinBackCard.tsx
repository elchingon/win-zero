// Win Zero Plus: the win-back round a comeback gave (SPEC 9), waiting on Home until it's played,
// once its welcome back has been closed (winBackWaiting).
import { router } from 'expo-router';
import { StyleSheet, Text } from 'react-native';

import { formatCount } from '@/lib/format';
import { useApp, winBackWaiting } from '@/store';
import { colors, fonts } from '@/theme/tokens';
import { Card, Lede } from '@/ui/bits';
import { Button } from '@/ui/Button';

import { WIN_BACK_COPY } from '../copy';

export function WinBackCard() {
  const winBack = useApp(winBackWaiting);
  if (!winBack) return null;
  return (
    <Card style={styles.card}>
      <Text style={styles.title}>{WIN_BACK_COPY.title(formatCount(winBack.n))}</Text>
      <Lede>{WIN_BACK_COPY.lede}</Lede>
      <Button label={WIN_BACK_COPY.play} onPress={() => router.push({ pathname: '/play', params: { round: 'winback' } })} />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { borderColor: colors.amber },
  title: { fontFamily: fonts.bodyBold, fontSize: 17, color: colors.fg },
});
