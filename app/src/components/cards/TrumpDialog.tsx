import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, font } from '../../theme';
import { t } from '../../i18n';
import { type Suit, type TrumpDialogProps, suitColor, suitSymbol } from './fakeTypes';

export type { TrumpDialogProps };

interface SuitOption {
  suit: Suit;
  nameKey: 'suitSpades' | 'suitHearts' | 'suitDiamonds' | 'suitClubs';
}

const SUITS: SuitOption[] = [
  { suit: 'S', nameKey: 'suitSpades' },
  { suit: 'H', nameKey: 'suitHearts' },
  { suit: 'D', nameKey: 'suitDiamonds' },
  { suit: 'C', nameKey: 'suitClubs' },
];

/**
 * Batak trump selection dialog:
 * 4 giant suit buttons with high-contrast symbols and names.
 */
export function TrumpDialog({ visible, winningBid, scale, onSelectTrump }: TrumpDialogProps) {
  if (!visible) return null;

  const s = Math.max(1, scale);
  const cardWidth = Math.min(620, Math.round(520 * s));
  const btnWidth = Math.round(108 * s);
  const btnHeight = Math.round(110 * s);

  return (
    <View style={styles.overlay}>
      <View style={[styles.card, { width: cardWidth }]}>
        <Text style={[styles.title, { fontSize: Math.round(font.title * s * 0.9) }]}>
          {t('batakSelectTrumpTitle')}
        </Text>

        <Text style={[styles.subtitle, { fontSize: Math.round(font.body * s) }]}>
          {t('batakSelectTrumpSub', { n: winningBid })}
        </Text>

        <View style={styles.suitRow}>
          {SUITS.map(({ suit, nameKey }) => {
            const symbol = suitSymbol(suit);
            const color = suitColor(suit);
            const name = t(nameKey);

            return (
              <Pressable
                key={suit}
                onPress={() => onSelectTrump(suit)}
                style={({ pressed }) => [
                  styles.suitBtn,
                  {
                    width: btnWidth,
                    height: btnHeight,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel={`${symbol} ${name}`}
              >
                <Text style={[styles.symbol, { color, fontSize: Math.round(44 * s) }]}>
                  {symbol}
                </Text>
                <Text style={[styles.suitName, { color, fontSize: Math.round(18 * s) }]}>
                  {name}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  card: {
    backgroundColor: colors.feltLight,
    borderColor: colors.wood,
    borderWidth: 3,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    gap: 16,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 10,
  },
  title: {
    color: colors.text,
    fontWeight: '900',
    textAlign: 'center',
  },
  subtitle: {
    color: colors.accent,
    fontWeight: '700',
    textAlign: 'center',
  },
  suitRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 14,
    marginTop: 8,
  },
  suitBtn: {
    backgroundColor: colors.tile,
    borderColor: colors.tileBorder,
    borderWidth: 2,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 4,
  },
  symbol: {
    fontWeight: '900',
    includeFontPadding: false,
  },
  suitName: {
    fontWeight: '800',
    marginTop: 4,
  },
});
