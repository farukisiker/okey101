import { StyleSheet, Text, View } from 'react-native';
import { colors, font } from '../theme';

export interface SummaryTableRow {
  key: string | number;
  name: string;
  /** Small grey text after the name (okey: why the points came out as they did). */
  why?: string;
  isMe?: boolean;
  isWinner?: boolean;
  cells: (string | number)[];
}

interface Props {
  /** First entry heads the name column, the rest head the value columns. */
  headers: string[];
  rows: SummaryTableRow[];
  /** Cell font size; okey uses 20, the generic summary passes a bigger one. */
  cellSize?: number;
}

/** The score table shared by okey's RoundResult and the generic round summary. */
export function SummaryTable({ headers, rows, cellSize = 20 }: Props) {
  return (
    <View style={styles.table}>
      <View style={styles.row}>
        {headers.map((h, i) => (
          <Text key={i} style={[styles.cell, styles.head, i === 0 && { flex: 2.4 }]}>{h}</Text>
        ))}
      </View>
      {rows.map((r) => (
        <View key={r.key} style={[styles.row, r.isWinner && styles.winnerRow]}>
          <Text style={[styles.cell, { flex: 2.4, fontSize: cellSize }]} numberOfLines={1}>
            <Text style={r.isMe ? { color: colors.accent } : undefined}>{r.name}</Text>
            {r.why !== undefined && <Text style={styles.why}>{`  ${r.why}`}</Text>}
          </Text>
          {r.cells.map((c, i) => (
            <Text key={i} style={[styles.cell, { fontSize: cellSize }]}>{c}</Text>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  table: { alignSelf: 'stretch' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 3, paddingHorizontal: 8, borderRadius: 8 },
  winnerRow: { backgroundColor: 'rgba(95,208,125,0.25)' },
  cell: { flex: 1, color: colors.text, fontSize: 20, fontWeight: '600' },
  why: { color: colors.muted, fontSize: 15, fontWeight: '400' },
  head: { color: colors.muted, fontWeight: '700', fontSize: font.small },
});
