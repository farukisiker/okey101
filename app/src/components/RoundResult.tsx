import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { DUZ_START_POINTS, NOT_OPENED_PENALTY, type PlayerView, type RoomInfo, matchOver } from '@okey/shared';
import { colors, font } from '../theme';
import { Button } from './Button';
import { useRef, useState } from 'react';
import { adGate } from '../ads/interstitial';
import { t } from '../i18n';

interface Props {
  view: PlayerView;
  room: RoomInfo;
  onNext(): void | Promise<void>;
  onLeave(): void;
}

export function RoundResult({ view, room, onNext, onLeave }: Props) {
  const waiting = useRef(false);
  const [busy, setBusy] = useState(false);
  const r = view.result!;
  const duz = view.mode === 'duz';
  const nameOf = (seat: number) => (seat === view.seat ? t('you') : view.players[seat].name);
  const iWon = r.winner === view.seat;
  const winner = r.winner === null ? null : nameOf(r.winner);
  const title = iWon ? t('youFinished') : winner ? t('actFinished', { name: winner }) : t('tilesRanOut');
  const notes = [r.okeyFinish && t('okeyFinish'), r.pairs && t('pairsFinish'), r.elden && t('eldenFinish')]
    .filter(Boolean)
    .join(', ');
  // Düz okey counts down from 20; whoever has the most left when someone hits zero wins the game.
  const over = matchOver(view.mode, room.totals);
  const proceed = async (leave: boolean) => {
    if (waiting.current) return;
    waiting.current = true;
    setBusy(true);
    try {
      // Bot flags live on RoomInfo.seats; PlayerView.players has no isBot field.
      const humans = room.seats.filter((p) => p && !p.isBot).length;
      if (leave || over || humans <= 1) await adGate.showIfEligible();
      if (leave) onLeave();
      else await onNext();
    } finally {
      waiting.current = false;
      setBusy(false);
    }
  };
  const left = room.totals.map((t) => DUZ_START_POINTS - t);
  const champion = left.indexOf(Math.max(...left));

  const explain = (seat: number) => {
    const p = view.players[seat];
    if (seat === r.winner) return t('finishedShort');
    if (duz) return seat === view.gosterge ? t('indicatorShort') : '';
    if (!p.opened) return t('notOpenedPenalty', { n: NOT_OPENED_PENALTY * r.multiplier });
    return t('leftInHand');
  };

  return (
    <View style={styles.overlay}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          {over && (
            <Text style={styles.over}>
              {t('gameOver')} {champion === view.seat ? t('youWon') : t('winnerIs', { name: nameOf(champion) })}
            </Text>
          )}
          {notes ? <Text style={styles.note}>{t('multiplied', { notes, n: r.multiplier })}</Text> : null}
          <View style={styles.table}>
            <View style={styles.row}>
              <Text style={[styles.cell, styles.head, { flex: 2.4 }]}>{t('player')}</Text>
              <Text style={[styles.cell, styles.head]}>{t('thisHand')}</Text>
              <Text style={[styles.cell, styles.head]}>{duz ? t('pointsLeft') : t('total')}</Text>
            </View>
            {view.players.map((p) => {
              const me = p.seat === view.seat;
              return (
                <View key={p.seat} style={[styles.row, p.seat === r.winner && styles.winnerRow]}>
                  <Text style={[styles.cell, { flex: 2.4 }]} numberOfLines={1}>
                    <Text style={me ? { color: colors.accent } : undefined}>{me ? t('you') : p.name}</Text>
                    <Text style={styles.why}>{`  ${explain(p.seat)}`}</Text>
                  </Text>
                  <Text style={styles.cell}>{duz ? (r.scores[p.seat] ? `−${r.scores[p.seat]}` : '0') : r.scores[p.seat]}</Text>
                  <Text style={styles.cell}>{duz ? left[p.seat] : room.totals[p.seat]}</Text>
                </View>
              );
            })}
          </View>
          <Text style={styles.note}>
            {duz ? t('duzRule', { n: DUZ_START_POINTS }) : t('lowIsGood')}
          </Text>
          <View style={styles.buttons}>
            <Button title={over ? t('newGame') : t('nextHand')} disabled={busy} onPress={() => void proceed(false)} style={{ minWidth: 240, minHeight: 64 }} />
            <Button title={t('leaveTable')} disabled={busy} variant="secondary" onPress={() => void proceed(true)} />
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
