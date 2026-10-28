import { StyleSheet, Text, View } from 'react-native';
import type { PlayerView, RoomInfo } from '@okey/shared';
import { colors } from '../theme';
import { Button } from './Button';

interface Props {
  view: PlayerView;
  room: RoomInfo;
  onNext(): void;
  onLeave(): void;
}

export function RoundResult({ view, room, onNext, onLeave }: Props) {
  const r = view.result!;
  const winner = r.winner === null ? null : view.players[r.winner].name;
  const notes = [r.okeyFinish && 'okey ile bitti', r.elden && 'elden bitti'].filter(Boolean).join(', ');
  return (
    <View style={styles.overlay}>
      <View style={styles.card}>
        <Text style={styles.title}>{winner ? `${winner} bitirdi!` : 'Taşlar bitti, el berabere'}</Text>
        {notes ? <Text style={styles.note}>{notes} — puanlar x{r.multiplier}</Text> : null}
        <View style={styles.table}>
          <View style={styles.row}>
            <Text style={[styles.cell, styles.head, { flex: 2 }]}>Oyuncu</Text>
            <Text style={[styles.cell, styles.head]}>Bu el</Text>
            <Text style={[styles.cell, styles.head]}>Toplam</Text>
          </View>
          {view.players.map((p) => (
            <View key={p.seat} style={styles.row}>
              <Text style={[styles.cell, { flex: 2 }, p.seat === view.seat && { color: colors.accent }]}>
                {p.name}
                {!p.opened && p.seat !== r.winner ? ' (açamadı)' : ''}
              </Text>
              <Text style={styles.cell}>{r.scores[p.seat]}</Text>
              <Text style={styles.cell}>{room.totals[p.seat]}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.note}>Düşük puan kazanır.</Text>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button title="Sonraki El" onPress={onNext} />
          <Button title="Lobiye Dön" variant="secondary" onPress={onLeave} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 500,
  },
  card: { backgroundColor: colors.feltLight, borderRadius: 12, padding: 16, minWidth: 360, gap: 8, alignItems: 'center' },
  title: { color: colors.accent, fontSize: 20, fontWeight: '900' },
  note: { color: colors.muted, fontSize: 12 },
  table: { alignSelf: 'stretch' },
  row: { flexDirection: 'row', paddingVertical: 3 },
  cell: { flex: 1, color: colors.text, fontSize: 14 },
  head: { color: colors.muted, fontWeight: '700' },
});
