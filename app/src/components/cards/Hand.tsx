import { useCallback, useRef, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { scheduleOnRN, scheduleOnUI } from 'react-native-worklets';
import { colors } from '../../theme';
import { CardView, cardHeight } from './CardView';
import type { CardDropTarget } from './CardDropZone';
import {
  CARD_DRAG_LIFT,
  CARD_DRAG_SCALE,
  CARD_DRAG_START_OTHER,
  CARD_DRAG_START_UP,
  type DropRect,
  canDragCard,
  heldCardCentre,
  hitDropZone,
} from './cardDrag';
import type { HandProps } from './fakeTypes';

/**
 * Hand component representing the cards held by the player.
 * Ergonomics (60+):
 * - Two-step tap: 1st tap selects and raises the card; 2nd tap plays it.
 * - Big touch targets (>= 56 dp).
 * - Non-playable cards are dimmed when playableCardIds is provided.
 * - In addition to the taps, a playable card can be dragged onto `dropTarget` (the table) to play it.
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
  dropTarget,
  onDropCard,
  bleedLeft = 0,
  bleedRight = 0,
  bleedBottom = 0,
}: HandProps) {
  const overlap = Math.max(0, cardWidth - cardStep);
  const height = cardHeight(cardWidth);
  // Overlapped hands (Batak) are drawn as a gentle fan, like cards held in the hand.
  const fan = overlap > 0 && cards.length > 4 ? fanGeometry(cards.length, height) : null;

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
            <HandCard
              key={card.id}
              cardId={card.id}
              width={cardWidth}
              height={height}
              marginLeft={index === 0 ? 0 : -overlap}
              // In a held (fanned) hand the raised card stays in its place in the stack, so it never hides its neighbour.
              zIndex={isSelected && !fan ? 50 : index + 1}
              fan={fan ? fan.at(index) : null}
              draggable={canDragCard(card.id, canPlay, playableCardIds, !!(dropTarget && onDropCard))}
              dropTarget={dropTarget}
              onPress={() => handleCardPress(card.id, isPlayable)}
              onDrop={onDropCard}
            >
              <CardView
                card={card}
                width={cardWidth}
                selected={isSelected}
                disabled={dimUnplayable && !isPlayable}
                highlighted={isHighlighted}
              />
            </HandCard>
          );
        })}
      </View>
    </View>
  );
}

/** Rise (dp, negative is up) and tilt (degrees) of one card in a fanned hand. */
export interface FanPose {
  rise: number;
  deg: number;
}

/**
 * Fan of `n` overlapped cards: small rotation outwards and a slight arc. The middle cards rise (instead of the edges
 * dropping) so the hand row keeps the height the layout budgeted for it.
 */
export function fanGeometry(n: number, cardH: number) {
  const mid = (n - 1) / 2;
  const degPerCard = Math.min(2.5, 18 / Math.max(1, n - 1));
  const maxDrop = Math.round(cardH * 0.08);
  return {
    maxDrop,
    /** Pose of card `index` (HandCard applies it as translateY + rotate). */
    at(index: number): FanPose {
      const rel = mid === 0 ? 0 : (index - mid) / mid; // -1 .. 1
      return { rise: -Math.round((1 - rel * rel) * maxDrop), deg: Number(((index - mid) * degPerCard).toFixed(2)) };
    },
  };
}

/** Quick settle with no wobble (same feel as the Okey rack tiles). */
const SETTLE = { damping: 44, stiffness: 1040, mass: 0.6 } as const;
/** A card dropped on the table waits there for the new view; if none removes it, it goes home. */
const HOLD_TIMEOUT_MS = 2500;
const CARD_HIT_SLOP = { top: 8, bottom: 8, left: 4, right: 4 };

interface HandCardProps {
  cardId: number;
  width: number;
  height: number;
  marginLeft: number;
  zIndex: number;
  fan: FanPose | null;
  /** My turn and a legal card: it can be picked up and dropped on the table. */
  draggable: boolean;
  dropTarget?: CardDropTarget;
  onPress(): void;
  /** True when the card is played (the screen's play action ran). */
  onDrop?(cardId: number): boolean;
  children: ReactNode;
}

/**
 * One hand card. A tap goes to the Pressable exactly as before (select, then play; screen readers
 * use this too). A drag (finger moved up ~10 dp, or ~28 dp any other way) lifts the card, it
 * follows the finger slightly enlarged, and the table zone lights up while the card is over it.
 * Dropped on the zone it plays; anywhere else it glides home. The pan cancels the Pressable when
 * it activates, so a drag never also counts as a tap.
 */
function HandCard(p: HandCardProps) {
  const { width, height, marginLeft, zIndex, draggable, dropTarget } = p;
  const rise = p.fan?.rise ?? 0;
  const deg = p.fan?.deg ?? 0;

  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  /** 0 resting .. 1 held: the card grows and the fan tilt straightens. */
  const lift = useSharedValue(0);
  const dragging = useSharedValue(false);
  /** Dropped on the zone: stays there until the play removes it (or the safety net sends it home). */
  const held = useSharedValue(false);
  /** Counts drops, so a late safety-net release can't hit a later drop. */
  const drops = useSharedValue(0);
  /** Where the finger took the card, from its centre. */
  const grab = useSharedValue({ x: 0, y: 0 });
  /** Whether the held card is over the zone now (the zone's `over` animates toward this). */
  const onZone = useSharedValue(0);

  // Worklets capture only shared values and numbers (never the target's ref).
  const noRect = useSharedValue<DropRect | null>(null);
  const noLevel = useSharedValue(0);
  const rect = dropTarget?.rect ?? noRect;
  const armed = dropTarget?.armed ?? noLevel;
  const over = dropTarget?.over ?? noLevel;
  const padX = dropTarget?.pad.x ?? 0;
  const padTop = dropTarget?.pad.top ?? 0;
  const padBottom = dropTarget?.pad.bottom ?? 0;

  // Stable JS callbacks, so a re-render mid-drag doesn't rebuild the gesture.
  const latest = useRef(p);
  latest.current = p;
  const onDragStart = useCallback(() => latest.current.dropTarget?.measure(), []);
  const releaseHeld = useCallback(
    (drop: number) => {
      'worklet';
      if (!held.value || drop !== drops.value) return;
      held.value = false;
      tx.value = withSpring(0, SETTLE);
      ty.value = withSpring(0, SETTLE);
    },
    [held, drops, tx, ty],
  );
  const releaseRef = useRef(releaseHeld);
  releaseRef.current = releaseHeld;
  const onDropJS = useCallback((drop: number) => {
    const accepted = latest.current.onDrop?.(latest.current.cardId) === true;
    if (accepted) {
      // The new view takes this card out of the hand; this only catches a play that never landed.
      setTimeout(() => scheduleOnUI(releaseRef.current, drop), HOLD_TIMEOUT_MS);
    } else {
      scheduleOnUI(releaseRef.current, drop);
    }
  }, []);

  const pan = usePanGesture({
    enabled: draggable,
    // Up toward the table starts quickly; any other way needs a longer move, so taps stay taps.
    activeOffsetY: [-CARD_DRAG_START_UP, CARD_DRAG_START_OTHER],
    activeOffsetX: [-CARD_DRAG_START_OTHER, CARD_DRAG_START_OTHER],
    onBegin: (e) => {
      grab.value = { x: e.x - width / 2, y: e.y - height / 2 };
    },
    onActivate: () => {
      dragging.value = true;
      held.value = false;
      onZone.value = 0;
      lift.value = withTiming(1, { duration: 110 });
      armed.value = withTiming(1, { duration: 120 });
      scheduleOnRN(onDragStart);
    },
    onUpdate: (e) => {
      tx.value = e.translationX;
      ty.value = e.translationY - CARD_DRAG_LIFT;
      const c = heldCardCentre(e.absoluteX, e.absoluteY, grab.value.x, grab.value.y, CARD_DRAG_LIFT);
      const on = hitDropZone(rect.value, c.x, c.y, { x: padX, top: padTop, bottom: padBottom }) ? 1 : 0;
      if (on !== onZone.value) {
        onZone.value = on;
        over.value = withTiming(on, { duration: 90 });
      }
    },
    onDeactivate: (e) => {
      const c = heldCardCentre(e.absoluteX, e.absoluteY, grab.value.x, grab.value.y, CARD_DRAG_LIFT);
      if (!hitDropZone(rect.value, c.x, c.y, { x: padX, top: padTop, bottom: padBottom })) return;
      held.value = true;
      drops.value += 1;
      scheduleOnRN(onDropJS, drops.value);
    },
    onFinalize: () => {
      if (!dragging.value) return;
      dragging.value = false;
      onZone.value = 0;
      armed.value = withTiming(0, { duration: 140 });
      over.value = withTiming(0, { duration: 140 });
      lift.value = withTiming(0, { duration: 140 });
      // Waiting on the play: the card stays where it was dropped.
      if (held.value) return;
      tx.value = withSpring(0, SETTLE);
      ty.value = withSpring(0, SETTLE);
    },
  });

  const animated = useAnimatedStyle(
    () => ({
      // Above its neighbours and the table while held or gliding home.
      zIndex: dragging.value || held.value || tx.value !== 0 || ty.value !== 0 ? 100 : zIndex,
      transform: [
        { translateX: tx.value },
        { translateY: ty.value + rise },
        { rotate: `${deg * (1 - lift.value)}deg` },
        { scale: 1 + (CARD_DRAG_SCALE - 1) * lift.value },
      ],
    }),
    [zIndex, rise, deg],
  );

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[styles.cardWrapper, { width, height, marginLeft }, animated]} hitSlop={CARD_HIT_SLOP}>
        <Pressable
          onPress={p.onPress}
          style={({ pressed }) => [styles.cardWrapper, { width, height, opacity: pressed ? 0.85 : 1 }]}
          hitSlop={CARD_HIT_SLOP}
          accessibilityRole="button"
        >
          {p.children}
        </Pressable>
      </Animated.View>
    </GestureDetector>
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
