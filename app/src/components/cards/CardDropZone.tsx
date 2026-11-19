import { useCallback, useMemo, useRef, type ReactNode, type RefObject } from 'react';
import { type HostInstance, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import Animated, { type SharedValue, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { colors } from '../../theme';
import type { DropPad, DropRect } from './cardDrag';

/** The table target a hand card can be dragged onto (Pişti pile, Batak trick cross). */
export interface CardDropTarget {
  ref: RefObject<HostInstance | null>;
  /** The zone in window coordinates; re-measured on layout and when a drag starts. */
  rect: SharedValue<DropRect | null>;
  pad: DropPad;
  /** 0..1: a card is being dragged (the zone shows a dashed outline). */
  armed: SharedValue<number>;
  /** 0..1: the held card is over the zone (thick solid outline, glow, arrow). */
  over: SharedValue<number>;
  measure(): void;
}

export function useCardDropTarget(pad: DropPad): CardDropTarget {
  const ref = useRef<HostInstance>(null);
  const rect = useSharedValue<DropRect | null>(null);
  const armed = useSharedValue(0);
  const over = useSharedValue(0);
  const measure = useCallback(() => {
    ref.current?.measureInWindow((x, y, width, height) => {
      rect.value = { x, y, width, height };
    });
  }, [rect]);
  const { x, top, bottom } = pad;
  return useMemo(() => ({ ref, rect, pad: { x, top, bottom }, armed, over, measure }), [rect, x, top, bottom, armed, over, measure]);
}

interface Props {
  target: CardDropTarget;
  children: ReactNode;
  style?: ViewStyle;
}

/**
 * Wraps the table centre so a dragged card can be dropped on it. While a card is held the
 * zone shows a dashed outline; with the card over it the outline turns thick and solid, glows,
 * grows a little and shows a down arrow (a shape cue, not just a colour change).
 */
export function CardDropZone({ target, children, style }: Props) {
  const { armed, over } = target;
  const grow = useAnimatedStyle(() => ({ transform: [{ scale: 1 + 0.04 * over.value }] }));
  const dashed = useAnimatedStyle(() => ({ opacity: armed.value * (1 - over.value) }));
  const solid = useAnimatedStyle(() => ({ opacity: over.value }));

  return (
    <View ref={target.ref} collapsable={false} onLayout={target.measure} style={style}>
      <Animated.View style={grow}>
        {children}
        <Animated.View pointerEvents="none" style={[styles.ring, styles.ringDashed, dashed]} />
        <Animated.View pointerEvents="none" style={[styles.ring, styles.ringSolid, solid]}>
          <View style={styles.arrow}>
            <Text style={styles.arrowText}>▼</Text>
          </View>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const RING_OUT = 10;

const styles = StyleSheet.create({
  ring: {
    position: 'absolute',
    left: -RING_OUT,
    right: -RING_OUT,
    top: -RING_OUT,
    bottom: -RING_OUT,
    borderRadius: 18,
  },
  ringDashed: {
    borderWidth: 3,
    borderStyle: 'dashed',
    borderColor: 'rgba(242, 182, 50, 0.85)',
  },
  ringSolid: {
    borderWidth: 6,
    borderColor: colors.accent,
    backgroundColor: 'rgba(242, 182, 50, 0.14)',
    shadowColor: colors.accent,
    shadowOpacity: 0.9,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    alignItems: 'center',
  },
  arrow: {
    position: 'absolute',
    top: -22,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowText: {
    color: '#07301f',
    fontSize: 20,
    fontWeight: '900',
    lineHeight: 24,
  },
});
