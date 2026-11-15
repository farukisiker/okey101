import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { colors, font } from '../../theme';
import { t } from '../../i18n';

export interface CardOpponentPanelProps {
  name: string;
  active: boolean;
  handCount: number;
  totalScore?: number;
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
  style,
}: CardOpponentPanelProps) {
  // Construct info text lines
  const metaParts: string[] = [];

  if (!connected) {
    metaParts.push(t('disconnected'));
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
      metaParts.push(t('cardsPoints', { n: totalScore }));
    }
  }

  const metaText = metaParts.join(' · ');

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
