import { StyleSheet, Text, View } from 'react-native';
import { colors, tileColors } from '../../theme';
import { t } from '../../i18n';
import { type CardBackProps, type CardViewProps, rankLabel, suitColor, suitSymbol } from './fakeTypes';

export const cardHeight = (width: number) => Math.round(width * 1.38);

/**
 * High-contrast, SVG-free playing card component for 60+ ergonomics.
 * Rendered using standard View, Text and Unicode suit symbols (♠ ♥ ♦ ♣).
 */
export function CardView({ card, width, selected, disabled, highlighted, badgeText, style }: CardViewProps) {
  const height = cardHeight(width);
  const color = card.suit === 'H' || card.suit === 'D' ? tileColors.red : tileColors.black;
  const symbol = suitSymbol(card.suit);
  const rank = rankLabel(card.rank);
  const isTen = card.rank === 10;
  const borderRadius = Math.round(width * 0.12);

  const cornerRankSize = Math.max(16, Math.round(width * (isTen ? 0.28 : 0.32)));
  const cornerSymbolSize = Math.max(15, Math.round(width * 0.2));
  const mainSymbolSize = Math.max(26, Math.round(width * 0.54));

  return (
    <View
      style={[
        styles.card,
        {
          width: width - 2,
          height: height - 2,
          borderRadius,
        },
        selected && styles.selected,
        highlighted && styles.highlighted,
        disabled && styles.disabled,
        style,
      ]}
      accessibilityLabel={`${symbol} ${rank}${selected ? t('cardsSelectedA11y') : ''}`}
    >
      {/* Top-left corner: Rank and small suit symbol */}
      <View style={[styles.corner, { top: Math.max(2, width * 0.05), left: Math.max(3, width * 0.08) }]}>
        <Text
          style={[
            styles.rankText,
            {
              color,
              fontSize: cornerRankSize,
              letterSpacing: isTen ? -1.5 : 0,
            },
          ]}
        >
          {rank}
        </Text>
        <Text
          style={[
            styles.cornerSymbol,
            {
              color,
              fontSize: cornerSymbolSize,
            },
          ]}
        >
          {symbol}
        </Text>
      </View>

      {/* Center / Bottom-Right: Giant suit symbol */}
      <View
        style={[
          styles.mainSymbolContainer,
          {
            bottom: Math.max(2, width * 0.05),
            right: Math.max(3, width * 0.08),
          },
        ]}
      >
        <Text
          style={[
            styles.mainSymbol,
            {
              color,
              fontSize: mainSymbolSize,
              lineHeight: Math.round(mainSymbolSize * 1.05),
            },
          ]}
        >
          {symbol}
        </Text>
      </View>

      {/* Optional badge, e.g. "PİŞTİ" or "+10" */}
      {badgeText ? (
        <View style={styles.badge}>
          <Text style={[styles.badgeText, { fontSize: Math.max(15, Math.round(width * 0.22)) }]}>
            {badgeText}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/**
 * Card back component with coffee burgundy pattern and gold border.
 */
export function CardBack({ width, count, style }: CardBackProps) {
  const height = cardHeight(width);
  const borderRadius = Math.round(width * 0.12);
  const innerMargin = Math.max(3, Math.round(width * 0.07));

  return (
    <View
      style={[
        styles.card,
        styles.backOuter,
        {
          width: width - 2,
          height: height - 2,
          borderRadius,
        },
        style,
      ]}
    >
      <View style={[styles.backInner, { margin: innerMargin, borderRadius: Math.max(3, borderRadius - innerMargin) }]}>
        {count != null ? (
          <View style={styles.countBadge}>
            <Text style={[styles.countText, { fontSize: Math.max(16, Math.round(width * 0.28)) }]}>
              {count}
            </Text>
          </View>
        ) : (
          <Text style={[styles.backPattern, { fontSize: Math.max(20, Math.round(width * 0.4)) }]}>
            ♦
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    margin: 1,
    backgroundColor: colors.tile,
    borderColor: colors.tileBorder,
    borderWidth: 1.5,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 2.5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  corner: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  rankText: {
    fontWeight: '900',
    includeFontPadding: false,
    textAlign: 'center',
  },
  cornerSymbol: {
    marginTop: -5,
    includeFontPadding: false,
    textAlign: 'center',
  },
  mainSymbolContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainSymbol: {
    fontWeight: '900',
    opacity: 0.9,
    includeFontPadding: false,
  },
  selected: {
    borderColor: colors.accent,
    borderWidth: 4,
    shadowColor: colors.accent,
    shadowOpacity: 0.9,
    shadowRadius: 8,
    transform: [{ translateY: -14 }, { scale: 1.08 }],
    zIndex: 25,
    elevation: 8,
  },
  disabled: {
    opacity: 0.42,
    backgroundColor: '#e6dec8',
  },
  highlighted: {
    borderColor: colors.ok,
    borderWidth: 3,
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: colors.ok,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 6,
    zIndex: 10,
  },
  badgeText: {
    color: '#07301f',
    fontWeight: '900',
  },
  backOuter: {
    backgroundColor: colors.tile,
    borderColor: colors.tileBorder,
  },
  backInner: {
    flex: 1,
    backgroundColor: '#7a1f2b',
    borderColor: colors.accent,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backPattern: {
    color: colors.accent,
    fontWeight: '900',
    opacity: 0.85,
  },
  countBadge: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  countText: {
    color: colors.text,
    fontWeight: '900',
  },
});
