import { StyleSheet, Text, View } from 'react-native';
import type { TavlaView } from '@kahve/tavla';
import { colors, font } from '../../theme';
import { usedDice } from './boardMath';
import { Die } from './Die';
import { t } from '../../i18n';

export interface DicePanelProps {
  view: Pick<TavlaView, 'dice' | 'openingRoll' | 'remaining' | 'turnNumber' | 'players' | 'phase'>;
  size: number;
}

/**
 * The two big dice. Used dice are dimmed (by `remaining`); doubles show 4 small markers for the moves left.
 * The opening turn shows each seat's die with its name and "Büyük atan başlar".
 */
export function DicePanel({ view, size }: DicePanelProps) {
  const opening = view.turnNumber === 0;
  const faces = opening ? view.openingRoll : view.dice;
  const used = usedDice(view.dice, view.remaining);
  const double = !opening && view.dice[0] === view.dice[1] && view.dice[0] > 0;
  const nameOf = (seat: number) => view.players.find((p) => p.seat === seat)?.name ?? (seat === 0 ? t('tavlaWhite') : t('tavlaBlack'));
  const markers = Math.max(10, Math.round(size * 0.2));
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {[0, 1].map((i) => (
          <View key={i} style={styles.die}>
            <Die value={faces[i]} size={size} dim={used[i] && view.phase === 'playing'} rollKey={view.turnNumber} />
            {opening ? (
              <Text style={styles.name} numberOfLines={1}>{nameOf(i)}</Text>
            ) : null}
          </View>
        ))}
      </View>
      {opening ? <Text style={styles.caption} numberOfLines={2}>{t('tavlaOpeningRoll')}</Text> : null}
      {double ? (
        <View style={styles.markers} accessibilityLabel={String(view.remaining.length)}>
          {[0, 1, 2, 3].map((i) => (
            <View
              key={i}
              style={{
                width: markers,
                height: markers,
                borderRadius: markers / 2,
                borderWidth: 2,
                borderColor: colors.accent,
                backgroundColor: i < view.remaining.length ? colors.accent : 'transparent',
              }}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 6 },
  row: { flexDirection: 'row', gap: 18, alignItems: 'flex-start' },
  die: { alignItems: 'center', gap: 4 },
  name: { color: colors.text, fontSize: font.small, fontWeight: '800', maxWidth: 140 },
  caption: { color: colors.accent, fontSize: font.body, fontWeight: '900', textAlign: 'center' },
  markers: { flexDirection: 'row', gap: 8 },
});
