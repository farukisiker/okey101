import { memo, useCallback, useEffect, useRef, type ReactNode } from 'react';
import type { ViewStyle } from 'react-native';
import { GestureDetector, useCompetingGestures, usePanGesture, useTapGesture } from 'react-native-gesture-handler';
import Animated, { type SharedValue, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { type RackGeom, slotAt } from '../game/rackLayout';

interface Props {
  children: ReactNode;
  style?: ViewStyle;
  enabled?: boolean;
  /** Rack geometry and the hovered-slot marker, updated on the UI thread while dragging. */
  rackGeom: SharedValue<RackGeom | null>;
  hoverSlot: SharedValue<number>;
  onTap?(): void;
  onDragStart?(): void;
  onDrop(x: number, y: number): void;
}

/**
 * Something the player can pick up: it follows the finger, lifts while held,
 * marks the rack slot it would land in, and springs home after the drop.
 */
export const DragSource = memo(function DragSource(p: Props) {
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const dragging = useSharedValue(false);
  const { rackGeom, hoverSlot } = p;
  const enabled = p.enabled ?? true;
  const hasTap = !!p.onTap;

  // Stable callbacks so re-renders mid-drag don't rebuild the gesture handlers.
  const latest = useRef(p);
  latest.current = p;
  const onTap = useCallback(() => latest.current.onTap?.(), []);
  const onDragStart = useCallback(() => latest.current.onDragStart?.(), []);
  const onDrop = useCallback((x: number, y: number) => latest.current.onDrop(x, y), []);
  const left = p.style?.left;
  const top = p.style?.top;

  // Moved to a new place: drop any leftover offset so it doesn't spring from the old spot.
  useEffect(() => {
    tx.value = 0;
    ty.value = 0;
  }, [left, top, tx, ty]);

  const pan = usePanGesture({
    enabled,
    minDistance: 2,
    onActivate: () => {
      dragging.value = true;
      scheduleOnRN(onDragStart);
    },
    onUpdate: (e) => {
      tx.value = e.translationX;
      // Lift the tile above the finger so it stays visible while dragging.
      ty.value = e.translationY - 24;
      hoverSlot.value = slotAt(rackGeom.value, e.absoluteX, e.absoluteY);
    },
    onDeactivate: (e) => {
      scheduleOnRN(onDrop, e.absoluteX, e.absoluteY);
    },
    onFinalize: () => {
      dragging.value = false;
      hoverSlot.value = -1;
      tx.value = withSpring(0, { duration: 160 });
      ty.value = withSpring(0, { duration: 160 });
    },
  });
  const tap = useTapGesture({
    enabled: hasTap,
    onActivate: () => {
      scheduleOnRN(onTap);
    },
  });
  const gesture = useCompetingGestures(pan, tap);

  const animated = useAnimatedStyle(() => ({
    zIndex: dragging.value ? 100 : 1,
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: dragging.value ? 1.18 : 1 }],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[p.style, animated]}>{p.children}</Animated.View>
    </GestureDetector>
  );
});
