import { memo, useCallback, useLayoutEffect, useRef, type ReactNode } from 'react';
import type { LayoutChangeEvent, ViewStyle } from 'react-native';
import { GestureDetector, useCompetingGestures, usePanGesture, useTapGesture } from 'react-native-gesture-handler';
import Animated, { type SharedValue, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { type RackGeom, slotAt } from '../game/rackLayout';

/** The held tile rides this far above the finger so the finger doesn't hide it. */
const LIFT = 24;
/** Gentle, quick settle with no wobble: the tile glides into place. */
const SETTLE = { damping: 22, stiffness: 260, mass: 0.6 } as const;

interface Props {
  children: ReactNode;
  style?: ViewStyle;
  enabled?: boolean;
  /** Jump back instead of sliding home (a pile's top tile: the drawn tile "went" to the rack). */
  instantReturn?: boolean;
  /** Rack geometry and the hovered-slot marker, updated on the UI thread while dragging. */
  rackGeom: SharedValue<RackGeom | null>;
  hoverSlot: SharedValue<number>;
  onTap?(): void;
  onDragStart?(): void;
  /** Gesture over, dropped anywhere or cancelled. */
  onDragEnd?(): void;
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
  /** Picking up and setting down are animated, so a tile feels physical. */
  const lift = useSharedValue(1);
  const { rackGeom, hoverSlot } = p;
  const enabled = p.enabled ?? true;
  const hasTap = !!p.onTap;
  const instant = !!p.instantReturn;

  // Stable callbacks so re-renders mid-drag don't rebuild the gesture handlers.
  const latest = useRef(p);
  latest.current = p;
  const onTap = useCallback(() => latest.current.onTap?.(), []);
  const onDragStart = useCallback(() => latest.current.onDragStart?.(), []);
  const onDragEnd = useCallback(() => latest.current.onDragEnd?.(), []);
  const onDrop = useCallback((x: number, y: number) => latest.current.onDrop(x, y), []);
  const left = p.style?.left;
  const top = p.style?.top;
  // Where the finger grabbed the tile, from its centre: drops aim with the tile, not the finger.
  const size = useSharedValue({ w: 0, h: 0 });
  const grab = useSharedValue({ x: 0, y: 0 });
  const onLayout = useCallback((e: LayoutChangeEvent) => {
    size.value = { w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height };
  }, [size]);

  // Moved to a new slot: keep the tile where it is on screen and let it glide
  // in from there, instead of jumping (from the drop point, or the old slot).
  const prev = useRef({ left, top });
  useLayoutEffect(() => {
    const was = prev.current;
    prev.current = { left, top };
    if (typeof left !== 'number' || typeof top !== 'number' || typeof was.left !== 'number' || typeof was.top !== 'number') {
      tx.value = 0;
      ty.value = 0;
      return;
    }
    if (was.left === left && was.top === top) return;
    if (instant) {
      tx.value = 0;
      ty.value = 0;
      return;
    }
    tx.value = tx.value + (was.left - left);
    ty.value = ty.value + (was.top - top);
    tx.value = withSpring(0, SETTLE);
    ty.value = withSpring(0, SETTLE);
  }, [left, top, tx, ty, instant]);

  const pan = usePanGesture({
    enabled,
    // A real drag, not a brush of the finger, before anything moves.
    minDistance: 10,
    onBegin: (e) => {
      grab.value = { x: e.x - size.value.w / 2, y: e.y - size.value.h / 2 };
    },
    onActivate: () => {
      dragging.value = true;
      lift.value = withTiming(1.15, { duration: 110 });
      scheduleOnRN(onDragStart);
    },
    onUpdate: (e) => {
      tx.value = e.translationX;
      ty.value = e.translationY - LIFT;
      // Where the tile's centre is, not where the finger is: the player aims the tile.
      hoverSlot.value = slotAt(rackGeom.value, e.absoluteX - grab.value.x, e.absoluteY - LIFT - grab.value.y);
    },
    onDeactivate: (e) => {
      scheduleOnRN(onDrop, e.absoluteX - grab.value.x, e.absoluteY - LIFT - grab.value.y);
    },
    onFinalize: () => {
      if (dragging.value) scheduleOnRN(onDragEnd);
      dragging.value = false;
      lift.value = withTiming(1, { duration: 140 });
      hoverSlot.value = -1;
      // Not dropped anywhere useful: glide home. A move to a new slot re-aims this from JS.
      tx.value = instant ? 0 : withSpring(0, SETTLE);
      ty.value = instant ? 0 : withSpring(0, SETTLE);
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
    // Stays on top while gliding home too, so it never slides under its neighbours.
    zIndex: dragging.value || tx.value !== 0 || ty.value !== 0 ? 100 : 1,
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: lift.value }],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View onLayout={onLayout} style={[p.style, animated]}>
        {p.children}
      </Animated.View>
    </GestureDetector>
  );
});
