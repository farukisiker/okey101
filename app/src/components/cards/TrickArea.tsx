import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { colors, font } from '../../theme';
import { t } from '../../i18n';
import { CardView, cardHeight } from './CardView';
import type { BatakPlayerPublic, TrickCard } from './fakeTypes';

export interface TrickAreaProps {
  currentTrick: TrickCard[];
  players: BatakPlayerPublic[];
  mySeat: number;
  cardWidth: number;
  style?: ViewStyle;
}

interface SeatSlot {
  position: 'south' | 'west' | 'north' | 'east';
  seat: number;
}

/**
 * Batak 4-seat trick area in the center of the table.
 * Arranges the 4 cards played in current trick into compass positions
 * relative to the local player (South = me, North = partner/opposite, West = left, East = right).
 */
export function TrickArea({ currentTrick, players, mySeat, cardWidth, style }: TrickAreaProps) {
  const height = cardHeight(cardWidth);

  const slots: SeatSlot[] = [
    { position: 'south', seat: mySeat },
    { position: 'west', seat: (mySeat + 3) % 4 },
    { position: 'north', seat: (mySeat + 2) % 4 },
    { position: 'east', seat: (mySeat + 1) % 4 },
  ];

  const getPlayerName = (seat: number) => {
    return players.find((p) => p.seat === seat)?.name ?? t('cardsSeatFallback', { n: seat + 1 });
  };

  const getTrickCard = (seat: number) => {
    return currentTrick.find((tc) => tc.seat === seat)?.card ?? null;
  };

  const areaWidth = Math.round(cardWidth * 3.2);
  const areaHeight = Math.round(height * (cardWidth < 50 ? 1.4 : 1.75));

  return (
    <View style={[styles.container, { width: areaWidth, height: areaHeight }, style]}>
      {slots.map(({ position, seat }) => {
        const card = getTrickCard(seat);
        const name = getPlayerName(seat);

        let posStyle: ViewStyle;
        switch (position) {
          case 'north':
            posStyle = { top: 0, alignSelf: 'center' };
            break;
          case 'south':
            posStyle = { bottom: 0, alignSelf: 'center' };
            break;
          case 'west':
            posStyle = { left: 4, top: Math.round((areaHeight - height) / 2) };
            break;
          case 'east':
            posStyle = { right: 4, top: Math.round((areaHeight - height) / 2) };
            break;
        }

        return (
          <View key={position} style={[styles.cardSlot, posStyle, { width: cardWidth }]}>
            {card ? (
              <CardView card={card} width={cardWidth} />
            ) : (
              <View
                style={[
                  styles.placeholder,
                  {
                    width: cardWidth - 2,
                    height: height - 2,
                    borderRadius: Math.round(cardWidth * 0.12),
                  },
                ]}
              >
                <Text style={styles.placeholderDot}>·</Text>
              </View>
            )}
            <View style={styles.nameTag}>
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
    justifyContent: 'center',
  },
  placeholder: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(255, 255, 255, 0.2)',
    backgroundColor: 'rgba(0, 0, 0, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderDot: {
    color: 'rgba(255, 255, 255, 0.25)',
    fontSize: 24,
    fontWeight: '900',
  },
  nameTag: {
    marginTop: 2,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
    maxWidth: 90,
  },
  nameText: {
    color: colors.text,
    fontSize: font.small,
    fontWeight: '700',
    textAlign: 'center',
  },
});
