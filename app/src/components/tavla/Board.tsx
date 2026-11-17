import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import type { Board as BoardData, CheckerMove, From, To } from '@kahve/tavla';
import { colors } from '../../theme';
import { countAt, moveLabel, moveLabelText, pointCell, stackShown } from './boardMath';
import { Checker, CHECKER_COLORS } from './Checker';
import { FRAME, type TavlaGeom, barX, colX, rowY, slotCenter, trayX } from './tavlaGeometry';
import { tt } from './text';

/** One checker sliding from one place to another (the opponent's move). */
export interface FlyingSpec {
  key: string;
  seat: number;
  from: { x: number; y: number };
  to: { x: number; y: number };
  ms: number;
}

export interface TavlaBoardProps {
  geom: TavlaGeom;
  /** Whose orientation is drawn (seat 0 for a spectator). */
  viewer: number;
  board: BoardData;
  /** The viewer's seat when a player, else -1: only this seat's stacks get the gold "can move" ring. */
  mySeat: number;
  selected: From | null;
  movable: Set<From>;
  targets: Map<To, CheckerMove>;
  interactive: boolean;
  flying: FlyingSpec | null;
  onPoint(n: number): void;
  onBar(): void;
  onOff(): void;
}

const TRI_A = '#c9a26b';
const TRI_B = '#8a3b27';

function Triangle({ w, h, color, up }: { w: number; h: number; color: string; up: boolean }) {
  return (
    <View
      style={{
        width: 0,
        height: 0,
        borderStyle: 'solid',
        borderLeftWidth: w / 2,
        borderRightWidth: w / 2,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        ...(up ? { borderBottomWidth: h, borderBottomColor: color } : { borderTopWidth: h, borderTopColor: color }),
      }}
    />
  );
}

function Chip({ move, x, y, size }: { move: CheckerMove; x: number; y: number; size: number }) {
  const l = moveLabel(move);
  const w = Math.max(46, size * 0.9);
  return (
    <View pointerEvents="none" style={[styles.chip, { left: x - w / 2, top: y - 22, width: w }]} accessibilityLabel={moveLabelText(move)}>
      <Text style={styles.chipMain} numberOfLines={1}>{l.main}</Text>
      {l.parts ? <Text style={styles.chipParts} numberOfLines={1}>{l.parts}</Text> : null}
    </View>
  );
}

function FlyingChecker({ spec, size }: { spec: FlyingSpec; size: number }) {
  const x = useSharedValue(spec.from.x);
  const y = useSharedValue(spec.from.y);
  useEffect(() => {
    x.value = withTiming(spec.to.x, { duration: spec.ms, easing: Easing.inOut(Easing.quad) });
    y.value = withTiming(spec.to.y, { duration: spec.ms, easing: Easing.inOut(Easing.quad) });
    // One animation per key (the parent remounts this per step).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: x.value - size / 2 }, { translateY: y.value - size / 2 }] }));
  return (
    <Animated.View pointerEvents="none" style={[styles.fly, style]}>
      <Checker seat={spec.seat} size={size} />
    </Animated.View>
  );
}

/** The board: 24 points, the bar and the bear-off tray, drawn with plain Views. */
export function TavlaBoard(p: TavlaBoardProps) {
  const { geom: g, viewer, board } = p;
  const me = p.mySeat;
  const points: number[] = [];
  for (let n = 1; n <= 24; n++) points.push(n);
  const offTarget = p.targets.get('off');
  const barMovable = p.interactive && p.movable.has('bar');
  const triW = g.colW - 4;
  const triH = g.pointH - 2;
  const mover = me < 0 ? viewer : me;

  const barStack = (seat: number) => {
    const n = board.bar[seat];
    if (n <= 0) return null;
    const shown = Math.min(n, 4);
    return Array.from({ length: shown }, (_, i) => {
      const c = slotCenter(g, viewer, { k: 'bar', seat }, i);
      const last = i === shown - 1;
      return (
        <View key={`bar${seat}-${i}`} style={[styles.abs, { left: c.x - g.d / 2, top: c.y - g.d / 2 }]}>
          <Checker
            seat={seat}
            size={g.d}
            count={last && n > shown ? n : null}
            movable={last && seat === me && barMovable}
            selected={last && seat === me && p.selected === 'bar'}
          />
        </View>
      );
    });
  };

  const offStack = (seat: number) => {
    const n = board.off[seat];
    const c = seat === 0 ? CHECKER_COLORS.white : CHECKER_COLORS.black;
    const items = Array.from({ length: Math.min(n, 15) }, (_, i) => {
      const s = slotCenter(g, viewer, { k: 'off', seat }, i);
      return (
        <View
          key={`off${seat}-${i}`}
          style={[
            styles.abs,
            styles.offItem,
            {
              left: s.x - (g.trayW - 8) / 2,
              top: s.y - (g.trayItemH - 1) / 2,
              width: g.trayW - 8,
              height: g.trayItemH - 1,
              backgroundColor: c.fill,
              borderColor: c.edge,
            },
          ]}
        />
      );
    });
    const labelTop = seat === viewer ? g.boardH - g.pointH + 2 : g.pointH - 24;
    return (
      <View key={`offstack${seat}`} style={StyleSheet.absoluteFill}>
        {items}
        <Text style={[styles.abs, styles.offCount, { left: trayX(g), width: g.trayW, top: labelTop }]} accessibilityLabel={tt('tavlaOffCount', { n })}>
          {n}
        </Text>
      </View>
    );
  };

  return (
    <View style={[styles.frame, { width: g.boardW + 2 * FRAME, height: g.boardH + 2 * FRAME, padding: FRAME }]}>
      <View style={{ width: g.boardW, height: g.boardH }}>
        {/* Bar and tray backgrounds */}
        <View style={[styles.abs, styles.dark, { left: barX(g), top: 0, width: g.barW, height: g.boardH }]} />
        <View style={[styles.abs, styles.dark, { left: trayX(g), top: 0, width: g.trayW, height: g.boardH }]} />

        {/* Triangles and point numbers (look only) */}
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          {points.map((n) => {
            const { row, col } = pointCell(n, viewer);
            const x = colX(g, col);
            const y = rowY(g, row);
            return (
              <View key={n} style={[styles.abs, { left: x, top: y, width: g.colW, height: g.pointH }]}>
                <View style={{ position: 'absolute', left: 2, top: 1 }}>
                  <Triangle w={triW} h={triH} color={col % 2 === 0 ? TRI_A : TRI_B} up={row === 'bottom'} />
                </View>
                <Text style={[styles.num, { width: g.colW }, row === 'bottom' ? { top: 0 } : { bottom: 0 }]} numberOfLines={1}>
                  {n}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Touch areas: the whole point height */}
        {points.map((n) => {
          const { row, col } = pointCell(n, viewer);
          const count = Math.abs(board.points[n]);
          const target = p.targets.get(n);
          return (
            <Pressable
              key={`t${n}`}
              disabled={!p.interactive}
              onPress={() => p.onPoint(n)}
              accessibilityRole="button"
              accessibilityLabel={count ? tt('tavlaPoint', { n, c: count }) : tt('tavlaPointEmpty', { n })}
              style={[
                styles.abs,
                styles.touch,
                { left: colX(g, col), top: rowY(g, row), width: g.colW, height: g.pointH },
                target && styles.target,
                p.selected === n && styles.sel,
              ]}
            />
          );
        })}
        <Pressable
          disabled={!barMovable}
          onPress={p.onBar}
          accessibilityRole="button"
          accessibilityLabel={tt('tavlaBar')}
          style={[styles.abs, styles.touch, { left: barX(g), top: g.boardH - g.pointH, width: g.barW, height: g.pointH }, p.selected === 'bar' && styles.sel]}
        />
        <Pressable
          disabled={!p.interactive || !offTarget}
          onPress={p.onOff}
          accessibilityRole="button"
          accessibilityLabel={tt('tavlaBearOff')}
          style={[styles.abs, styles.touch, { left: trayX(g), top: g.boardH - g.pointH, width: g.trayW, height: g.pointH }, offTarget && styles.target]}
        />

        {/* Checkers (never take touches) */}
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          {points.map((n) => {
            const seat = board.points[n] > 0 ? 0 : 1;
            const count = countAt(board, seat, n);
            if (count === 0) return null;
            const { shown, extra } = stackShown(count);
            return Array.from({ length: shown }, (_, i) => {
              const c = slotCenter(g, viewer, { k: 'point', n }, i);
              const top = i === shown - 1;
              return (
                <View key={`${n}-${i}`} style={[styles.abs, { left: c.x - g.d / 2, top: c.y - g.d / 2 }]}>
                  <Checker
                    seat={seat}
                    size={g.d}
                    count={top ? extra : null}
                    movable={top && p.interactive && seat === me && p.movable.has(n)}
                    selected={top && p.selected === n}
                  />
                </View>
              );
            });
          })}
          {barStack(0)}
          {barStack(1)}
          {offStack(0)}
          {offStack(1)}
        </View>

        {/* Labels on the places the selected checker can go */}
        {Array.from(p.targets.entries()).map(([to, move]) => {
          if (to === 'off') {
            return <Chip key="off" move={move} x={trayX(g) + g.trayW / 2} y={g.boardH - g.pointH / 2} size={g.trayW} />;
          }
          // Own stack: the chip sits on the next free slot; empty or a hit: the first slot.
          const c = slotCenter(g, viewer, { k: 'point', n: to }, Math.min(countAt(board, mover, to), 4));
          return <Chip key={String(to)} move={move} x={c.x} y={c.y} size={g.colW} />;
        })}

        {p.flying ? <FlyingChecker key={p.flying.key} spec={p.flying} size={g.d} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { backgroundColor: colors.woodDark, borderRadius: 10, borderWidth: 2, borderColor: colors.wood },
  abs: { position: 'absolute' },
  dark: { backgroundColor: '#24150b' },
  touch: { borderRadius: 6, borderWidth: 3, borderColor: 'transparent' },
  target: { backgroundColor: 'rgba(242,182,50,0.32)', borderColor: colors.accent },
  sel: { borderColor: '#ffffff', backgroundColor: 'rgba(255,255,255,0.14)' },
  num: {
    position: 'absolute',
    textAlign: 'center',
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 20,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  chip: {
    position: 'absolute',
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.accent,
    borderWidth: 2,
    borderColor: '#2a1a05',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
    elevation: 8,
  },
  chipMain: { color: '#1d1209', fontSize: 20, fontWeight: '900', lineHeight: 22 },
  chipParts: { color: '#1d1209', fontSize: 15, fontWeight: '800', lineHeight: 17 },
  fly: { position: 'absolute', left: 0, top: 0, zIndex: 30, elevation: 10 },
  offItem: { borderWidth: 1.5, borderRadius: 3 },
  offCount: { color: colors.text, fontSize: 18, fontWeight: '900', textAlign: 'center' },
});
