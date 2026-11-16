import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { COMPACT_ROW_PADDING } from './computeCardLayout';

export interface CompactCenterRowProps {
  /** Left column (top aligned): badges + Sort button. */
  left: ReactNode;
  /** Right column (bottom aligned): hint + Play button. */
  right: ReactNode;
  insetLeft?: number;
  insetRight?: number;
  /** The table centre (trick cross or pile). */
  children: ReactNode;
}

/**
 * B12: table centre for short windows. The action buttons that are a separate row on tablets sit in two columns
 * beside the centre, so the centre keeps the 56 dp the action bar would have taken.
 */
export function CompactCenterRow({ left, right, insetLeft = 0, insetRight = 0, children }: CompactCenterRowProps) {
  return (
    <View
      style={[
        styles.row,
        { paddingLeft: insetLeft + COMPACT_ROW_PADDING, paddingRight: insetRight + COMPACT_ROW_PADDING },
      ]}
    >
      <View style={[styles.side, styles.left]}>{left}</View>
      <View style={styles.center}>{children}</View>
      <View style={[styles.side, styles.right]}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  side: { flex: 1, minWidth: 0, alignSelf: 'stretch', paddingVertical: 4, gap: 6 },
  left: { alignItems: 'flex-start', justifyContent: 'space-between' },
  right: { alignItems: 'flex-end', justifyContent: 'flex-end' },
  center: { alignItems: 'center', justifyContent: 'center' },
});
