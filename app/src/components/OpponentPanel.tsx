import { StyleSheet, Text, View } from 'react-native';
import type { PublicPlayer, SeatInfo } from '@okey/shared';
import { colors, font } from '../theme';

interface Props {
  player: PublicPlayer;
  seatInfo: SeatInfo | null;
  total: number;
  active: boolean;
  width: number;
  height: number;
}

/** One opponent in the header strip: name (+ AÇTI) over "N taş · puan"; lit when it's their turn. */
export function OpponentPanel({ player, seatInfo, total, active, width, height }: Props) {
  const away = seatInfo && !seatInfo.connected;
  return (
    <View style={[styles.panel, { width, height }, active && styles.active]}>
      <View style={styles.nameRow}>
        <Text style={[styles.name, active && { color: colors.accent }]} numberOfLines={1}>
          {active ? '▶ ' : ''}
          {player.name}
        </Text>
        {player.opened && (
          <View style={styles.chip}>
            <Text style={styles.chipText}>AÇTI</Text>
          </View>
        )}
      </View>
      <Text style={styles.meta} numberOfLines={1}>
        {away ? 'bağlantı koptu' : `${player.handCount} taş · ${total}`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderRadius: 12,
    backgroundColor: colors.panel,
    borderWidth: 3,
    borderColor: 'transparent',
    paddingHorizontal: 8,
    justifyContent: 'center',
  },
  active: { borderColor: colors.accent, backgroundColor: colors.activePanel },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { color: colors.text, fontWeight: '800', fontSize: font.body, flexShrink: 1, lineHeight: 21 },
  chip: { backgroundColor: colors.ok, borderRadius: 4, paddingHorizontal: 4 },
  chipText: { color: colors.felt, fontSize: font.small, fontWeight: '800', lineHeight: 18 },
  meta: { color: colors.muted, fontSize: font.small, fontWeight: '600', lineHeight: 18 },
});
