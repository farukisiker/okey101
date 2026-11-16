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
 * Batak trump selection dialog (B11): a compact strip above the hand, no dimming backdrop, so the player can see
 * the cards while choosing. 4 suit buttons (>= 60 dp tall) with high-contrast symbol and name.
 */
export function TrumpDialog({ visible, winningBid, scale, reserveBottom = 0, onSelectTrump }: TrumpDialogProps) {
  if (!visible) return null;

  const s = Math.max(1, scale);
  const btnWidth = Math.round(124 * s);
  const btnHeight = Math.max(60, Math.round(60 * s));
  const textSize = Math.max(15, Math.round(font.body * Math.min(s, 1.2)));

  return (
    <View style={[styles.overlay, { bottom: reserveBottom }]} pointerEvents="box-none">
      <View style={styles.card}>
        <Text style={[styles.title, { fontSize: textSize }]} numberOfLines={1}>
          {`${t('batakSelectTrumpTitle')} · ${t('batakSelectTrumpSub', { n: winningBid })}`}
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
                <Text style={[styles.symbol, { color, fontSize: Math.round(34 * s) }]}>{symbol}</Text>
                <Text style={[styles.suitName, { color, fontSize: Math.max(15, Math.round(16 * s)) }]} numberOfLines={1}>
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
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 6,
    zIndex: 1000,
  },
  card: {
    backgroundColor: colors.feltLight,
    borderColor: colors.wood,
    borderWidth: 2,
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 10,
    alignItems: 'center',
    gap: 4,
    maxWidth: '98%',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 10,
  },
  title: {
    color: colors.accent,
    fontWeight: '800',
    textAlign: 'center',
  },
  suitRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  suitBtn: {
    backgroundColor: colors.tile,
    borderColor: colors.tileBorder,
    borderWidth: 2,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 6,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
  },
  symbol: {
    fontWeight: '900',
    includeFontPadding: false,
  },
  suitName: {
    fontWeight: '800',
  },
});
