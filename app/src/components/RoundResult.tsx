import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { NOT_OPENED_PENALTY, type PlayerView, type RoomInfo } from '@okey/shared';
import { colors, font } from '../theme';
import { Button } from './Button';

interface Props {
  view: PlayerView;
  room: RoomInfo;
  onNext(): void;
  onLeave(): void;
}

export function RoundResult({ view, room, onNext, onLeave }: Props) {
  const r = view.result!;
  const iWon = r.winner === view.seat;
  const winner = r.winner === null ? null : r.winner === view.seat ? 'Sen' : view.players[r.winner].name;
  const title = iWon ? 'Tebrikler, sen bitirdin!' : winner ? `${winner} bitirdi` : 'Taşlar bitti, el berabere';
  const notes = [r.okeyFinish && 'okeyle bitti', r.elden && 'elden bitti'].filter(Boolean).join(', ');

  const explain = (seat: number) => {
    const p = view.players[seat];
    if (seat === r.winner) return 'bitirdi';
    if (!p.opened) return `açamadı: ${NOT_OPENED_PENALTY * r.multiplier} ceza`;
    return 'elinde kalanlar';
  };

  return (
    <View style={styles.overlay}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          {notes ? <Text style={styles.note}>{notes} — puanlar {r.multiplier} katı</Text> : null}
          <View style={styles.table}>
            <View style={styles.row}>
              <Text style={[styles.cell, styles.head, { flex: 2.4 }]}>Oyuncu</Text>
              <Text style={[styles.cell, styles.head]}>Bu el</Text>
              <Text style={[styles.cell, styles.head]}>Toplam</Text>
            </View>
            {view.players.map((p) => {
              const me = p.seat === view.seat;
              return (
                <View key={p.seat} style={[styles.row, p.seat === r.winner && styles.winnerRow]}>
                  <Text style={[styles.cell, { flex: 2.4 }]} numberOfLines={1}>
                    <Text style={me ? { color: colors.accent } : undefined}>{me ? 'Sen' : p.name}</Text>
                    <Text style={styles.why}>{`  ${explain(p.seat)}`}</Text>
                  </Text>
                  <Text style={styles.cell}>{r.scores[p.seat]}</Text>
                  <Text style={styles.cell}>{room.totals[p.seat]}</Text>
                </View>
              );
            })}
          </View>
          <Text style={styles.note}>Düşük puan iyidir.</Text>
          <View style={styles.buttons}>
            <Button title="Sonraki El" onPress={onNext} style={{ minWidth: 240, minHeight: 64 }} />
            <Button title="Masadan kalk" variant="secondary" onPress={onLeave} />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.7)',
    zIndex: 500,
  },
  scroll: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 12 },
  card: { backgroundColor: colors.feltLight, borderRadius: 16, padding: 14, width: '80%', maxWidth: 720, gap: 6, alignItems: 'center' },
  buttons: { flexDirection: 'row', gap: 20, alignItems: 'center', marginTop: 4 },
  title: { color: colors.accent, fontSize: 26, fontWeight: '900', textAlign: 'center' },
  note: { color: colors.muted, fontSize: font.small },
  table: { alignSelf: 'stretch' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 3, paddingHorizontal: 8, borderRadius: 8 },
  winnerRow: { backgroundColor: 'rgba(95,208,125,0.25)' },
  cell: { flex: 1, color: colors.text, fontSize: 20, fontWeight: '600' },
  why: { color: colors.muted, fontSize: 15, fontWeight: '400' },
  head: { color: colors.muted, fontWeight: '700', fontSize: font.small },
});
