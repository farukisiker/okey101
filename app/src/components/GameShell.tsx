import { type ReactNode, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import type { GameId } from '@kahve/core';
import { adGate } from '../ads/interstitial';
import { shouldShowAtBreak } from '../ads/policy';
import { t } from '../i18n';
import { colors, font } from '../theme';
import { Button } from './Button';
import { SummaryTable } from './SummaryTable';
import { type RoundSummary, summaryHeadlineText, summaryLabels } from './roundSummary';
import { COMPACT_BAR_HEIGHT, COMPACT_OPPONENTS_HEIGHT, clockA11ySeconds, isCompactShell } from './shellBudget';

export type { RoundSummary, RoundSummaryRow } from './roundSummary';
export { summaryHeadline } from './roundSummary';

export interface GameShellProps {
  gameId: GameId;
  /** Already translated game name. */
  title: string;
  /** Turn clock of the person to move; null/undefined hides it. */
  secondsLeft?: number | null;
  muted: boolean;
  onToggleSound(): void;
  onExit(): void;
  /** Opponent panels strip. */
  opponents?: ReactNode;
  /** One line under the strip, e.g. "Sıra sende". */
  status?: string;
  /** Set when a hand has just ended; shows the big summary. */
  summary?: RoundSummary | null;
  /** Seat of the local player, to name the winner. */
  mySeat?: number;
  /** People (not bots) at the table; one person alone may see an ad after any hand. Default 1. */
  humanCount?: number;
  onNextHand?(): void | Promise<void>;
  onNewMatch?(): void | Promise<void>;
  onLeaveTable(): void;
  /** NoticePanel goes here; it is drawn above the summary overlay and never blocks touches. */
  notice?: ReactNode;
  /** The game area. */
  children: ReactNode;
}

/**
 * Common frame for card and board screens: top bar, opponents, status line, game area,
 * round summary and notices. It counts every finished hand once with adGate and shows an
 * interstitial only at natural breaks (see shouldShowAtBreak). Okey's own GameScreen is not on it.
 */
export function GameShell(p: GameShellProps) {
  const { summary } = p;
  // B12: on short windows (phones in landscape) the status line moves into the top bar and the opponents get one row.
  const compact = isCompactShell(useWindowDimensions().height);
  const counted = useRef<RoundSummary | null>(null);
  const waiting = useRef(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (summary && counted.current !== summary) {
      counted.current = summary;
      adGate.onHandCompleted(p.gameId);
    }
    if (!summary) counted.current = null;
  }, [summary, p.gameId]);

  const proceed = async (kind: 'next' | 'leave') => {
    if (waiting.current || !summary) return;
    waiting.current = true;
    setBusy(true);
    try {
      if (shouldShowAtBreak(kind === 'leave', summary.matchOver, p.humanCount ?? 1)) await adGate.showIfEligible();
      if (kind === 'leave') p.onLeaveTable();
      else if (summary.matchOver) await p.onNewMatch?.();
      else await p.onNextHand?.();
    } finally {
      waiting.current = false;
      setBusy(false);
    }
  };

  let headline = '';
  if (summary) {
    const head = summaryHeadlineText(summary, p.mySeat ?? -1);
    headline = t(head.key, head.vars);
  }

  return (
    <View style={styles.root}>
      <View style={[styles.bar, compact && styles.barCompact]}>
        <Button title={t('leave')} variant="secondary" onPress={p.onExit} style={styles.barBtn} />
        {compact ? (
          <Text
            style={styles.statusInBar}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
            accessibilityLiveRegion="polite"
            accessibilityLabel={p.status ? `${p.title}. ${p.status}` : p.title}
          >
            {p.status || p.title}
          </Text>
        ) : (
          <Text style={styles.title} numberOfLines={1}>{p.title}</Text>
        )}
        {p.secondsLeft != null && (
          // The digits change every second; screen readers (and uiautomator's idle wait) get a label that
          // changes only every 10 s, and the ticking text itself is hidden from accessibility.
          <View accessible accessibilityLabel={t('timeLeftA11y', { n: clockA11ySeconds(p.secondsLeft) })}>
            <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
              <Text style={[styles.clock, p.secondsLeft <= 5 && { color: colors.danger }]}>{`⏱ ${p.secondsLeft}`}</Text>
            </View>
          </View>
        )}
        <Button title={p.muted ? '🔇' : '🔊'} variant="secondary" onPress={p.onToggleSound} style={styles.barBtn} />
      </View>
      {p.opponents ? <View style={[styles.opponents, compact && styles.opponentsCompact]}>{p.opponents}</View> : null}
      {!compact && p.status ? <Text style={styles.status} accessibilityLiveRegion="polite">{p.status}</Text> : null}
      <View style={styles.area}>{p.children}</View>

      {summary && (
        <View style={styles.overlay}>
          <ScrollView contentContainerStyle={styles.scroll}>
            <View style={styles.card}>
              <Text style={styles.headline}>{headline}</Text>
              {summary.note ? <Text style={styles.note}>{summary.note}</Text> : null}
              <SummaryTable
                cellSize={font.status}
                headers={[t('player'), t(summaryLabels(summary).thisHand), t('total')]}
                rows={summary.rows.map((r) => ({
                  key: r.seat,
                  name: !r.seats && r.seat === p.mySeat ? t('you') : r.name,
                  isMe: r.seats ? r.seats.includes(p.mySeat ?? -1) : r.seat === p.mySeat,
                  isWinner: summary.winnerSeats.includes(r.seat),
                  cells: [r.points, r.total],
                }))}
              />
              <View style={styles.buttons}>
                <Button
                  title={t(summaryLabels(summary).next)}
                  disabled={busy}
                  onPress={() => void proceed('next')}
                  style={{ minWidth: 240, minHeight: 64 }}
                />
                <Button title={t('leaveTable')} disabled={busy} variant="secondary" onPress={() => void proceed('leave')} />
              </View>
            </View>
          </ScrollView>
        </View>
      )}
      {p.notice ? <View style={styles.notice} pointerEvents="box-none">{p.notice}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.felt },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 6 },
  barCompact: { paddingVertical: 2, height: COMPACT_BAR_HEIGHT },
  statusInBar: { flex: 1, color: colors.text, fontSize: font.status, fontWeight: '800', textAlign: 'center' },
  barBtn: { minHeight: 56, minWidth: 56 },
  title: { flex: 1, color: colors.accent, fontSize: font.status, fontWeight: '900' },
  clock: { color: colors.text, fontSize: font.status, fontWeight: '800' },
  opponents: { flexDirection: 'row', justifyContent: 'center', gap: 8, paddingHorizontal: 8 },
  opponentsCompact: { height: COMPACT_OPPONENTS_HEIGHT, alignItems: 'center', paddingHorizontal: 8 },
  status: { color: colors.text, fontSize: font.status, fontWeight: '700', textAlign: 'center', paddingVertical: 4 },
  area: { flex: 1 },
  overlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 500 },
  scroll: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 12 },
  card: { backgroundColor: colors.feltLight, borderRadius: 16, padding: 16, width: '85%', maxWidth: 720, gap: 10, alignItems: 'center' },
  headline: { color: colors.accent, fontSize: 30, fontWeight: '900', textAlign: 'center' },
  note: { color: colors.text, fontSize: 20, fontWeight: '800', textAlign: 'center' },
  buttons: { flexDirection: 'row', gap: 20, alignItems: 'center', marginTop: 8, flexWrap: 'wrap', justifyContent: 'center' },
  notice: { ...StyleSheet.absoluteFill, zIndex: 600 },
});
