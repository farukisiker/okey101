import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, font } from '../theme';
import { t } from '../i18n';
import { isSoundOn, setSoundOn } from '../feedback';
import { Button } from '../components/Button';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { GameShell, type RoundSummary } from '../components/GameShell';
import {
  type Card,
  CardOpponentPanel,
  Hand,
  PistiCenterPile,
  type PistiScreenProps,
  cardPlayFeedback,
  cardTakeFeedback,
  sortCards,
  useCardLayout,
} from '../components/cards';

/**
 * Pişti game screen embedded in GameShell.
 * 2 or 4 players, central pile, opponent panels, action bar, and two-tap hand.
 */
export function PistiScreen({ view, seat, onAction, onNextRound, onLeave }: PistiScreenProps) {
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

  // Audio feedback on card captures and Pişti events
  const lastCaptureRef = useRef(view.lastCapture);
  useEffect(() => {
    if (view.lastCapture && view.lastCapture !== lastCaptureRef.current) {
      lastCaptureRef.current = view.lastCapture;
      cardTakeFeedback(view.lastCapture.isPisti);
    }
  }, [view.lastCapture]);

  const isMyTurn = view.turn === seat && view.phase === 'playing';
  const myPlayer = useMemo(() => view.players.find((p) => p.seat === seat), [view.players, seat]);
  const opponents = useMemo(() => view.players.filter((p) => p.seat !== seat), [view.players, seat]);
  const activePlayer = useMemo(() => view.players.find((p) => p.seat === view.turn), [view.players, view.turn]);
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
  if (view.lastCapture?.isPisti) {
    statusText = view.lastCapture.isJackPisti
      ? `${t('pistiPistiDouble')} (+${view.lastCapture.pointsEarned})`
      : `${t('pistiPisti')} (+${view.lastCapture.pointsEarned})`;
  } else if (isMyTurn) {
    statusText = t('cardsYourTurn');
  } else if (activePlayer) {
    statusText = t('cardsWaitingTurn', { name: activePlayer.name });
  } else {
    statusText = t('cardsWaitingOpponent');
  }

  // Round summary mapping for GameShell overlay
  const summary: RoundSummary | null = view.result
    ? {
        matchOver: view.result.matchOver,
        winnerSeats: view.result.winnerSeats,
        rows: view.players.map((p, idx) => ({
          seat: p.seat,
          name: p.seat === seat ? t('you') : p.name,
          points: view.result!.scores[idx] ?? 0,
          total: view.result!.totals[idx] ?? p.totalScore,
        })),
      }
    : null;

  const secondsLeft = isMyTurn && view.turnMsLeft != null ? Math.max(0, Math.ceil(view.turnMsLeft / 1000)) : null;

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
        humanCount={view.players.filter((p) => !p.isBot).length || 1}
        onNextHand={onNextRound}
        onNewMatch={onNextRound}
        onLeaveTable={() => onLeave?.()}
        opponents={
          <View style={styles.opponentsRow}>
            {opponents.map((opp) => {
              const oppSeconds =
                view.turn === opp.seat && view.turnMsLeft != null
                  ? Math.max(0, Math.ceil(view.turnMsLeft / 1000))
                  : null;

              return (
                <CardOpponentPanel
                  key={opp.seat}
                  name={opp.name}
                  active={view.turn === opp.seat}
                  handCount={opp.handCount}
                  capturedCount={opp.capturedCount}
                  pistiCount={opp.pistiCount}
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
          {/* Deck count indicator */}
          <View style={styles.deckBadge}>
            <Text style={styles.deckText}>{t('pistiDeckCount', { n: view.deckCount })}</Text>
          </View>

          {/* Center pile */}
          <View style={styles.centerSection}>
            <PistiCenterPile
              topCard={view.topCard}
              centerCount={view.centerCount}
              cardWidth={layout.centerPileCardWidth}
              onPress={
                isSelectedPlayable ? () => handlePlayCard(selectedCardId!) : undefined
              }
            />
          </View>

          {/* Action bar right above hand */}
          <View style={[styles.actionBar, { height: layout.actionBarHeight }]}>
            <Button
              title={t('cardsSort')}
              onPress={handleSort}
              variant="secondary"
              style={styles.actionBtn}
            />

            <View style={styles.actionHint}>
              <Text style={styles.hintText} numberOfLines={1}>
                {`${t('pistiCapturedCount', { n: myPlayer?.capturedCount ?? 0 })} · ${t('pistiCount', { n: myPlayer?.pistiCount ?? 0 })} · ${t('pistiYourScore', { n: myPlayer?.totalScore ?? 0 })}`}
              </Text>
            </View>

            <Button
              title={t('cardsPlay')}
              onPress={() => isSelectedPlayable && handlePlayCard(selectedCardId!)}
              disabled={!isSelectedPlayable}
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
            canPlay={isMyTurn}
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
