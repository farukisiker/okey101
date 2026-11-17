import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { RoomInfo } from '@okey/shared';
import type { CheckerMove, From, TavlaAction, TavlaView, To } from '@kahve/tavla';
import { colors, font } from '../theme';
import { t } from '../i18n';
import { isSoundOn, setSoundOn } from '../feedback';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { GameShell, type RoundSummary } from '../components/GameShell';
import { type HostTimes, msLeftNow } from '../net/localHost';
import {
  ActionButton,
  DicePanel,
  PlayerBar,
  TavlaBoard,
  checkerFeedback,
  computeTavlaGeom,
  diceFeedback,
  movableFroms,
  nextStepOffered,
  planSteps,
  targetsFor,
  tavlaSummary,
  tt,
  useOpponentAnim,
  viewerSeatOf,
  wouldHit,
} from '../components/tavla';

export interface TavlaScreenProps {
  /** The engine's TavlaView plus the host's times (turnMsLeft, noticeMsLeft). */
  view: TavlaView & HostTimes;
  /** Epoch ms when `view` arrived (the countdown runs from here). Missing: now. */
  viewAt?: number;
  /** The table: totals, connections. Missing (preview): the totals are this game's points. */
  room?: RoomInfo | null;
  seat: number;
  /** End-of-game summary from useKahveGame. Missing: built from the view. */
  summary?: RoundSummary | null;
  /** People at the table, for the ad break rule. */
  humanCount?: number;
  onAction(action: TavlaAction): void | Promise<unknown>;
  onNextRound?(): void | Promise<unknown>;
  onLeave?(): void;
}

/** A multi-die move waits this long for the next view before it gives up. */
const STEP_TIMEOUT_MS = 2500;

/**
 * Tavla (backgammon) screen in GameShell. Tap one of your checkers (or the bar): the places it can go light up
 * with their dice ("3", "8 (3+5)"); tap one and its dice are sent as `step` actions. Then Tamam (or Pas).
 */
export function TavlaScreen({ view, viewAt, room, seat, summary: summaryProp, humanCount, onAction, onNextRound, onLeave }: TavlaScreenProps) {
  const [sound, setSound] = useState(isSoundOn());
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [selected, setSelected] = useState<From | null>(null);
  const [busy, setBusy] = useState(false);
  const pending = useRef<{ actions: TavlaAction[]; timer: ReturnType<typeof setTimeout> } | null>(null);
  const busyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const geom = useMemo(() => computeTavlaGeom(width, height, insets), [width, height, insets]);
  const viewer = viewerSeatOf(seat);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setShowExitConfirm((open) => !open);
      return true;
    });
    return () => sub.remove();
  }, []);

  // Dice sound when a new turn is rolled (not on mount).
  const turnRef = useRef(view.turnNumber);
  useEffect(() => {
    if (turnRef.current !== view.turnNumber && view.phase === 'playing') diceFeedback();
    turnRef.current = view.turnNumber;
  }, [view.turnNumber, view.phase]);

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

  const anim = useOpponentAnim(view, geom, viewer, seat);
  const replaying = anim.board != null;
  const board = anim.board ?? view.board;

  const isMyTurn = seat >= 0 && view.turn === seat && view.phase === 'playing';
  const canPlay = isMyTurn && !replaying;
  const movable = useMemo(() => (canPlay ? movableFroms(view.moves) : new Set<From>()), [canPlay, view.moves]);
  const targets = useMemo(
    () => (canPlay && selected != null ? targetsFor(view.moves, selected) : new Map<To, CheckerMove>()),
    [canPlay, selected, view.moves],
  );

  const clearBusy = useCallback(() => {
    if (busyTimer.current) clearTimeout(busyTimer.current);
    busyTimer.current = null;
    setBusy(false);
  }, []);
  const stopPending = useCallback(() => {
    if (pending.current) clearTimeout(pending.current.timer);
    pending.current = null;
  }, []);

  const send = useCallback(
    (action: TavlaAction) => {
      try {
        const r = onAction(action);
        if (r && typeof (r as Promise<unknown>).catch === 'function') {
          (r as Promise<unknown>).catch(() => {
            stopPending();
            clearBusy();
          });
        }
      } catch {
        stopPending();
        clearBusy();
      }
    },
    [onAction, stopPending, clearBusy],
  );

  // A new view: the next die of a multi-die move goes out if the engine still offers it; otherwise stop.
  useEffect(() => {
    const p = pending.current;
    if (!p) {
      clearBusy();
    } else {
      const next = p.actions[0];
      if (!next || !nextStepOffered(view, next)) {
        stopPending();
        clearBusy();
      } else {
        p.actions.shift();
        if (p.actions.length === 0) stopPending();
        send(next);
      }
    }
    setSelected((cur) => (cur != null && !movableFroms(view.moves).has(cur) ? null : cur));
    // Runs per arriving view only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  useEffect(
    () => () => {
      stopPending();
      if (busyTimer.current) clearTimeout(busyTimer.current);
    },
    [stopPending],
  );

  const playMove = (move: CheckerMove) => {
    const actions = planSteps(move, seat);
    const first = actions.shift();
    if (!first) return;
    checkerFeedback(wouldHit(view.board, seat, move.to));
    setSelected(null);
    setBusy(true);
    if (busyTimer.current) clearTimeout(busyTimer.current);
    busyTimer.current = setTimeout(() => {
      stopPending();
      setBusy(false);
    }, STEP_TIMEOUT_MS);
    stopPending();
    if (actions.length) pending.current = { actions, timer: setTimeout(stopPending, STEP_TIMEOUT_MS) };
    send(first);
  };

  const pick = (from: From) => setSelected((cur) => (cur === from ? null : from));
  const onPoint = (n: number) => {
    if (!canPlay || busy) return;
    const move = selected != null ? targets.get(n) : undefined;
    if (move) return playMove(move);
    if (movable.has(n)) return pick(n);
    setSelected(null);
  };
  const onBar = () => {
    if (!canPlay || busy) return;
    if (movable.has('bar')) pick('bar');
  };
  const onOff = () => {
    if (!canPlay || busy) return;
    const move = targets.get('off');
    if (move) playMove(move);
  };

  const players = view.players;
  const activePlayer = players.find((p) => p.seat === view.turn);
  const totals = room?.totals ?? null;

  let statusText: string;
  if (view.phase === 'finished') statusText = '';
  else if (isMyTurn && view.mustPass) statusText = tt('tavlaNoMove');
  else if (isMyTurn) statusText = selected != null ? tt('tavlaPickTarget') : view.canCommit ? tt('tavlaPressDone') : tt('tavlaPickChecker');
  else if (activePlayer) statusText = t('cardsWaitingTurn', { name: activePlayer.name });
  else statusText = t('cardsWaitingOpponent');

  const fallbackSummary = useMemo<RoundSummary | null>(() => {
    if (summaryProp !== undefined || !view.result) return null;
    const names = players.map((p) => p.name);
    const sums = room?.totals ?? null;
    return tavlaSummary({
      names,
      result: view.result,
      totals: sums,
      matchOver: room?.matchOver ?? (sums ? Math.max(...sums) >= view.options.targetScore : false),
      mySeat: seat,
      you: t('you'),
      kindLabel: { tek: tt('tavlaKindTek'), mars: tt('tavlaKindMars'), koncina: tt('tavlaKindKoncina') },
      note: (kind, n) => tt('tavlaResultNote', { kind, n }),
    });
  }, [summaryProp, view.result, view.options.targetScore, players, room, seat]);
  const summary = summaryProp !== undefined ? summaryProp : fallbackSummary;

  const handleToggleSound = () => {
    const next = !sound;
    setSound(next);
    setSoundOn(next);
  };
  const next = async () => {
    await onNextRound?.();
  };

  // Buttons: Geri al, and Tamam (or Pas when nothing can be played). One of them is highlighted.
  const compact = geom.compact;
  const btnH = compact ? 56 : 68;
  const showPass = isMyTurn && view.mustPass;
  const commitPrimary = isMyTurn && (view.canCommit || view.mustPass);
  const diceSize = compact ? 52 : Math.max(60, Math.min(96, Math.round(geom.panelW * 0.22)));
  const idle = !isMyTurn || busy || replaying;

  const buttons = (
    <View style={styles.buttons}>
      <ActionButton title={tt('tavlaUndo')} onPress={() => send({ type: 'undo' })} disabled={idle || !view.canUndo} height={btnH} style={styles.btn} />
      {showPass ? (
        <ActionButton title={tt('tavlaPass')} primary onPress={() => send({ type: 'commit' })} disabled={idle} height={btnH} style={styles.btnWide} />
      ) : (
        <ActionButton
          title={tt('tavlaCommit')}
          primary={commitPrimary}
          onPress={() => send({ type: 'commit' })}
          disabled={idle || !view.canCommit}
          height={btnH}
          style={styles.btn}
        />
      )}
    </View>
  );

  const panel = (
    <View style={[styles.panel, { width: geom.panelW, height: geom.mode === 'side' ? geom.areaH : undefined, gap: compact ? 8 : 16 }]}>
      <DicePanel view={view} size={diceSize} />
      <Text style={styles.hint} numberOfLines={2} accessibilityLiveRegion="polite">{statusText}</Text>
      {buttons}
    </View>
  );

  const boardEl = (
    <TavlaBoard
      geom={geom}
      viewer={viewer}
      board={board}
      mySeat={seat}
      selected={selected}
      movable={movable}
      targets={targets}
      interactive={canPlay && !busy}
      flying={anim.flying}
      onPoint={onPoint}
      onBar={onBar}
      onOff={onOff}
    />
  );

  return (
    <View style={styles.root}>
      <GameShell
        gameId="tavla"
        title={t('game.tavla')}
        secondsLeft={isMyTurn ? turnSeconds : null}
        muted={!sound}
        onToggleSound={handleToggleSound}
        onExit={() => setShowExitConfirm(true)}
        status={statusText}
        summary={summary}
        mySeat={seat}
        humanCount={humanCount ?? 1}
        onNextHand={next}
        onNewMatch={next}
        onLeaveTable={() => onLeave?.()}
        opponents={<PlayerBar view={view} mySeat={seat} totals={totals} compact={compact} />}
      >
        <View
          style={[
            styles.area,
            {
              paddingLeft: insets.left + 8,
              paddingRight: insets.right + 8,
              paddingBottom: insets.bottom + 8,
              paddingTop: 8,
              flexDirection: geom.mode === 'side' ? 'row' : 'column',
              gap: 12,
            },
          ]}
        >
          {boardEl}
          {panel}
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
  root: { flex: 1, backgroundColor: colors.felt },
  area: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  panel: { alignItems: 'center', justifyContent: 'center' },
  hint: { color: colors.text, fontSize: font.body, fontWeight: '800', textAlign: 'center', minHeight: 24 },
  buttons: { flexDirection: 'row', gap: 10, alignSelf: 'stretch' },
  btn: { flex: 1 },
  btnWide: { flex: 2 },
});
