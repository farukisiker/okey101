import { useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, StyleSheet, Text, View } from 'react-native';
import { colors, font } from '../theme';
import { t } from '../i18n';
import { isSoundOn, setSoundOn } from '../feedback';
import { Button } from '../components/Button';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { GameShell, type RoundSummary } from '../components/GameShell';
import type { RoomInfo } from '@okey/shared';
import type { BatakAction, BatakView } from '@kahve/catalog';
import { cardSummary } from '../net/cardSummary';
import { type HostTimes, msLeftNow } from '../net/localHost';
import {
  BidDialog,
  type Card,
  CardOpponentPanel,
  Hand,
  TrickArea,
  TrumpDialog,
  cardPlayFeedback,
  cardTakeFeedback,
  sortCards,
  suitSymbol,
  useCardLayout,
} from '../components/cards';

export interface BatakScreenProps {
  /** The engine's BatakView plus the host's times (turnMsLeft, noticeMsLeft). */
  view: BatakView & HostTimes;
  /** Epoch ms when `view` arrived (the countdown runs from here). Missing: now. */
  viewAt?: number;
  /** The table: totals, bots, connections. Missing (preview): totals are this hand's scores. */
  room?: RoomInfo | null;
  seat: number;
  /** End-of-hand summary from useKahveGame (one object per hand). Missing: built from the view. */
  summary?: RoundSummary | null;
  /** People at the table, for the ad break rule. */
  humanCount?: number;
  onAction(action: BatakAction): void | Promise<unknown>;
  /** Next hand, or a new match after the last one. */
  onNextRound?(): void | Promise<unknown>;
  onLeave?(): void;
}

/** A player as the panels draw them: the engine's public data plus the table's totals and connection. */
function playersOf(view: BatakView, room: RoomInfo | null | undefined) {
  return view.players.map((p) => ({
    ...p,
    totalScore: room?.totals[p.seat] ?? 0,
    connected: room?.seats[p.seat]?.connected ?? true,
    isBot: room?.seats[p.seat]?.isBot ?? false,
  }));
}

/**
 * Batak (single-player bidding) game screen embedded in GameShell.
 * 4 seats, compass trick area, bidding dialog, trump dialog, and action bar.
 */
export function BatakScreen({ view, viewAt, room, seat, summary: summaryProp, humanCount, onAction, onNextRound, onLeave }: BatakScreenProps) {
  const [sound, setSound] = useState(isSoundOn());
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState<number | null>(null);
  const [handOrder, setHandOrder] = useState<Card[]>(view.hand);

  // Sync hand cards while keeping custom order
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

  // Audio feedback once per finished trick (views arrive as new objects, so count tricks; silent without sound files)
  const trickKey = `${view.round}:${view.tricks.length}`;
  const trickKeyRef = useRef(trickKey);
  useEffect(() => {
    if (trickKey !== trickKeyRef.current && view.tricks.length > 0) cardTakeFeedback(false);
    trickKeyRef.current = trickKey;
    // view.tricks belongs to trickKey.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trickKey]);

  // The turn clock, counted down here once a second from the host's turnMsLeft.
  const arrived = viewAt ?? 0;
  const [now, setNow] = useState(() => Date.now());
  const clockOn = view.phase !== 'finished' && view.turnMsLeft != null;
  useEffect(() => {
    setNow(Date.now());
    if (!clockOn) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [clockOn, view]);
  const msLeft = msLeftNow(view, arrived || now, now);
  const turnSeconds = msLeft == null ? null : Math.max(0, Math.ceil(msLeft / 1000));

  // The trick on the table; between tricks the finished one stays in view until the next card is led.
  const shownTrick =
    view.currentTrick.length || view.phase !== 'playing' || !view.lastTrick ? view.currentTrick : view.lastTrick.cards;

  const players = useMemo(() => playersOf(view, room), [view, room]);
  const isMyTurn = view.turn === seat;
  const isPlayingTurn = isMyTurn && view.phase === 'playing';
  const myPlayer = useMemo(() => players.find((p) => p.seat === seat), [players, seat]);
  const opponents = useMemo(() => players.filter((p) => p.seat !== seat), [players, seat]);
  const activePlayer = useMemo(() => players.find((p) => p.seat === view.turn), [players, view.turn]);
  const highestBidder = useMemo(
    () => (view.highestBidder != null ? players.find((p) => p.seat === view.highestBidder) : null),
    [players, view.highestBidder],
  );
  const layout = useCardLayout(handOrder.length);

  // Clear selection if selected card becomes illegal
  useEffect(() => {
    if (selectedCardId != null && !view.legalCardIds.includes(selectedCardId)) {
      setSelectedCardId(null);
    }
  }, [view.legalCardIds, selectedCardId]);

  const isSelectedLegal =
    selectedCardId != null && isPlayingTurn && view.legalCardIds.includes(selectedCardId);

  const handlePlayCard = (cardId: number) => {
    if (!isPlayingTurn || !view.legalCardIds.includes(cardId)) return;
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

  // Status line for GameShell header
  let statusText = '';
  if (view.phase === 'bidding') {
    statusText = isMyTurn
      ? t('batakBidTitle')
      : t('cardsWaitingTurn', { name: activePlayer?.name ?? '' });
  } else if (view.phase === 'selectingTrump') {
    statusText = isMyTurn
      ? t('batakSelectTrumpTitle')
      : t('cardsWaitingTurn', { name: activePlayer?.name ?? '' });
  } else if (isPlayingTurn) {
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
      mySeat: seat,
      you: t('you'),
    });
  }, [summaryProp, view.result, players, room, seat]);
  const summary = summaryProp !== undefined ? summaryProp : fallbackSummary;

  const secondsLeft = isMyTurn ? turnSeconds : null;
  const next = async () => {
    await onNextRound?.();
  };

  const trumpName = view.trump
    ? `${suitSymbol(view.trump)} ${
        view.trump === 'S'
          ? t('suitSpades')
          : view.trump === 'H'
            ? t('suitHearts')
            : view.trump === 'D'
              ? t('suitDiamonds')
              : t('suitClubs')
      }`
    : t('batakTrumpNone');

  return (
    <View style={styles.root}>
      <GameShell
        gameId="batak"
        title={t('game.batak')}
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
                  name={opp.name}
                  active={view.turn === opp.seat}
                  handCount={opp.handCount}
                  tricksWon={opp.tricksWon}
                  bid={opp.bid}
                  passed={opp.passed}
                  isDeclarer={(view.declarer ?? view.highestBidder) === opp.seat}
                  totalScore={opp.totalScore}
                  secondsLeft={oppSeconds}
                  connected={opp.connected}
                  width={layout.oppPanelWidth}
                  height={layout.oppPanelHeight}
                />
              );
            })}
          </View>
        }
      >
        <View style={styles.tableArea}>
          {/* Top badges: Trump & Contract */}
          <View style={styles.topInfoRow}>
            <View style={styles.infoBadge}>
              <Text style={styles.infoBadgeLabel}>{t('batakTrump', { suit: trumpName })}</Text>
            </View>

            {highestBidder && view.highestBid > 0 && (
              <View style={styles.infoBadge}>
                <Text style={styles.infoBadgeLabel}>
                  {t('batakContract', { name: highestBidder.name, n: view.highestBid })}
                </Text>
              </View>
            )}
          </View>

          {/* Central trick area */}
          <View style={styles.centerSection}>
            <TrickArea
              currentTrick={shownTrick}
              players={players}
              mySeat={seat}
              cardWidth={layout.trickCardWidth}
            />
          </View>

          {/* Action bar */}
          <View style={[styles.actionBar, { height: layout.actionBarHeight }]}>
            <Button
              title={t('cardsSort')}
              onPress={handleSort}
              variant="secondary"
              style={styles.actionBtn}
            />

            <View style={styles.actionHint}>
              <Text style={styles.hintText} numberOfLines={1}>
                {`${t('batakTricksWon', { n: myPlayer?.tricksWon ?? 0 })}${myPlayer?.bid != null && myPlayer.bid > 0 ? ` / ${myPlayer.bid}` : myPlayer?.passed ? ` (${t('batakPass')})` : ''} · ${t('cardsPoints', { n: myPlayer?.totalScore ?? 0 })}`}
              </Text>
            </View>

            <Button
              title={t('cardsPlay')}
              onPress={() => isSelectedLegal && handlePlayCard(selectedCardId!)}
              disabled={!isSelectedLegal}
              variant="primary"
              style={styles.actionBtn}
            />
          </View>

          {/* Hand cards */}
          <Hand
            cards={handOrder}
            cardWidth={layout.cardWidth}
            cardStep={layout.cardStep}
            selectedCardId={selectedCardId}
            canPlay={isPlayingTurn}
            playableCardIds={view.legalCardIds}
            onSelectCard={setSelectedCardId}
            onPlayCard={handlePlayCard}
            bleedLeft={layout.insets.left}
            bleedRight={layout.insets.right}
            bleedBottom={layout.insets.bottom}
          />
        </View>
      </GameShell>

      {/* Bidding dialog */}
      <BidDialog
        visible={view.phase === 'bidding' && isMyTurn}
        minBid={view.minBid}
        highestBid={view.highestBid}
        highestBidderName={highestBidder?.name ?? null}
        canPass={view.canPass}
        scale={layout.s}
        onBid={(amount) => onAction({ type: 'bid', amount })}
        onPass={() => onAction({ type: 'pass' })}
      />

      {/* Trump selection dialog */}
      <TrumpDialog
        visible={view.phase === 'selectingTrump' && isMyTurn}
        winningBid={view.highestBid}
        scale={layout.s}
        onSelectTrump={(suit) => onAction({ type: 'selectTrump', suit })}
      />

      {/* Exit confirmation dialog */}
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
  topInfoRow: {
    position: 'absolute',
    top: 6,
    left: 16,
    flexDirection: 'row',
    gap: 8,
    zIndex: 5,
  },
  infoBadge: {
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  infoBadgeLabel: {
    color: colors.text,
    fontSize: font.small,
    fontWeight: '800',
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
