import { Pressable, StyleSheet, View } from 'react-native';
import { colors } from '../../theme';
import { CardView, cardHeight } from './CardView';
import type { HandProps } from './fakeTypes';

/**
 * Hand component representing the cards held by the player.
 * Ergonomics (60+):
 * - Two-step tap: 1st tap selects and raises the card; 2nd tap plays it.
 * - Big touch targets (>= 56 dp).
 * - Non-playable cards are dimmed when playableCardIds is provided.
 */
export function Hand({
  cards,
  cardWidth,
  cardStep,
  selectedCardId,
  canPlay,
  playableCardIds,
  dimUnplayable = true,
  highlightedCardIds,
  onSelectCard,
  onPlayCard,
  bleedLeft = 0,
  bleedRight = 0,
  bleedBottom = 0,
}: HandProps) {
  const overlap = Math.max(0, cardWidth - cardStep);
  const height = cardHeight(cardWidth);

  const handleCardPress = (cardId: number, isPlayable: boolean) => {
    if (!canPlay || !isPlayable) {
      return;
    }

    if (selectedCardId === cardId) {
      onPlayCard(cardId);
    } else {
      onSelectCard(cardId);
    }
  };

  return (
    <View
      style={[
        styles.tray,
        {
          paddingLeft: bleedLeft + 8,
          paddingRight: bleedRight + 8,
          paddingBottom: bleedBottom + 4,
          minHeight: height + 16,
        },
      ]}
    >
      <View style={styles.cardsRow}>
        {cards.map((card, index) => {
          const isSelected = selectedCardId === card.id;
          const isPlayable = playableCardIds ? playableCardIds.includes(card.id) : true;
          const isHighlighted = highlightedCardIds ? highlightedCardIds.includes(card.id) : false;

          return (
            <Pressable
              key={card.id}
              onPress={() => handleCardPress(card.id, isPlayable)}
              style={({ pressed }) => [
                styles.cardWrapper,
                {
                  width: cardWidth,
                  height,
                  marginLeft: index === 0 ? 0 : -overlap,
                  zIndex: isSelected ? 50 : index + 1,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
              hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
              accessibilityRole="button"
            >
              <CardView
                card={card}
                width={cardWidth}
                selected={isSelected}
                disabled={dimUnplayable && !isPlayable}
                highlighted={isHighlighted}
              />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tray: {
    backgroundColor: 'rgba(7, 48, 31, 0.92)',
    borderTopWidth: 2,
    borderTopColor: colors.wood,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 6,
  },
  cardsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  cardWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
