import { useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, StyleSheet, Text, View } from 'react-native';
import { colors, font } from '../theme';
import { t } from '../i18n';
import { isSoundOn, setSoundOn } from '../feedback';
import { Button } from '../components/Button';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { GameShell, type RoundSummary } from '../components/GameShell';
import type { RoomInfo } from '@okey/shared';
import type { PistiAction, PistiView } from '@kahve/catalog';
import { hasPistiChance } from '../components/cards/pistiChance';
import { cardSummary } from '../net/cardSummary';
import { type HostTimes, msLeftNow } from '../net/localHost';
import {
  type Card,
  CardOpponentPanel,
  CompactCenterRow,
  opponentOrder,
  Hand,
  PistiCenterPile,
  cardPlayFeedback,
  cardTakeFeedback,
  sortCards,
  useCardLayout,
} from '../components/cards';

export interface PistiScreenProps {
  /** The engine's PistiView plus the host's times (turnMsLeft, noticeMsLeft). */
  view: PistiView & HostTimes;
  /** Epoch ms when `view` arrived (the countdown runs from here). Missing: now. */
  viewAt?: number;
  /** The table: totals, bots, connections. Missing (preview): totals are this hand's scores. */
  room?: RoomInfo | null;
  seat: number;
  /** End-of-hand summary from useKahveGame (one object per hand). Missing: built from the view. */
  summary?: RoundSummary | null;
  /** People at the table, for the ad break rule. */
  humanCount?: number;
  onAction(action: PistiAction): void | Promise<unknown>;
  /** Next hand, or a new match after the last one. */
  onNextRound?(): void | Promise<unknown>;
  onLeave?(): void;
}

/** A player as the panels draw them: the engine's public data plus the table's totals and connection. */
function playersOf(view: PistiView, room: RoomInfo | null | undefined) {
  return view.players.map((p) => ({
    ...p,
    totalScore: room?.totals[p.seat] ?? 0,
    connected: room?.seats[p.seat]?.connected ?? true,
    isBot: room?.seats[p.seat]?.isBot ?? false,
  }));
}

/**
 * Pişti game screen embedded in GameShell.
 * 2 or 4 players, central pile, opponent panels, action bar, and two-tap hand.
 */
export function PistiScreen({ view, viewAt, room, seat, summary: summaryProp, humanCount, onAction, onNextRound, onLeave }: PistiScreenProps) {
  const [sound, setSound] = useState(isSoundOn());
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState<number | null>(null);
  const [handOrder, setHandOrder] = useState<Card[]>(view.hand);

  // Sync hand cards while keeping custom arrangement if ids match
  useEffect(() => {
    setHandOrder((prev) => {
      const currentIds = new Set(view.hand.map((c) => c.id));
      const kept = prev.filter((c) => currentIds.has(c.id));
      const keptIds = new Set(kept.map((c) => c.id));
      const added = view.hand.filter((c) => !keptIds.has(c.id));
      return [...kept, ...added];
    });
  }, [view.hand]);

  // Android back asks before leaving the table (a second press closes the question).
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setShowExitConfirm((open) => !open);
      return true;
    });
    return () => sub.remove();
  }, []);

  // A capture that happened with the last card played (views arrive as new objects, so compare by move).
  const freshCapture =
    view.lastCapture && view.lastAction && view.lastAction.card.id === view.lastCapture.cardId ? view.lastCapture : null;
  const captureKey = freshCapture ? `${view.round}:${view.lastAction!.turnNumber}` : null;

  // Audio feedback on card captures and Pişti events
  const lastCaptureRef = useRef(captureKey);
  useEffect(() => {
    if (captureKey && captureKey !== lastCaptureRef.current && freshCapture) cardTakeFeedback(freshCapture.isPisti);
    lastCaptureRef.current = captureKey;
    // freshCapture belongs to captureKey.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [captureKey]);

  // The turn clock, counted down here once a second from the host's turnMsLeft.
  const arrived = viewAt ?? 0;
  const [now, setNow] = useState(() => Date.now());
  const clockOn = view.phase === 'playing' && view.turnMsLeft != null;
  useEffect(() => {
    setNow(Date.now());
    if (!clockOn) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [clockOn, view]);
  const msLeft = msLeftNow(view, arrived || now, now);
  const turnSeconds = msLeft == null ? null : Math.max(0, Math.ceil(msLeft / 1000));

  const players = useMemo(() => playersOf(view, room), [view, room]);
  const isMyTurn = view.turn === seat && view.phase === 'playing';
  const myPlayer = useMemo(() => players.find((p) => p.seat === seat), [players, seat]);
  const opponents = useMemo(() => {
    const rank = opponentOrder(seat, players.length);
    return players.filter((p) => p.seat !== seat).sort((a, b) => rank.indexOf(a.seat) - rank.indexOf(b.seat));
  }, [players, seat]);
  const activePlayer = useMemo(() => players.find((p) => p.seat === view.turn), [players, view.turn]);
  const layout = useCardLayout(handOrder.length);

  // Cards that capture the middle pile (same rank as top card or Jack)
  const highlightedCardIds = useMemo(() => {
    if (!view.topCard) return [];
    return handOrder
      .filter((c) => c.rank === view.topCard!.rank || c.rank === 11)
      .map((c) => c.id);
  }, [handOrder, view.topCard]);

  // Clear selection if selected card becomes unplayable
  useEffect(() => {
    if (selectedCardId != null && !view.playableCardIds.includes(selectedCardId)) {
      setSelectedCardId(null);
    }
  }, [view.playableCardIds, selectedCardId]);

  const isSelectedPlayable =
    selectedCardId != null && isMyTurn && view.playableCardIds.includes(selectedCardId);

  const handlePlayCard = (cardId: number) => {
    if (!isMyTurn || !view.playableCardIds.includes(cardId)) return;
    cardPlayFeedback();
    setSelectedCardId(null);
    onAction({ type: 'play', cardId });
  };

  const handleSort = () => {
    setHandOrder((prev) => sortCards(prev));
  };

  const handleToggleSound = () => {
    const next = !sound;
    setSound(next);
    setSoundOn(next);
  };

  // Status line displayed in GameShell header
  let statusText = '';
  if (freshCapture?.isPisti) {
    statusText = freshCapture.isJackPisti
      ? `${t('pistiPistiDouble')} (+${freshCapture.points})`
      : `${t('pistiPisti')} (+${freshCapture.points})`;
  } else if (isMyTurn) {
    statusText = t('cardsYourTurn');
  } else if (activePlayer) {
    statusText = t('cardsWaitingTurn', { name: activePlayer.name });
  } else {
    statusText = t('cardsWaitingOpponent');
  }

  // Round summary for GameShell: the hook's (one object per hand); the preview builds one from the view.
  const fallbackSummary = useMemo<RoundSummary | null>(() => {
    if (summaryProp !== undefined || !view.result) return null;
    return cardSummary({
      names: players.map((p) => p.name),
      points: view.result.scores,
      totals: room?.totals ?? view.result.scores,
      matchOver: room?.matchOver ?? false,
      teams: players.map((p) => p.team),
      mySeat: seat,
      you: t('you'),
    });
  }, [summaryProp, view.result, players, room, seat]);
  const summary = summaryProp !== undefined ? summaryProp : fallbackSummary;

  const secondsLeft = isMyTurn ? turnSeconds : null;
  const next = async () => {
    await onNextRound?.();
  };

  const deckBadge = (
    <View style={layout.compact ? styles.deckBadgeCompact : styles.deckBadge}>
      <Text style={styles.deckText}>{t('pistiDeckCount', { n: view.deckCount })}</Text>
    </View>
  );
  const hintLabel = `${t('pistiCapturedCount', { n: myPlayer?.capturedCount ?? 0 })} · ${t('pistiCount', { n: myPlayer?.pistiCount ?? 0 })} · ${t('pistiYourScore', { n: myPlayer?.totalScore ?? 0 })}`;
  const sortButton = <Button title={t('cardsSort')} onPress={handleSort} variant="secondary" style={styles.actionBtn} />;
  const playButton = (
    <Button
      title={t('cardsPlay')}
      onPress={() => isSelectedPlayable && handlePlayCard(selectedCardId!)}
      disabled={!isSelectedPlayable}
      variant="primary"
      style={styles.actionBtn}
    />
  );
  const centerPile = (
    <PistiCenterPile
      topCard={view.topCard}
      centerCount={view.centerCount}
      pistiChance={hasPistiChance(view.topCard, view.centerCount, handOrder)}
      cardWidth={layout.centerPileCardWidth}
      badgeBeside={layout.compact}
      onPress={isSelectedPlayable ? () => handlePlayCard(selectedCardId!) : undefined}
    />
  );

  return (
    <View style={styles.root}>
      <GameShell
        gameId="pisti"
        title={t('game.pisti')}
        secondsLeft={secondsLeft}
        muted={!sound}
        onToggleSound={handleToggleSound}
        onExit={() => setShowExitConfirm(true)}
        status={statusText}
        summary={summary}
        mySeat={seat}
        humanCount={humanCount ?? (players.filter((p) => !p.isBot).length || 1)}
        onNextHand={next}
        onNewMatch={next}
        onLeaveTable={() => onLeave?.()}
        opponents={
          <View style={styles.opponentsRow}>
            {opponents.map((opp) => {
              const oppSeconds = view.turn === opp.seat ? turnSeconds : null;

              return (
                <CardOpponentPanel
                  key={opp.seat}
                  seat={opp.seat}
                  name={opp.name}
                  active={view.turn === opp.seat}
                  handCount={opp.handCount}
                  capturedCount={opp.capturedCount}
                  pistiCount={opp.pistiCount}
                  totalScore={opp.totalScore}
                  isPartner={myPlayer?.team != null && opp.team === myPlayer.team}
                  secondsLeft={oppSeconds}
                  connected={opp.connected}
                  compact={layout.compact}
                  width={layout.compact ? undefined : layout.oppPanelWidth}
                  height={layout.compact ? undefined : layout.oppPanelHeight}
                />
              );
            })}
          </View>
        }
      >
        <View style={styles.tableArea}>
          {layout.compact ? (
            <CompactCenterRow
              insetLeft={layout.insets.left}
              insetRight={layout.insets.right}
              left={
                <>
                  {deckBadge}
                  {sortButton}
                </>
              }
              right={
                <>
                  <Text style={[styles.hintText, styles.hintSide]} numberOfLines={2}>{hintLabel}</Text>
                  {playButton}
                </>
              }
            >
              {centerPile}
            </CompactCenterRow>
          ) : (
            <>
              {deckBadge}
              <View style={styles.centerSection}>{centerPile}</View>
              <View style={[styles.actionBar, { height: layout.actionBarHeight }]}>
                {sortButton}
                <View style={styles.actionHint}>
                  <Text style={styles.hintText} numberOfLines={1}>{hintLabel}</Text>
                </View>
                {playButton}
              </View>
            </>
          )}

          {/* Hand cards */}
          <Hand
            cards={handOrder}
            cardWidth={layout.cardWidth}
            cardStep={layout.cardStep}
            selectedCardId={selectedCardId}
            canPlay={isMyTurn}
            dimUnplayable={isMyTurn}
            playableCardIds={view.playableCardIds}
            highlightedCardIds={highlightedCardIds}
            onSelectCard={setSelectedCardId}
            onPlayCard={handlePlayCard}
            bleedLeft={layout.insets.left}
            bleedRight={layout.insets.right}
            bleedBottom={layout.insets.bottom}
          />
        </View>
      </GameShell>

      {showExitConfirm && (
        <ConfirmDialog
          message={t('cardsLeaveConfirm')}
          confirm={t('leave')}
          cancel={t('sideTakeNo')}
          onConfirm={() => {
            setShowExitConfirm(false);
            onLeave?.();
          }}
          onCancel={() => setShowExitConfirm(false)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.felt,
  },
  opponentsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  tableArea: {
    flex: 1,
    justifyContent: 'space-between',
  },
  deckBadge: {
    position: 'absolute',
    top: 12,
    left: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    zIndex: 5,
  },
  deckBadgeCompact: {
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  hintSide: { textAlign: 'right' },
  deckText: {
    color: colors.muted,
    fontSize: font.small,
    fontWeight: '700',
  },
  centerSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    gap: 8,
  },
  actionBtn: {
    minWidth: 120,
    minHeight: 56,
  },
  actionHint: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hintText: {
    color: colors.text,
    fontSize: font.small,
    fontWeight: '800',
    textAlign: 'center',
  },
});
