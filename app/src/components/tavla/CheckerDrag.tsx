import { useCallback, useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureDetector, GestureStateManager, usePanGesture } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN, scheduleOnUI } from 'react-native-worklets';
import { colors } from '../../theme';
import { Checker } from './Checker';
import { type DragEntry, type PlaceKey, PLACE_NONE, dropAt, pickAt, placeRect } from './dragHit';
import type { TavlaGeom } from './tavlaGeometry';

/** A real drag, not a shaky tap, before the checker leaves its point (same as the Okey rack). */
const MIN_DISTANCE = 10;
/** The held checker is drawn this much bigger. */
const HELD_SCALE = 1.18;
const BACK_MS = 170;
const LAND_MS = 110;
/** A landed checker waits this long for the board to change (the step's view), then is let go. */
const LAND_TIMEOUT_MS = 2500;

interface Props {
  geom: TavlaGeom;
  viewer: number;
  /** Colour of the dragged checker. */
  seat: number;
  /** What may be dragged this turn (empty: nothing). */
  plan: DragEntry[];
  enabled: boolean;
  /** Changes when the drawn board changes: a landed checker then gives way to the real one. */
  boardKey: string;
  children: ReactNode;
  /** A checker left its place (JS): hide it there, show its targets. */
  onLift(from: PlaceKey): void;
  /** Dropped on a legal target. True: the move went out (the checker waits on the target). */
  onDrop(from: PlaceKey, to: PlaceKey): boolean;
  /** The dragged checker is back home or has given way to the real one: show it again. */
  onSettled(): void;
}

/**
 * Drag-and-drop on top of the board's tap controls. One pan gesture covers the inner board; it only starts on a
 * place the player can move from (else it fails at once and the tap Pressables underneath work as before), and it
 * activates after MIN_DISTANCE, so a short tap is still a tap. While held, a copy of the checker follows the finger,
 * a little bigger and lifted above it; the legal target under it gets a strong frame. Hit-testing is dragHit.ts.
 */
export function CheckerDrag(p: Props) {
  const { geom: g } = p;
  const geomSV = useSharedValue(g);
  const viewerSV = useSharedValue(p.viewer);
  const planSV = useSharedValue<DragEntry[]>(p.plan);
  useEffect(() => {
    geomSV.value = g;
    viewerSV.value = p.viewer;
    planSV.value = p.plan;
  }, [g, p.viewer, p.plan, geomSV, viewerSV, planSV]);

  /** Place the finger came down on (a movable one), and the one being dragged (PLACE_NONE: none). */
  const picked = useSharedValue<PlaceKey>(PLACE_NONE);
  const active = useSharedValue<PlaceKey>(PLACE_NONE);
  const targets = useSharedValue<PlaceKey[]>([]);
  const hover = useSharedValue<PlaceKey>(PLACE_NONE);
  /** Home of the dragged checker, for the glide back. */
  const homeX = useSharedValue(0);
  const homeY = useSharedValue(0);
  const gx = useSharedValue(0);
  const gy = useSharedValue(0);
  const scale = useSharedValue(1);
  const shown = useSharedValue(0);
  const hx = useSharedValue(0);
  const hy = useSharedValue(0);
  const hw = useSharedValue(0);
  const hh = useSharedValue(0);
  const lift = Math.max(16, Math.round(g.d * 0.6));

  // JS side: stable callbacks, so a re-render mid-drag (the targets lighting up) doesn't rebuild the gesture.
  const latest = useRef(p);
  latest.current = p;
  const landed = useRef(false);
  const landTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const settle = useCallback(() => {
    if (landTimer.current) clearTimeout(landTimer.current);
    landTimer.current = null;
    landed.current = false;
    latest.current.onSettled();
  }, []);
  const goHome = useCallback(() => {
    'worklet';
    scale.value = withTiming(1, { duration: BACK_MS });
    gx.value = withTiming(homeX.value, { duration: BACK_MS });
    gy.value = withTiming(homeY.value, { duration: BACK_MS }, () => {
      shown.value = 0;
      scheduleOnRN(settle);
    });
  }, [scale, gx, gy, homeX, homeY, shown, settle]);

  const lifted = useCallback((from: PlaceKey) => latest.current.onLift(from), []);
  const dropped = useCallback(
    (from: PlaceKey, to: PlaceKey) => {
      if (latest.current.onDrop(from, to)) {
        landed.current = true;
        if (landTimer.current) clearTimeout(landTimer.current);
        landTimer.current = setTimeout(() => {
          shown.value = 0;
          settle();
        }, LAND_TIMEOUT_MS);
      } else {
        scheduleOnUI(goHome);
      }
    },
    [goHome, settle, shown],
  );

  // The board moved on (the step's view): the real checker is on the target now, the copy goes.
  useLayoutEffect(() => {
    if (!landed.current) return;
    shown.value = 0;
    settle();
  }, [p.boardKey, settle, shown]);
  useEffect(() => () => {
    if (landTimer.current) clearTimeout(landTimer.current);
  }, []);

  const pan = usePanGesture({
    enabled: p.enabled,
    minDistance: MIN_DISTANCE,
    maxPointers: 1,
    onTouchesDown: (e) => {
      if (active.value !== PLACE_NONE) return;
      const t = e.allTouches[0];
      const froms = planSV.value.map((en) => en.from);
      const k = t && shown.value === 0 ? pickAt(geomSV.value, viewerSV.value, t.x, t.y, froms) : PLACE_NONE;
      picked.value = k;
      // Not on a checker the player can move: let go at once, the taps underneath take it.
      if (k === PLACE_NONE) GestureStateManager.fail(e.handlerTag);
    },
    onActivate: (e) => {
      const en = planSV.value.find((x) => x.from === picked.value);
      if (!en) return;
      active.value = en.from;
      targets.value = en.targets.map((x) => x.k);
      homeX.value = en.x;
      homeY.value = en.y;
      gx.value = e.x;
      gy.value = e.y - lift;
      shown.value = 1;
      scale.value = withTiming(HELD_SCALE, { duration: 110 });
      scheduleOnRN(lifted, en.from);
    },
    onUpdate: (e) => {
      if (active.value === PLACE_NONE) return;
      gx.value = e.x;
      gy.value = e.y - lift;
      // Aimed with the checker the player sees, not the finger under it.
      const k = dropAt(geomSV.value, viewerSV.value, gx.value, gy.value, targets.value);
      if (k !== hover.value) {
        hover.value = k;
        if (k !== PLACE_NONE) {
          const r = placeRect(geomSV.value, viewerSV.value, k);
          hx.value = r.x;
          hy.value = r.y;
          hw.value = r.w;
          hh.value = r.h;
        }
      }
    },
    onDeactivate: (e) => {
      const from = active.value;
      if (from === PLACE_NONE) return;
      const k = e.canceled ? PLACE_NONE : dropAt(geomSV.value, viewerSV.value, e.x, e.y - lift, targets.value);
      const en = planSV.value.find((x) => x.from === from);
      const spot = en ? en.targets.find((x) => x.k === k) : undefined;
      if (spot) {
        scale.value = withTiming(1, { duration: LAND_MS });
        gx.value = withTiming(spot.x, { duration: LAND_MS });
        gy.value = withTiming(spot.y, { duration: LAND_MS });
        scheduleOnRN(dropped, from, k);
      } else {
        goHome();
      }
    },
    onFinalize: () => {
      active.value = PLACE_NONE;
      picked.value = PLACE_NONE;
      hover.value = PLACE_NONE;
      targets.value = [];
    },
  });

  const ghost = useAnimatedStyle(() => ({
    opacity: shown.value,
    transform: [{ translateX: gx.value - g.d / 2 }, { translateY: gy.value - g.d / 2 }, { scale: scale.value }],
  }));
  const hoverStyle = useAnimatedStyle(() => ({
    opacity: hover.value !== PLACE_NONE ? 1 : 0,
    left: hx.value,
    top: hy.value,
    width: hw.value,
    height: hh.value,
  }));

  return (
    <GestureDetector gesture={pan}>
      <View style={{ width: g.boardW, height: g.boardH }}>
        {p.children}
        <Animated.View pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={[styles.hover, hoverStyle]} />
        <Animated.View pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={[styles.ghost, ghost]}>
          <Checker seat={p.seat} size={g.d} selected />
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  // The target under the held checker: a thick white frame over a strong gold fill (the other targets are a thin gold frame).
  hover: {
    position: 'absolute',
    borderRadius: 8,
    borderWidth: 6,
    borderColor: '#ffffff',
    backgroundColor: 'rgba(242,182,50,0.55)',
    zIndex: 25,
    elevation: 9,
  },
  ghost: { position: 'absolute', left: 0, top: 0, zIndex: 40, elevation: 12, shadowColor: colors.accent, shadowOpacity: 0.9, shadowRadius: 10 },
});
