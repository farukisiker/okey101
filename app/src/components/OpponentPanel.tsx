import { StyleSheet, Text, View } from 'react-native';
import type { OkeyInfo, PublicPlayer, SeatInfo } from '@okey/shared';
import { colors } from '../theme';
import { TileView } from './TileView';

interface Props {
  player: PublicPlayer;
  seatInfo: SeatInfo | null;
  total: number;
  active: boolean;
  okey: OkeyInfo;
  horizontal?: boolean;
  /** Show this player's last discard (not for the left player, whose pile sits by the rack). */
  showDiscard?: boolean;
}

export function OpponentPanel({ player, seatInfo, total, active, okey, horizontal, showDiscard = true }: Props) {
  const top = player.discards.at(-1);
  return (
    <View style={[styles.panel, horizontal && styles.horizontal, active && styles.active]}>
      <View style={{ alignItems: horizontal ? 'flex-start' : 'center' }}>
        <Text style={styles.name} numberOfLines={1}>
          {seatInfo?.isBot ? '🤖 ' : ''}
          {player.name}
          {seatInfo && !seatInfo.connected ? ' (koptu)' : ''}
        </Text>
        <Text style={styles.meta}>
          {player.handCount} taş · {total} puan
        </Text>
        {player.opened && <Text style={styles.opened}>AÇTI</Text>}
      </View>
      {showDiscard && top && <TileView tile={top} okey={okey} width={26} />}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center',
    gap: 4,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  horizontal: { flexDirection: 'row', gap: 10 },
  active: { borderColor: colors.accent },
  name: { color: colors.text, fontWeight: '800', fontSize: 13, maxWidth: 110 },
  meta: { color: colors.muted, fontSize: 11 },
  opened: { color: colors.ok, fontSize: 10, fontWeight: '900' },
});
