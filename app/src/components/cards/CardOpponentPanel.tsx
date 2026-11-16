import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { colors, font } from '../../theme';
import { t } from '../../i18n';

export interface CardOpponentPanelProps {
  name: string;
  active: boolean;
  handCount: number;
  /** Match total (not this hand's points). */
  totalScore?: number;
  /** Pişti partners mode: this player is the viewer's partner. */
  isPartner?: boolean;
  secondsLeft?: number | null;
  connected?: boolean;
  width?: number;
  height?: number;
  // Pişti specific
  capturedCount?: number;
  pistiCount?: number;
  // Batak specific
  tricksWon?: number;
  bid?: number | null;
  passed?: boolean;
  isDeclarer?: boolean;
  /** B12: single-line panel for short windows: name + the key stats (tricks or pişti, bid, total) at 15 pt. */
  compact?: boolean;
  style?: ViewStyle;
}

/**
 * Opponent summary panel in top bar for card games (Pişti / Batak).
 * High-contrast, large text (>= 15pt), turn indicator, and turn clock.
 */
export function CardOpponentPanel({
  name,
  active,
  handCount,
  totalScore,
  isPartner,
  secondsLeft,
  connected = true,
  width,
  height,
  capturedCount,
  pistiCount,
  tricksWon,
  bid,
  passed,
  isDeclarer,
  compact = false,
  style,
}: CardOpponentPanelProps) {
  // Construct info text lines
  const metaParts: string[] = [];

  if (!connected) {
    metaParts.push(t('disconnected'));
  } else if (compact) {
    // Short line: what decides the game (tricks / pişti, the bid) and the match total; hand size is visible anyway.
    if (pistiCount != null && pistiCount > 0) metaParts.push(t('pistiCount', { n: pistiCount }));
    if (tricksWon != null) metaParts.push(t('batakTricksWon', { n: tricksWon }));
    if (passed) metaParts.push(t('batakPassed'));
    else if (bid != null && bid > 0) metaParts.push(t('batakContractBid', { n: bid }));
    if (totalScore != null) metaParts.push(t('cardsTotal', { n: totalScore }));
  } else {
    metaParts.push(t('cardsCardsCount', { n: handCount }));

    if (capturedCount != null) {
      metaParts.push(t('pistiCapturedCount', { n: capturedCount }));
    }

    if (pistiCount != null && pistiCount > 0) {
      metaParts.push(t('pistiCount', { n: pistiCount }));
    }

    if (tricksWon != null) {
      metaParts.push(t('batakTricksWon', { n: tricksWon }));
    }

    if (passed) {
      metaParts.push(t('batakPassed'));
    } else if (bid != null && bid > 0) {
      metaParts.push(t('batakContractBid', { n: bid }));
    }

    if (totalScore != null) {
      metaParts.push(t('cardsTotal', { n: totalScore }));
    }
  }

  const metaText = metaParts.join(' · ');

  if (compact) {
    return (
      <View
        style={[styles.panel, styles.panelCompact, active && styles.activePanel, style]}
        accessibilityLabel={`${name}. ${metaText}`}
      >
        <Text style={[styles.name, styles.nameCompact, active && styles.activeText]} numberOfLines={1}>
          {active ? '▶ ' : ''}
          {name}
        </Text>
        {isPartner && (
          <View style={styles.partnerChip}>
            <Text style={styles.partnerChipText}>{t('partnerTag')}</Text>
          </View>
        )}
        {isDeclarer && (
          <View style={styles.declarerChip}>
            <Text style={styles.declarerChipText}>★</Text>
          </View>
        )}
        <Text style={styles.metaCompact} numberOfLines={1}>
          {secondsLeft != null && (
            <Text style={[styles.clock, secondsLeft <= 5 && styles.clockUrgent]}>{`⏱ ${secondsLeft}  `}</Text>
          )}
          {metaText}
        </Text>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.panel,
        width != null && { width },
        height != null && { height },
        active && styles.activePanel,
        style,
      ]}
    >
      <View style={styles.nameRow}>
        <Text style={[styles.name, active && styles.activeText]} numberOfLines={1}>
          {active ? '▶ ' : ''}
          {name}
        </Text>
        {isPartner && (
          <View style={styles.partnerChip}>
            <Text style={styles.partnerChipText}>{t('partnerTag')}</Text>
          </View>
        )}
        {isDeclarer && (
          <View style={styles.declarerChip}>
            <Text style={styles.declarerChipText}>★</Text>
          </View>
        )}
      </View>

      <Text style={styles.meta} numberOfLines={1}>
        {secondsLeft != null && (
          <Text style={[styles.clock, secondsLeft <= 5 && styles.clockUrgent]}>
            {`⏱ ${secondsLeft}  `}
          </Text>
        )}
        {metaText}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.panel,
    borderColor: 'rgba(169,194,182,0.4)',
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    justifyContent: 'center',
    minWidth: 130,
    minHeight: 46,
  },
  panelCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
    minWidth: 0,
    minHeight: 0,
    height: 32,
    paddingVertical: 0,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  nameCompact: { flexShrink: 2, fontSize: font.small + 1 },
  metaCompact: { color: colors.muted, fontSize: font.small, fontWeight: '700', flexShrink: 1 },
  activePanel: {
    backgroundColor: colors.activePanel,
    borderColor: colors.accent,
    borderWidth: 2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  name: {
    color: colors.text,
    fontSize: font.body,
    fontWeight: '800',
    flexShrink: 1,
  },
  activeText: {
    color: colors.accent,
  },
  declarerChip: {
    backgroundColor: colors.accent,
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  declarerChipText: {
    color: '#2b1d00',
    fontSize: font.small,
    fontWeight: '900',
  },
  partnerChip: {
    backgroundColor: colors.ok,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  partnerChipText: {
    color: '#07301f',
    fontSize: 15,
    fontWeight: '900',
  },
  meta: {
    color: colors.muted,
    fontSize: font.small,
    fontWeight: '600',
    marginTop: 1,
  },
  clock: {
    color: colors.accent,
    fontWeight: '800',
  },
  clockUrgent: {
    color: colors.danger,
  },
});
