import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

/** Pip positions on a 3x3 grid (row, col), per face. */
const PIPS: Record<number, [number, number][]> = {
  1: [[1, 1]],
  2: [[0, 2], [2, 0]],
  3: [[0, 2], [1, 1], [2, 0]],
  4: [[0, 0], [0, 2], [2, 0], [2, 2]],
  5: [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]],
  6: [[0, 0], [1, 0], [2, 0], [0, 2], [1, 2], [2, 2]],
};

export const ROLL_MS = 560;

export function DieFace({ value, size, dim }: { value: number; size: number; dim?: boolean }) {
  const pad = size * 0.14;
  const cell = (size - 2 * pad) / 3;
  const pip = cell * 0.78;
  return (
    <View
      accessible
      accessibilityLabel={String(value)}
      style={[
        styles.face,
        { width: size, height: size, borderRadius: size * 0.18, borderWidth: Math.max(2, size * 0.04) },
        dim && styles.dim,
      ]}
    >
      {(PIPS[value] ?? []).map(([r, c]) => (
        <View
          key={`${r}${c}`}
          style={{
            position: 'absolute',
            left: pad + c * cell + (cell - pip) / 2,
            top: pad + r * cell + (cell - pip) / 2,
            width: pip,
            height: pip,
            borderRadius: pip / 2,
            backgroundColor: dim ? '#6b5d44' : '#1d1209',
          }}
        />
      ))}
    </View>
  );
}

export interface DieProps {
  value: number;
  size: number;
  dim?: boolean;
  /** Changes when the die is rolled again; the first value does not animate. */
  rollKey: number | string;
}

/** A die that tumbles (random faces + a wobble, ≤ 600 ms) whenever `rollKey` changes. */
export function Die({ value, size, dim, rollKey }: DieProps) {
  const [shown, setShown] = useState(value);
  const first = useRef(true);
  const rot = useSharedValue(0);
  const lift = useSharedValue(0);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      setShown(value);
      return;
    }
    let n = 0;
    const timer = setInterval(() => {
      n++;
      if (n >= 7) {
        clearInterval(timer);
        setShown(value);
      } else setShown(1 + Math.floor(Math.random() * 6));
    }, 75);
    rot.value = withSequence(
      withTiming(-18, { duration: 90 }),
      withTiming(16, { duration: 120 }),
      withTiming(-10, { duration: 120 }),
      withTiming(6, { duration: 110 }),
      withTiming(0, { duration: 100 }),
    );
    lift.value = withSequence(withTiming(-size * 0.18, { duration: 220 }), withTiming(0, { duration: 300 }));
    return () => {
      clearInterval(timer);
      cancelAnimation(rot);
      cancelAnimation(lift);
      setShown(value);
    };
    // The roll starts on rollKey only; `value` is read when it ends.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rollKey]);

  useEffect(() => {
    setShown(value);
  }, [value]);

  const style = useAnimatedStyle(() => ({ transform: [{ translateY: lift.value }, { rotate: `${rot.value}deg` }] }));
  return (
    <Animated.View style={style}>
      <DieFace value={shown} size={size} dim={dim} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  face: { backgroundColor: '#fbf6e9', borderColor: '#4a321e' },
  dim: { backgroundColor: '#bdb49c', opacity: 0.55 },
});
