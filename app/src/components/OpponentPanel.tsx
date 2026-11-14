import { StyleSheet, Text, View } from 'react-native';
import { type OkeyInfo, type PublicPlayer, type SeatInfo, visibleDiscard } from '@okey/shared';
import { colors, font } from '../theme';
import { t } from '../i18n';
import { TileView } from './TileView';

interface Props {
  player: PublicPlayer;
  seatInfo: SeatInfo | null;
  total: number;
  /** Düz okey: the total is points left ("20 puan"); hand counts are always 14 there. */
  unit?: string;
  active: boolean;
  width: number;
  height: number;
  /** Show the top of this player's discard pile at the panel's right edge. */
  showDiscard?: boolean;
  okey?: OkeyInfo;
  /** Their turn clock (people only); red in the last five seconds. */
  secondsLeft?: number | null;
}

/** One opponent in the header strip: name (+ AÇTI) over "N taş · puan"; lit when it's their turn. */
export function OpponentPanel({ player, seatInfo, total, unit, active, width, height, showDiscard, okey, secondsLeft }: Props) {
  const away = seatInfo && !seatInfo.connected;
  const top = showDiscard ? visibleDiscard(player) : undefined;
  // Fits inside the panel's 3pt border with a little air above and below.
  const tileW = Math.floor((height - 10) / 1.38);
  return (
    <View style={[styles.panel, { width, height }, active && styles.active]}>
      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={[styles.name, active && { color: colors.accent }]} numberOfLines={1}>
            {active ? '▶ ' : ''}
            {player.name}
          </Text>
          {player.opened && (
            <View style={styles.chip}>
              <Text style={styles.chipText}>{t('openedChip')}</Text>
            </View>
          )}
        </View>
        <Text style={styles.meta} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
          {secondsLeft != null && (
            <Text style={[styles.clock, secondsLeft <= 5 && styles.clockUrgent]}>{`⏱ ${secondsLeft}  `}</Text>
          )}
          {away ? t('disconnected') : unit ? t('pointsN', { n: total }) : `${t('handTiles', { n: player.handCount })} · ${total}`}
        </Text>
      </View>
      {showDiscard && (
        <View style={[styles.discard, { width: tileW }]}>
          {top ? (
            <TileView tile={top} okey={okey} width={tileW} />
          ) : (
            <View style={[styles.emptyDiscard, { width: tileW - 2, height: Math.round(tileW * 1.38) - 2 }]} />
          )}
        </View>
      )}
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  info: { flex: 1, justifyContent: 'center', minWidth: 0 },
  discard: { alignItems: 'center', justifyContent: 'center' },
  emptyDiscard: { borderRadius: 4, borderWidth: 1, borderColor: colors.muted, borderStyle: 'dashed', opacity: 0.5 },
  active: { borderColor: colors.accent, backgroundColor: colors.activePanel },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { color: colors.text, fontWeight: '800', fontSize: font.body, flexShrink: 1, lineHeight: 21 },
  chip: { backgroundColor: colors.ok, borderRadius: 4, paddingHorizontal: 4 },
  chipText: { color: colors.felt, fontSize: font.small, fontWeight: '800', lineHeight: 18 },
  clock: { color: colors.accent, fontWeight: '900' },
  clockUrgent: { color: colors.danger },
  meta: { color: colors.muted, fontSize: font.small, fontWeight: '600', lineHeight: 18 },
});
