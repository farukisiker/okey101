import { StyleSheet, Text, View } from 'react-native';

export const CHECKER_COLORS = {
  white: { fill: '#f6efd6', edge: '#4a321e', inner: '#d8cba4', text: '#2a1a10' },
  black: { fill: '#2b1a10', edge: '#f0e2b8', inner: '#4a3220', text: '#f6efd6' },
};

export interface CheckerProps {
  /** Seat 0 white, seat 1 black. */
  seat: number;
  size: number;
  /** Gold ring: this stack can be picked up. */
  movable?: boolean;
  selected?: boolean;
  /** Count drawn on the checker when a stack is taller than 5. */
  count?: number | null;
}

/** One round checker: thick contrasting edge, an inner ring, optional count. */
export function Checker({ seat, size, movable, selected, count }: CheckerProps) {
  const c = seat === 0 ? CHECKER_COLORS.white : CHECKER_COLORS.black;
  const edge = Math.max(3, Math.round(size * 0.07));
  return (
    <View
      style={[
        styles.base,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: c.fill, borderColor: c.edge, borderWidth: edge },
        movable && styles.movable,
        selected && styles.selected,
      ]}
    >
      <View
        style={{
          width: size * 0.56,
          height: size * 0.56,
          borderRadius: size * 0.28,
          borderWidth: 2,
          borderColor: c.inner,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {count != null ? <Text style={[styles.count, { color: c.text, fontSize: Math.max(16, size * 0.42) }]}>{count}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
  movable: { shadowColor: '#f2b632', shadowOpacity: 1, shadowRadius: 6, elevation: 6, borderColor: '#f2b632' },
  selected: { borderColor: '#f2b632', borderWidth: 5, transform: [{ scale: 1.08 }] },
  count: { fontWeight: '900' },
});
