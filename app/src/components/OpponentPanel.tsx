import { StyleSheet, Text, View } from 'react-native';
import type { OkeyInfo, PublicPlayer, SeatInfo } from '@okey/shared';
import { colors, font } from '../theme';
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
        <Text style={[styles.name, active && { color: colors.accent }]} numberOfLines={1}>
          {active ? '▶ ' : ''}
          {player.name}
          {seatInfo && !seatInfo.connected ? ' (koptu)' : ''}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {player.opened ? 'AÇTI · ' : ''}
          {player.handCount} taş
          {total !== 0 ? ` · ${total}` : ''}
        </Text>
      </View>
      {showDiscard && top && <TileView tile={top} okey={okey} width={30} />}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center',
    gap: 2,
    borderWidth: 4,
    borderColor: 'transparent',
    alignSelf: 'stretch',
  },
  horizontal: { flexDirection: 'row', gap: 12, alignSelf: 'center' },
  active: { borderColor: colors.accent, backgroundColor: 'rgba(242,182,50,0.15)' },
  name: { color: colors.text, fontWeight: '800', fontSize: font.body },
  meta: { color: colors.muted, fontSize: font.small },
});
