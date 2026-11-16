import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { colors, font } from '../../theme';
import { t } from '../../i18n';
import { CardBack, CardView, cardHeight } from './CardView';
import type { Card } from './fakeTypes';

export interface PistiCenterPileProps {
  topCard: Card | null;
  centerCount: number;
  /** The player can make a pişti now (see hasPistiChance); the badge shows nothing for a lone card otherwise. */
  pistiChance?: boolean;
  cardWidth: number;
  onPress?(): void;
  /** B12: badge to the right of the pile instead of under it (short windows). */
  badgeBeside?: boolean;
  style?: ViewStyle;
}

/**
 * Pişti middle pile on the felt:
 * - Shows face-up top card
 * - Stack effect if more than 1 card
 * - High-visibility pill badge: "Pişti fırsatı!" or "Yerde: N kart"
 */
export function PistiCenterPile({ topCard, centerCount, pistiChance = false, cardWidth, onPress, badgeBeside = false, style }: PistiCenterPileProps) {
  const height = cardHeight(cardWidth);
  const isPistiOpportunity = pistiChance && centerCount === 1;

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={[styles.container, badgeBeside && styles.containerBeside, style]}
      accessibilityRole="button"
      accessibilityLabel={
        isPistiOpportunity
          ? `${t('pistiChance')}, ${topCard ? topCard.suit + ' ' + topCard.rank : ''}`
          : centerCount === 1 ? undefined : t('pistiCenterCount', { n: centerCount })
      }
    >
      <View style={[styles.pileArea, { width: cardWidth + 14, height: height + 10 }]}>
        {/* Underneath stacked card back for 2+ cards */}
        {centerCount > 1 && (
          <View style={[styles.stackUnderlay, { width: cardWidth, height, transform: [{ rotate: '6deg' }, { translateX: 3 }] }]}>
            <CardBack width={cardWidth} />
          </View>
        )}

        {/* Top card face up, or placeholder */}
        {topCard ? (
          <View style={styles.topCardWrapper}>
            <CardView card={topCard} width={cardWidth} />
          </View>
        ) : (
          <View style={[styles.emptySlot, { width: cardWidth - 2, height: height - 2, borderRadius: Math.round(cardWidth * 0.12) }]}>
            <Text style={styles.emptySlotText}>♦</Text>
          </View>
        )}
      </View>

      {/* Pill badge showing count or Pişti opportunity */}
      {/* A lone card the player cannot pair shows no badge at all. */}
      {(centerCount !== 1 || isPistiOpportunity) && (
      <View
        style={[
          styles.badge,
          isPistiOpportunity && styles.badgePisti,
        ]}
      >
        <Text
          style={[
            styles.badgeText,
            isPistiOpportunity && styles.badgeTextPisti,
          ]}
          numberOfLines={1}
        >
          {centerCount === 0
            ? t('pistiCenterEmpty')
            : isPistiOpportunity
              ? t('pistiChance')
              : t('pistiCenterCount', { n: centerCount })}
        </Text>
      </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  containerBeside: { flexDirection: 'row', gap: 12 },
  pileArea: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  topCardWrapper: {
    zIndex: 2,
  },
  stackUnderlay: {
    position: 'absolute',
    zIndex: 1,
    opacity: 0.85,
  },
  emptySlot: {
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
    borderStyle: 'dashed',
    backgroundColor: 'rgba(0,0,0,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptySlotText: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 28,
  },
  badge: {
    backgroundColor: colors.panel,
    borderColor: 'rgba(169,194,182,0.4)',
    borderWidth: 1.5,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 4,
    minHeight: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgePisti: {
    backgroundColor: colors.ok,
    borderColor: '#ffffff',
    borderWidth: 2,
    shadowColor: colors.ok,
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 4,
  },
  badgeText: {
    color: colors.text,
    fontSize: font.body,
    fontWeight: '800',
  },
  badgeTextPisti: {
    color: '#07301f',
    fontWeight: '900',
  },
});
