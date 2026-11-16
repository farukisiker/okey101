import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { colors, font } from '../../theme';
import { t } from '../../i18n';
import { CardView } from './CardView';
import { type TrickPosition, fitTrickLayout } from './trickLayout';
import type { BatakPlayerPublic, TrickCard } from '@kahve/catalog';

export interface TrickAreaProps {
  currentTrick: TrickCard[];
  players: Pick<BatakPlayerPublic, 'seat' | 'name'>[];
  mySeat: number;
  /** The card width the screen would like; the cross shrinks it when the box is too small. */
  cardWidth: number;
  /** Room the cross has to fit in (layout.trickBoxWidth / trickBoxHeight). */
  boxWidth: number;
  boxHeight: number;
  style?: ViewStyle;
}

/**
 * Batak 4-seat trick area in the center of the table: a cross, north on top, me (south) at the bottom,
 * west left and east right. The slot rectangles come from trickLayout and never overlap.
 */
export function TrickArea({ currentTrick, players, mySeat, cardWidth, boxWidth, boxHeight, style }: TrickAreaProps) {
  const lay = fitTrickLayout(boxWidth, boxHeight, cardWidth);
  const cw = lay.cardWidth;
  const height = lay.cardHeight;

  const slots: { position: TrickPosition; seat: number }[] = [
    { position: 'south', seat: mySeat },
    { position: 'west', seat: (mySeat + 3) % 4 },
    { position: 'north', seat: (mySeat + 2) % 4 },
    { position: 'east', seat: (mySeat + 1) % 4 },
  ];

  const getPlayerName = (seat: number) => {
    if (seat === mySeat) return t('you');
    return players.find((p) => p.seat === seat)?.name ?? t('cardsSeatFallback', { n: seat + 1 });
  };

  const getTrickCard = (seat: number) => {
    return currentTrick.find((tc) => tc.seat === seat)?.card ?? null;
  };

  return (
    <View style={[styles.container, { width: lay.width, height: lay.height }, style]}>
      {slots.map(({ position, seat }) => {
        const card = getTrickCard(seat);
        const name = getPlayerName(seat);
        const r = lay.slots[position];

        return (
          <View
            key={position}
            style={[styles.cardSlot, { left: r.x, top: r.y, width: r.w, height: r.h }]}
          >
            {card ? (
              <CardView card={card} width={cw} />
            ) : (
              <View
                style={[
                  styles.placeholder,
                  {
                    width: cw - 2,
                    height: height - 2,
                    borderRadius: Math.round(cw * 0.12),
                  },
                ]}
              >
                <Text style={styles.placeholderDot}>·</Text>
              </View>
            )}
            <View
              style={[
                styles.nameTag,
                lay.tagMode === 'overlay' ? styles.nameTagOverlay : { height: lay.tagHeight - 2 },
              ]}
            >
              <Text style={styles.nameText} numberOfLines={1}>
                {name}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  cardSlot: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  placeholder: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(255, 255, 255, 0.2)',
    backgroundColor: 'rgba(0, 0, 0, 0.12)',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  placeholderDot: {
    color: 'rgba(255, 255, 255, 0.25)',
    fontSize: 24,
    fontWeight: '900',
  },
  nameTag: {
    marginTop: 2,
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
    maxWidth: 90,
  },
  nameTagOverlay: {
    position: 'absolute',
    bottom: 0,
    marginTop: 0,
  },
  nameText: {
    color: colors.text,
    fontSize: font.small,
    fontWeight: '700',
    textAlign: 'center',
  },
});
