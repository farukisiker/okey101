import { memo, useCallback, useLayoutEffect, useRef, type ReactNode } from 'react';
import type { LayoutChangeEvent, ViewStyle } from 'react-native';
import { GestureDetector, useCompetingGestures, usePanGesture, useTapGesture } from 'react-native-gesture-handler';
import Animated, { type SharedValue, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { scheduleOnRN, scheduleOnUI } from 'react-native-worklets';
import { type RackGeom, slotAt } from '../game/rackLayout';

/** The held tile rides this far above the finger so the finger doesn't hide it. */
const LIFT = 24;
/** Gentle, quick settle with no wobble: the tile glides into place. */
const SETTLE = { damping: 22, stiffness: 260, mass: 0.6 } as const;
/** A tile left waiting on a drop goes home if the rack never moves it (it always should). */
const HOLD_TIMEOUT_MS = 1000;

interface Props {
  children: ReactNode;
  style?: ViewStyle;
  enabled?: boolean;
  /** Jump back instead of sliding home (a pile's top tile: the drawn tile "went" to the rack). */
  instantReturn?: boolean;
  /** Rack geometry and the hovered-slot marker, updated on the UI thread while dragging. */
  rackGeom: SharedValue<RackGeom | null>;
  hoverSlot: SharedValue<number>;
  /**
   * The rack slot this tile sits in. A drop on another slot then leaves the tile
   * where it was dropped until the rack answers, instead of sliding home first.
   */
  slot?: number;
  onTap?(): void;
  onDragStart?(): void;
  /** Gesture over, dropped anywhere or cancelled. */
  onDragEnd?(): void;
  /** True when the tile moves to a new slot (its `style` left/top will change). */
  onDrop(x: number, y: number): boolean | void;
}

/**
 * Something the player can pick up: it follows the finger, lifts while held,
 * marks the rack slot it would land in, and springs home after the drop.
 *
 * Its left/top are applied as a translation on the UI thread, not as layout,
 * so a move to a new slot (new base plus a compensating offset) lands in one
 * frame: a React commit and a Reanimated update can't show it half-moved.
 */
export const DragSource = memo(function DragSource(p: Props) {
  const { left: styleLeft, top: styleTop, ...restStyle } = p.style ?? {};
  const positioned = typeof styleLeft === 'number' && typeof styleTop === 'number';
  const left = positioned ? styleLeft : 0;
  const top = positioned ? styleTop : 0;

  /** Where the tile rests (its slot), and its offset from there. */
  const baseX = useSharedValue(left);
  const baseY = useSharedValue(top);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const dragging = useSharedValue(false);
  /** Dropped on another rack slot: waits there for the rack's answer. */
  const held = useSharedValue(false);
  /** Counts drops, so a late safety-net release can't hit a later drop. */
  const drops = useSharedValue(0);
  const home = useSharedValue(p.slot ?? -1);
  /** Picking up and setting down are animated, so a tile feels physical. */
  const lift = useSharedValue(1);
  const { rackGeom, hoverSlot } = p;
  const enabled = p.enabled ?? true;
  const hasTap = !!p.onTap;
  const instant = !!p.instantReturn;

  /** A tile still waiting on its drop glides home (a tile already gliding is left alone). */
  const releaseHeld = useCallback((drop: number) => {
    'worklet';
    if (!held.value || drop !== drops.value) return;
    held.value = false;
    tx.value = instant ? 0 : withSpring(0, SETTLE);
    ty.value = instant ? 0 : withSpring(0, SETTLE);
  }, [held, drops, tx, ty, instant]);

  // Stable callbacks so re-renders mid-drag don't rebuild the gesture handlers.
  const latest = useRef(p);
  latest.current = p;
  const onTap = useCallback(() => latest.current.onTap?.(), []);
  const onDragStart = useCallback(() => latest.current.onDragStart?.(), []);
  const onDragEnd = useCallback(() => latest.current.onDragEnd?.(), []);
  const releaseRef = useRef(releaseHeld);
  releaseRef.current = releaseHeld;
  const onDrop = useCallback((x: number, y: number, drop: number) => {
    if (latest.current.onDrop(x, y) === true) {
      // The re-render that moves the tile re-aims it and clears `held`; this is only a safety net.
      setTimeout(() => scheduleOnUI(releaseRef.current, drop), HOLD_TIMEOUT_MS);
    } else {
      scheduleOnUI(releaseRef.current, drop);
    }
  }, []);
  // Where the finger grabbed the tile, from its centre: drops aim with the tile, not the finger.
  const size = useSharedValue({ w: 0, h: 0 });
  const grab = useSharedValue({ x: 0, y: 0 });
  const onLayout = useCallback((e: LayoutChangeEvent) => {
    size.value = { w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height };
  }, [size]);

  // Moved to a new slot: keep the tile where it is on screen and let it glide in
  // from there (from the drop point, or the old slot). Base and offset change
  // together on the UI thread, so the tile never flashes at the new slot first.
  const slot = p.slot ?? -1;
  const prev = useRef({ left, top, slot });
  useLayoutEffect(() => {
    const was = prev.current;
    prev.current = { left, top, slot };
    if (was.left === left && was.top === top && was.slot === slot) return;
    scheduleOnUI(
      (l: number, t: number, s: number, snap: boolean) => {
        'worklet';
        const dx = baseX.value - l;
        const dy = baseY.value - t;
        baseX.value = l;
        baseY.value = t;
        home.value = s;
        held.value = false;
        if (snap) {
          tx.value = 0;
          ty.value = 0;
          return;
        }
        if (dx === 0 && dy === 0) return;
        tx.value = tx.value + dx;
        ty.value = ty.value + dy;
        tx.value = withSpring(0, SETTLE);
        ty.value = withSpring(0, SETTLE);
      },
      left,
      top,
      slot,
      instant,
    );
  }, [left, top, slot, baseX, baseY, home, held, tx, ty, instant]);

  const pan = usePanGesture({
    enabled,
    // A real drag, not a brush of the finger, before anything moves.
    minDistance: 10,
    onBegin: (e) => {
      grab.value = { x: e.x - size.value.w / 2, y: e.y - size.value.h / 2 };
    },
    onActivate: () => {
      dragging.value = true;
      held.value = false;
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
      const x = e.absoluteX - grab.value.x;
      const y = e.absoluteY - LIFT - grab.value.y;
      // A rack tile dropped on another slot stays put until the rack (JS) says where it
      // goes. Sliding home at once and coming back when JS answered looked like a failed
      // drop on slow tablets, where that answer takes a few hundred milliseconds.
      const target = slotAt(rackGeom.value, x, y);
      held.value = home.value >= 0 && target >= 0 && target !== home.value;
      drops.value += 1;
      scheduleOnRN(onDrop, x, y, drops.value);
    },
    onFinalize: () => {
      if (dragging.value) scheduleOnRN(onDragEnd);
      dragging.value = false;
      lift.value = withTiming(1, { duration: 140 });
      hoverSlot.value = -1;
      // Waiting for the rack: JS re-aims the tile at its new slot, or sends it home.
      if (held.value) return;
      // Not dropped anywhere useful: glide home.
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
    transform: [
      { translateX: baseX.value + tx.value },
      { translateY: baseY.value + ty.value },
      { scale: lift.value },
    ],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View onLayout={onLayout} style={[restStyle, positioned && PINNED, animated]}>
        {p.children}
      </Animated.View>
    </GestureDetector>
  );
});

/** Layout pins a positioned tile to the parent's corner; its slot comes from the translation. */
const PINNED = { left: 0, top: 0 } as const;
