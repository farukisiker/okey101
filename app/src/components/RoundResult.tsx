import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { DUZ_START_POINTS, NOT_OPENED_PENALTY, type PlayerView, type RoomInfo, matchOver } from '@okey/shared';
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
  const duz = view.mode === 'duz';
  const nameOf = (seat: number) => (seat === view.seat ? 'Sen' : view.players[seat].name);
  const iWon = r.winner === view.seat;
  const winner = r.winner === null ? null : nameOf(r.winner);
  const title = iWon ? 'Tebrikler, sen bitirdin!' : winner ? `${winner} bitirdi` : 'Taşlar bitti, el berabere';
  const notes = [r.okeyFinish && 'okeyle bitti', r.pairs && 'çiftle bitti', r.elden && 'elden bitti']
    .filter(Boolean)
    .join(', ');
  // Düz okey counts down from 20; whoever has the most left when someone hits zero wins the game.
  const over = matchOver(view.mode, room.totals);
  const left = room.totals.map((t) => DUZ_START_POINTS - t);
  const champion = left.indexOf(Math.max(...left));

  const explain = (seat: number) => {
    const p = view.players[seat];
    if (seat === r.winner) return 'bitirdi';
    if (duz) return seat === view.gosterge ? 'gösterge' : '';
    if (!p.opened) return `açamadı: ${NOT_OPENED_PENALTY * r.multiplier} ceza`;
    return 'elinde kalanlar';
  };

  return (
    <View style={styles.overlay}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          {over && (
            <Text style={styles.over}>
              Oyun bitti! {champion === view.seat ? 'Kazanan sensin' : `Kazanan: ${nameOf(champion)}`}
            </Text>
          )}
          {notes ? <Text style={styles.note}>{notes} — puanlar {r.multiplier} katı</Text> : null}
          <View style={styles.table}>
            <View style={styles.row}>
              <Text style={[styles.cell, styles.head, { flex: 2.4 }]}>Oyuncu</Text>
              <Text style={[styles.cell, styles.head]}>Bu el</Text>
              <Text style={[styles.cell, styles.head]}>{duz ? 'Kalan puan' : 'Toplam'}</Text>
            </View>
            {view.players.map((p) => {
              const me = p.seat === view.seat;
              return (
                <View key={p.seat} style={[styles.row, p.seat === r.winner && styles.winnerRow]}>
                  <Text style={[styles.cell, { flex: 2.4 }]} numberOfLines={1}>
                    <Text style={me ? { color: colors.accent } : undefined}>{me ? 'Sen' : p.name}</Text>
                    <Text style={styles.why}>{`  ${explain(p.seat)}`}</Text>
                  </Text>
                  <Text style={styles.cell}>{duz ? (r.scores[p.seat] ? `−${r.scores[p.seat]}` : '0') : r.scores[p.seat]}</Text>
                  <Text style={styles.cell}>{duz ? left[p.seat] : room.totals[p.seat]}</Text>
                </View>
              );
            })}
          </View>
          <Text style={styles.note}>
            {duz ? `Herkes ${DUZ_START_POINTS} puanla başlar; puanı ilk biten oyunu bitirir.` : 'Düşük puan iyidir.'}
          </Text>
          <View style={styles.buttons}>
            <Button title={over ? 'Yeni Oyun' : 'Sonraki El'} onPress={onNext} style={{ minWidth: 240, minHeight: 64 }} />
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
  over: { color: colors.text, fontSize: 22, fontWeight: '900', textAlign: 'center' },
  table: { alignSelf: 'stretch' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 3, paddingHorizontal: 8, borderRadius: 8 },
  winnerRow: { backgroundColor: 'rgba(95,208,125,0.25)' },
  cell: { flex: 1, color: colors.text, fontSize: 20, fontWeight: '600' },
  why: { color: colors.muted, fontSize: 15, fontWeight: '400' },
  head: { color: colors.muted, fontWeight: '700', fontSize: font.small },
});
