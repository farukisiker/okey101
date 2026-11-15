import { ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  DUZ_START_POINTS,
  NOT_OPENED_PENALTY,
  OKEY_IN_HAND_PENALTY,
  type PlayerView,
  type RoomInfo,
  handPenalty,
  matchOver,
} from '@okey/shared';
import { colors, font } from '../theme';
import { Button } from './Button';
import { SummaryTable } from './SummaryTable';
import { useRef, useState } from 'react';
import { adGate } from '../ads/interstitial';
import { shouldShowAtBreak } from '../ads/policy';
import { t } from '../i18n';

interface Props {
  view: PlayerView;
  room: RoomInfo;
  /** 101 only: the host says this round ended the match. */
  matchOver?: boolean;
  onNext(): void | Promise<void>;
  onLeave(): void;
}

export function RoundResult({ view, room, matchOver: matchEnded = false, onNext, onLeave }: Props) {
  const waiting = useRef(false);
  const [busy, setBusy] = useState(false);
  const r = view.result!;
  const duz = view.mode === 'duz';
  const nameOf = (seat: number) => (seat === view.seat ? t('you') : view.players[seat].name);
  const iWon = r.winner === view.seat;
  const winner = r.winner === null ? null : nameOf(r.winner);
  const title = r.cancelled
    ? t('handCancelled')
    : iWon
      ? t('youFinished')
      : winner
        ? t('actFinished', { name: winner })
        : t('tilesRanOut');
  const notes = [r.okeyFinish && t('okeyFinish'), r.pairs && t('pairsFinish'), r.elden && t('eldenFinish')]
    .filter(Boolean)
    .join(', ');
  // Düz okey counts down from 20; whoever has the most left when someone hits zero wins the game.
  const over = duz ? matchOver(view.mode, room.totals) : matchEnded;
  const proceed = async (leave: boolean) => {
    if (waiting.current) return;
    waiting.current = true;
    setBusy(true);
    try {
      // Bot flags live on RoomInfo.seats; PlayerView.players has no isBot field.
      const humans = room.seats.filter((p) => p && !p.isBot).length;
      if (shouldShowAtBreak(leave, over, humans)) await adGate.showIfEligible();
      if (leave) onLeave();
      else await onNext();
    } finally {
      waiting.current = false;
      setBusy(false);
    }
  };
  const left = room.totals.map((t) => DUZ_START_POINTS - t);
  const champion = duz ? left.indexOf(Math.max(...left)) : room.totals.indexOf(Math.min(...room.totals));
  // 101 match over: lowest total first.
  const standings = [...view.players].sort((a, b) => room.totals[a.seat] - room.totals[b.seat]);

  const explain = (seat: number) => {
    const p = view.players[seat];
    if (seat === r.winner) return t('finishedShort');
    if (duz) return seat === view.gosterge ? t('indicatorShort') : '';
    if (r.cancelled) return p.pairs ? t('pairLabel') : '';
    const extra = p.penalties ? ` +${p.penalties}` : '';
    if (!p.opened) return t('notOpenedPenalty', { n: NOT_OPENED_PENALTY * r.multiplier }) + extra;
    // "elinde kalanlar 23 ×2 +101 Okey": the tile sum, the round multiplier, then flat penalties.
    // A pairs opener ("çift · …") pays the tile sum twice over.
    const hand = view.revealedHands?.[seat];
    const tag = p.pairs ? `${t('pairLabel')} · ` : '';
    if (!hand) return tag + t('leftInHand');
    const { sum, okeys } = handPenalty(hand, view.okey);
    const times = r.multiplier * (p.pairs ? 2 : 1);
    const mult = times > 1 ? ` ×${times}` : '';
    const okey = okeys ? ` +${okeys * OKEY_IN_HAND_PENALTY} ${t('okeyLabel')}` : '';
    return `${tag}${t('leftInHand')} ${sum}${mult}${okey}${extra}`;
  };

  return (
    <View style={styles.overlay}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          {over && (
            <Text style={styles.over}>
              {t(duz ? 'gameOver' : 'matchOver')} {champion === view.seat ? t('youWon') : t('winnerIs', { name: nameOf(champion) })}
            </Text>
          )}
          {notes ? <Text style={styles.note}>{t('multiplied', { notes, n: r.multiplier })}</Text> : null}
          <SummaryTable
            headers={[t('player'), t('thisHand'), duz ? t('pointsLeft') : t('total')]}
            rows={view.players.map((p) => ({
              key: p.seat,
              name: p.seat === view.seat ? t('you') : p.name,
              why: explain(p.seat),
              isMe: p.seat === view.seat,
              isWinner: p.seat === r.winner,
              cells: [duz ? (r.scores[p.seat] ? `−${r.scores[p.seat]}` : '0') : r.scores[p.seat], duz ? left[p.seat] : room.totals[p.seat]],
            }))}
          />
          {over && !duz && (
            <View style={styles.standings}>
              <Text style={styles.head}>{t('standings')}</Text>
              {standings.map((p, i) => (
                <Text key={p.seat} style={[styles.standRow, p.seat === view.seat && { color: colors.accent }]}>
                  {`${i + 1}. ${nameOf(p.seat)} · ${room.totals[p.seat]}`}
                </Text>
              ))}
            </View>
          )}
          <Text style={styles.note}>
            {duz ? t('duzRule', { n: DUZ_START_POINTS }) : t('lowIsGood')}
          </Text>
          <View style={styles.buttons}>
            <Button title={over ? (duz ? t('newGame') : t('newMatch')) : t('nextHand')} disabled={busy} onPress={() => void proceed(false)} style={{ minWidth: 240, minHeight: 64 }} />
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
  standings: { alignItems: 'center', gap: 2 },
  standRow: { color: colors.text, fontSize: 22, fontWeight: '700' },
  head: { color: colors.muted, fontWeight: '700', fontSize: font.small },
});
