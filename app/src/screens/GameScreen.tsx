import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, type HostInstance, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import {
  type Action,
  type PlayerView,
  type RoomInfo,
  type Tile,
  DUZ_START_POINTS,
  OPEN_THRESHOLD,
  addableTiles,
  canShowIndicator,
  isJoker,
  findFinish,
  finishShape,
  leftOf,
  visibleDiscard,
} from '@okey/shared';
import { Button } from '../components/Button';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { DragSource } from '../components/DragSource';
import { OpponentPanel } from '../components/OpponentPanel';
import { Rack } from '../components/Rack';
import { RoundResult } from '../components/RoundResult';
import { TableMelds } from '../components/TableMelds';
import { TableOverlay } from '../components/TableOverlay';
import { TileBack, TileView } from '../components/TileView';
import { buzz, feedback, isSoundOn, play, setSoundOn } from '../feedback';
import { useDropZones } from '../game/dropZones';
import { useGameLayout } from '../game/layout';
import {
  type RackGeom,
  type RackSlots,
  autoArrange,
  emptyRack,
  slotAt,
  syncRack,
  validGroups,
} from '../game/rackLayout';
import type { OkeyClient } from '../net/useOkey';
import { split, t, tErr } from '../i18n';
import { colorNames, colors, font } from '../theme';

export function GameScreen({ client }: { client: OkeyClient }) {
  const { view, room } = client;
  if (!view || !room) {
    return (
      <View style={styles.center}>
        <Text style={styles.waiting}>{t('tablePreparing')}</Text>
      </View>
    );
  }
  return <Table view={view} room={room} client={client} />;
}

/** Gently pulses a highlight while `on`: shows where to act next. */
/** Gold: something to do here. Green: the hand can finish here. */
function Pulse({ on, green, children, style }: { on: boolean; green?: boolean; children: ReactNode; style?: object }) {
  const v = useSharedValue(0);
  useEffect(() => {
    if (on) v.value = withRepeat(withTiming(1, { duration: 700 }), -1, true);
    else {
      cancelAnimation(v);
      v.value = 0;
    }
  }, [on, v]);
  const animated = useAnimatedStyle(() => ({
    borderColor: on
      ? green
        ? `rgba(95,208,125,${0.45 + 0.55 * v.value})`
        : `rgba(242,182,50,${0.35 + 0.65 * v.value})`
      : 'transparent',
    backgroundColor: on && green ? `rgba(95,208,125,${0.12 + 0.28 * v.value})` : 'transparent',
    transform: [{ scale: 1 + (green ? 0.08 : 0.04) * v.value }],
  }));
  return (
    <Animated.View collapsable={false} style={[styles.pulse, style, animated]}>
      {children}
    </Animated.View>
  );
}

/**
 * Seconds left on the turn clock. Each view carries the time left when it was
 * made, so the countdown runs on this device's clock (no server time skew).
 */
function useSecondsLeft(view: PlayerView): number | null {
  const ms = view.turnMsLeft ?? null;
  const [deadline, setDeadline] = useState<number | null>(null);
  const [, setNow] = useState(0);
  useEffect(() => setDeadline(ms === null ? null : Date.now() + ms), [view, ms]);
  useEffect(() => {
    if (deadline === null) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [deadline]);
  return deadline === null ? null : Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
}

/** "0:24"; red in the last five seconds. */
function TimerChip({ seconds, size }: { seconds: number; size: number }) {
  const urgent = seconds <= 5;
  return (
    <View style={[styles.timer, urgent && styles.timerUrgent, { minWidth: size * 2.6, height: size * 1.6, borderRadius: size * 0.8 }]}>
      <Text style={[styles.timerText, { fontSize: size }, urgent && { color: '#fff' }]}>
        {`${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`}
      </Text>
    </View>
  );
}

/** Exact width and height for a button, overriding its minimums. */
function fixed(width: number, height: number) {
  return { width, minWidth: width, height, minHeight: height, paddingHorizontal: 4 };
}

function tileName(tile: Tile): string {
  return tile.kind === 'fake' ? t('fakeOkey') : `${colorNames[tile.color]} ${tile.value}`;
}

function Table({ view, room, client }: { view: PlayerView; room: RoomInfo; client: OkeyClient }) {
  const L = useGameLayout();
  const zones = useDropZones();
  const [slots, setSlots] = useState<RackSlots>(emptyRack);
  const [selected, setSelected] = useState<number | null>(null);
  const [fresh, setFresh] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  /** Which pile's top tile the player is holding. */
  const [dragging, setDragging] = useState<'deck' | 'discard' | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [sound, setSound] = useState(isSoundOn());
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rackGeom = useSharedValue<RackGeom | null>(null);
  const hoverSlot = useSharedValue(-1);
  /** Where a tile dragged from a pile should land once the draw is confirmed. */
  const pendingSlot = useRef<number | null>(null);

  const me = view.players[view.seat];
  const duz = view.mode === 'duz';
  const secondsLeft = useSecondsLeft(view);
  // The clock is shown for people only; bots move on their own.
  const turnSeat = room.seats[view.turn];
  const clockFor = view.phase === 'playing' && turnSeat && !turnSeat.isBot && turnSeat.connected ? view.turn : null;
  const myTurn = view.phase === 'playing' && view.turn === view.seat;
  const canDraw = myTurn && view.turnPhase === 'draw';
  const canPlay = myTurn && view.turnPhase === 'play';
  const rightSeat = (view.seat + 1) % 4;
  const acrossSeat = (view.seat + 2) % 4;
  const leftSeat = leftOf(view.seat);
  // Only the tile each player threw this lap shows; older ones lie covered underneath.
  const leftTop = visibleDiscard(view.players[leftSeat]);
  const myTop = visibleDiscard(me);

  // Rack follows the hand; a new round's hand gets auto-arranged. Tile ids repeat
  // every round, so the round number (not the ids) tells a new deal apart.
  const dealtRound = useRef<number | null>(null);
  useEffect(() => {
    const prefer = pendingSlot.current;
    pendingSlot.current = null;
    const newDeal = dealtRound.current !== room.round;
    dealtRound.current = room.round;
    setSlots((s) => {
      if (newDeal) return autoArrange(view.hand, view.okey);
      const known = new Set(s.filter((id) => id !== null));
      const added = view.hand.filter((t) => !known.has(t.id));
      if (added.length === 1) setFresh(added[0].id);
      return syncRack(s, view.hand, prefer);
    });
  }, [view.hand, view.okey, room.round]);

  // The drawn tile glows for two seconds so it can be found on the rack.
  useEffect(() => {
    if (fresh === null) return;
    const timer = setTimeout(() => setFresh(null), 2000);
    return () => clearTimeout(timer);
  }, [fresh]);

  useEffect(() => {
    if (selected !== null && !view.hand.some((t) => t.id === selected)) setSelected(null);
  }, [view.hand, selected]);

  // Sounds for what happens at the table; the player's own moves also vibrate.
  const lastAction = view.lastAction;
  useEffect(() => {
    if (!lastAction) return;
    const mine = lastAction.seat === view.seat;
    const sfx = lastAction.type === 'draw' ? 'draw' : lastAction.type === 'discard' ? 'discard' : 'open';
    if (mine) feedback(sfx);
    else play(sfx, sfx === 'open' ? 0.6 : 0.35);
  }, [lastAction, view.seat]);

  const wasMyTurn = useRef(false);
  useEffect(() => {
    if (myTurn && !wasMyTurn.current) feedback('turn');
    wasMyTurn.current = myTurn;
  }, [myTurn]);

  useEffect(() => {
    if (view.phase !== 'finished' || !view.result) return;
    if (view.result.winner === view.seat) feedback('win');
    else play('turn');
  }, [view.phase, view.result, view.seat]);

  // Düz okey: whoever holds the indicator's twin shows it at the deal.
  const gosterge = view.gosterge;
  const announcedRound = useRef<number | null>(null);
  useEffect(() => {
    if (gosterge === null || announcedRound.current === room.round) return;
    announcedRound.current = room.round;
    setInfo(gosterge === view.seat ? t('gostergeMine') : t('gostergeOther', { name: view.players[gosterge].name }));
    const timer = setTimeout(() => setInfo(null), 4000);
    return () => clearTimeout(timer);
    // Once per deal; names and seat don't change within a round.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gosterge, room.round]);

  // Middle ran out and the discards were shuffled back in: say so, the game goes on.
  const seenReshuffles = useRef(view.reshuffles);
  useEffect(() => {
    if (view.reshuffles > seenReshuffles.current) {
      setInfo(t('reshuffled'));
      play('draw');
      const timer = setTimeout(() => setInfo(null), 4000);
      seenReshuffles.current = view.reshuffles;
      return () => clearTimeout(timer);
    }
    seenReshuffles.current = view.reshuffles;
  }, [view.reshuffles]);

  const groups = useMemo(() => validGroups(slots, view.hand, view.okey), [slots, view.hand, view.okey]);
  const groupPoints = groups.reduce((s, g) => s + g.points, 0);
  const canOpen = canPlay && !duz && !me.opened && groupPoints >= OPEN_THRESHOLD;

  // Düz okey: the hand is checked for the player, whatever the rack order. The
  // selected tile is thrown if the rest finishes; otherwise the best tile is.
  const finish = useMemo(() => {
    if (!duz || !canPlay) return null;
    if (selected !== null && finishShape(view.hand.filter((t) => t.id !== selected), view.okey)) return selected;
    return findFinish(view.hand, view.okey)?.tileId ?? null;
  }, [duz, canPlay, selected, view.hand, view.okey]);
  const canFinish = finish !== null;
  // 101: one tile left after laying everything down; throwing it ends the hand.
  const lastTile = !duz && canPlay && me.opened && view.hand.length === 1 ? view.hand[0].id : null;
  /** The hand can end now: the deck glows and takes the finishing tile, like closing it on the middle stack. */
  const finishReady = canFinish || lastTile !== null;
  const reachedFinish = useRef(false);
  useEffect(() => {
    if (finishReady && !reachedFinish.current) buzz('success');
    reachedFinish.current = finishReady;
  }, [finishReady]);

  // "İşlek" tiles: hand tiles that fit a meld on the table. Marked on the rack;
  // selecting one lights up the melds it fits.
  const addable = useMemo(() => addableTiles(view.hand, view.table, view.okey), [view.hand, view.table, view.okey]);
  const addableIds = useMemo(() => new Set(addable.keys()), [addable]);
  const highlight = useMemo(() => new Set(selected === null ? [] : (addable.get(selected) ?? [])), [addable, selected]);
  const [zoomed, setZoomed] = useState(false);
  const [confirmIslek, setConfirmIslek] = useState<number | null>(null);
  const [confirmOkey, setConfirmOkey] = useState<number | null>(null);
  // Düz okey: the indicator's twin can be shown on the first turn, before drawing.
  const canShow = canShowIndicator(view);

  const reachedOpen = useRef(false);
  useEffect(() => {
    if (canOpen && !reachedOpen.current) buzz('success');
    reachedOpen.current = canOpen;
  }, [canOpen]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    feedback('error');
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }, []);
  useEffect(() => () => void (toastTimer.current && clearTimeout(toastTimer.current)), []);

  const send = useCallback(
    async (action: Action) => {
      const res = await client.act(action);
      if (!res.ok) showToast(tErr(res.error));
      return res.ok;
    },
    [client, showToast],
  );

  const doDiscard = (tileId: number) => {
    setSelected(null);
    void send({ type: 'discard', tileId });
  };
  const discard = (tileId: number) => {
    if (!canPlay) return showToast(canDraw ? t('drawFirst') : t('notYourTurn'));
    // 101: throwing the okey other than as the last tile costs 101: ask first.
    const tile = view.hand.find((x) => x.id === tileId);
    if (!duz && tile && view.hand.length > 1 && isJoker(tile, view.okey)) return setConfirmOkey(tileId);
    // Throwing a tile that fits a meld on the table usually helps the next player: ask first.
    if (addable.has(tileId)) return setConfirmIslek(tileId);
    doDiscard(tileId);
  };

  const addToMeld = (tileId: number, meldId: number) => {
    if (!canPlay) return showToast(canDraw ? t('drawFirst') : t('notYourTurn'));
    if (!me.opened) return showToast(t('openFirstToAdd'));
    setSelected(null);
    void send({ type: 'addToMeld', meldId, tileIds: [tileId] });
  };

  // Tapping a meld with a fitting tile selected adds it; otherwise opens the large view.
  const onMeldPress = (meldId: number) => {
    if (selected !== null && highlight.has(meldId)) return addToMeld(selected, meldId);
    setZoomed(true);
  };

  /** The finishing tile goes face down on the middle stack. */
  const finishOnDeck = (tileId: number | null) => {
    if (!finishReady) return showToast(canDraw ? t('drawFirst') : myTurn ? t('notFinished') : t('notYourTurn'));
    setSelected(null);
    if (!duz) return void send({ type: 'discard', tileId: lastTile! });
    const id = tileId !== null && finishShape(view.hand.filter((x) => x.id !== tileId), view.okey) ? tileId : null;
    if (tileId !== null && id === null) return showToast(t('notFinished'));
    void send({ type: 'finish', tileId: id ?? finish! });
  };

  const onDropOnZone = (tileId: number, zone: string) => {
    if (zone === 'deck') finishOnDeck(tileId);
    else if (zone === 'discard') discard(tileId);
    else if (zone.startsWith('meld:')) addToMeld(tileId, Number(zone.slice(5)));
  };

  const draw = (source: 'deck' | 'discard', slot: number | null = null) => {
    if (!canDraw) return showToast(myTurn ? t('alreadyDrew') : t('notYourTurn'));
    pendingSlot.current = slot;
    void send({ type: 'draw', source });
  };
  // Dragging from a pile: drop it on the rack to draw it into that slot.
  const dropFromPile = (source: 'deck' | 'discard') => (x: number, y: number) => {
    const slot = slotAt(rackGeom.value, x, y);
    // Like rack drops: let the gesture finish before the pile tile can unmount.
    if (slot >= 0) setTimeout(() => draw(source, slot), 50);
  };

  const openOrLay = async () => {
    if (!me.opened) {
      await send({ type: 'open', melds: groups.map((g) => g.tileIds) });
      return;
    }
    for (const g of groups) if (!(await send({ type: 'meld', tileIds: g.tileIds }))) break;
  };

  const moveOnRack = (next: RackSlots) => {
    setSlots(next);
    feedback('place');
  };

  // Android back: close what's open, otherwise ask before leaving the table (never leave by accident).
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      // Result-screen navigation goes through its guarded ad gate buttons.
      if (view.phase === 'finished') return true;
      if (zoomed) setZoomed(false);
      else if (confirmIslek !== null) setConfirmIslek(null);
      else if (confirmOkey !== null) setConfirmOkey(null);
      else setConfirmLeave((open) => !open);
      return true;
    });
    return () => sub.remove();
  }, [zoomed, confirmIslek, confirmOkey, view.phase]);

  // The discard zone is a drop target for tiles dragged off the rack.
  const discardRef = useRef<HostInstance>(null);
  useEffect(() => zones.register('discard', discardRef), [zones]);
  // The deck takes the finishing tile.
  const deckRef = useRef<HostInstance>(null);
  useEffect(() => zones.register('deck', deckRef), [zones]);

  // Düz okey shows what each player has left of their starting points.
  const totals = duz ? room.totals.map((t) => DUZ_START_POINTS - t) : room.totals;
  const status = canShow ? t('canShowIndicator') : statusText(view, myTurn, addable.size > 0, canFinish, lastTile !== null);
  const okeyName = `${colorNames[view.okey.color]} ${view.okey.value}`;
  const openTitle = me.opened ? t('layMelds') : t('openBtn', { points: groupPoints, need: OPEN_THRESHOLD });
  const openSub = me.opened
    ? undefined
    : groupPoints >= OPEN_THRESHOLD
      ? t('canOpen')
      : t('pointsMore', { n: OPEN_THRESHOLD - groupPoints });

  const duzHint2 = split('duzHint2', 'btn');
  const cellW = Math.floor((L.drawW - 12) / 2);
  const emptyFrame = <View style={[styles.emptyFrame, { width: L.pileW - 2, height: L.pileH - 2 }]} />;

  return (
    <View style={[styles.root, { paddingTop: L.gap }]}>
      {/* 1 · Header strip: leave, sound, the three opponents in seating order, the okey. */}
      <View style={[styles.row, { height: L.headH }]}>
        <Button
          title={t('leave')}
          variant="secondary"
          onPress={() => setConfirmLeave(true)}
          style={fixed(L.cikW, L.headH)}
        />
        <Button
          title={sound ? '🔊' : '🔇'}
          variant="secondary"
          onPress={() => {
            setSoundOn(!sound);
            setSound(!sound);
          }}
          style={{ ...fixed(L.sesW, L.headH), marginLeft: 6 * L.s, marginRight: 10 * L.s }}
        />
        {[leftSeat, acrossSeat, rightSeat].map((seat, i) => (
          <View key={seat} style={{ marginLeft: i ? 8 * L.s : 0 }}>
            <OpponentPanel
              player={view.players[seat]}
              seatInfo={room.seats[seat]}
              total={totals[seat]}
              unit={duz ? 'points' : undefined}
              active={view.turn === seat}
              secondsLeft={clockFor === seat ? secondsLeft : null}
              width={L.oppW}
              height={L.headH}
              // The left player's pile is already the big "take" pile below; the
              // other two show theirs here, so every tile thrown this lap is visible.
              showDiscard={seat !== leftSeat}
              okey={view.okey}
            />
          </View>
        ))}
        <View style={{ flex: 1 }} />
        <Pressable
          disabled={!canShow}
          onPress={() => void send({ type: 'showIndicator' })}
          style={[styles.okeyBox, { width: L.okW, height: L.headH }, canShow && styles.okeyShow]}
        >
          <TileView tile={view.indicator} width={28} />
          <View style={{ flexShrink: 1 }}>
            <Text style={[styles.okeyLabel, canShow && { color: colors.felt, fontWeight: '900' }]} numberOfLines={1}>
              {canShow ? t('showIndicator') : t('okeyLabel')}
            </Text>
            <Text style={[styles.okeyValue, canShow && { color: colors.felt }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
              {okeyName}
            </Text>
          </View>
        </Pressable>
      </View>

      {/* 2 · Zones: draw (deck, left discard) · table · discard. */}
      {/* collapsable={false}: these views get a zIndex while a pile tile is held. If they could be
          flattened away, that zIndex would create them mid-drag, re-parent the tile and cancel the drag. */}
      <View collapsable={false} style={[styles.zones, { marginTop: L.gap }, dragging && styles.raised]}>
        <View
          collapsable={false}
          style={[styles.zone, styles.drawZone, { width: L.drawW, height: L.sideH }, dragging && styles.raised]}
        >
          <View
            ref={deckRef}
            collapsable={false}
            style={[styles.cell, { width: cellW }, dragging === 'deck' && styles.raised]}
          >
            <Pulse on={canDraw || finishReady} green={finishReady}>
              {/* The stack stays put; only its top tile follows the finger, and the count drops by one. */}
              {view.deckCount > 1 && <View style={styles.stackShadow}><TileBack width={L.pileW} /></View>}
              {view.deckCount > 1 || dragging !== 'deck' ? <TileBack width={L.pileW} /> : emptyFrame}
              {view.deckCount > 0 && (
                <DragSource
                  enabled={canDraw}
                  instantReturn
                  style={styles.pileTop}
                  rackGeom={rackGeom}
                  hoverSlot={hoverSlot}
                  onTap={() => (finishReady ? finishOnDeck(selected) : draw('deck'))}
                  onDragStart={() => {
                    setDragging('deck');
                    zones.measureAll();
                  }}
                  onDragEnd={() => setDragging(null)}
                  onDrop={dropFromPile('deck')}
                >
                  <TileBack width={L.pileW} />
                </DragSource>
              )}
              <View style={styles.deckCountBox} pointerEvents="none">
                <Text style={[styles.deckCount, { fontSize: Math.round(L.pileW * 0.44) }]}>
                  {dragging === 'deck' ? view.deckCount - 1 : view.deckCount}
                </Text>
              </View>
            </Pulse>
            <Text
              style={[styles.zoneLabel, finishReady && { color: colors.ok }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
            >
              {finishReady ? t('finishBtn') : t('deck')}
            </Text>
          </View>
          <View collapsable={false} style={[styles.cell, { width: cellW }, dragging === 'discard' && styles.raised]}>
            <Pulse on={canDraw && !!leftTop}>
              {/* While the top tile is in the player's hand the spot looks empty: the
                  tiles under it were thrown a lap earlier and stay covered. */}
              {dragging === 'discard'
                ? emptyFrame
                : leftTop
                  ? <TileView tile={leftTop} okey={view.okey} width={L.pileW} />
                  : emptyFrame}
              {leftTop && (
                <DragSource
                  enabled={canDraw}
                  instantReturn
                  style={styles.pileTop}
                  rackGeom={rackGeom}
                  hoverSlot={hoverSlot}
                  onTap={() => draw('discard')}
                  onDragStart={() => {
                    setDragging('discard');
                    zones.measureAll();
                  }}
                  onDragEnd={() => setDragging(null)}
                  onDrop={dropFromPile('discard')}
                >
                  <TileView tile={leftTop} okey={view.okey} width={L.pileW} />
                </DragSource>
              )}
            </Pulse>
            <Text style={styles.zoneLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
              {t('takeLeft')}
            </Text>
          </View>
        </View>

        <View style={{ flex: 1, height: L.zoneH, marginHorizontal: 6 }}>
          {duz ? (
            // Two short lines beside the score: fits the shortest zone (~90pt) on any phone.
            <View style={styles.duzCenter}>
              <View style={styles.duzScoreBox}>
                <Text style={styles.duzScoreLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{t('yourPoints')}</Text>
                <Text style={styles.duzScore}>{totals[view.seat]}</Text>
              </View>
              <Text style={styles.duzHint} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.75}>
                {t('duzHint1')}{'\n'}
                {duzHint2[0]}
                <Text style={{ color: colors.accent, fontWeight: '900' }}>{t('finishBtn')}</Text>
                {duzHint2[1]}
              </Text>
            </View>
          ) : (
          <TableMelds
            table={view.table}
            players={view.players}
            mySeat={view.seat}
            okey={view.okey}
            maxTileWidth={L.meldCap}
            zoomWidth={Math.round(56 * L.s)}
            emptyText={t('openNeeds', { n: OPEN_THRESHOLD })}
            highlight={highlight}
            onMeldPress={onMeldPress}
            onZoom={() => view.table.length > 0 && setZoomed(true)}
          />
          )}
        </View>

        <Pressable
          ref={discardRef}
          collapsable={false}
          onPress={() => (selected !== null ? discard(selected) : undefined)}
          style={[styles.zone, styles.cell, { width: L.discW, height: L.sideH }]}
        >
          <Pulse on={canPlay}>{myTop ? <TileView tile={myTop} okey={view.okey} width={L.pileW} /> : emptyFrame}</Pulse>
          <Text style={styles.zoneLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{t('discardHere')}</Text>
        </Pressable>
      </View>

      {/* 3 · Actions: arrange · status · throw · open. */}
      <View style={[styles.row, { height: L.actH, gap: L.ag, marginTop: L.gap }]}>
        <Button
          title={t('sort')}
          variant="secondary"
          onPress={() => moveOnRack(autoArrange(view.hand, view.okey))}
          style={fixed(L.dizW, L.actH)}
        />
        {clockFor === view.seat && secondsLeft !== null && <TimerChip seconds={secondsLeft} size={Math.round(20 * L.s)} />}
        <View style={styles.statusBox}>
          {toast ? (
            <Text style={styles.toast} numberOfLines={2}>
              {toast}
            </Text>
          ) : info ? (
            <Text style={styles.info} numberOfLines={2}>
              {info}
            </Text>
          ) : (
            <Text
              style={[styles.status, myTurn && { color: colors.accent }]}
              numberOfLines={2}
              adjustsFontSizeToFit
              minimumFontScale={0.77}
            >
              {status}
            </Text>
          )}
        </View>
        <Button
          title={t('discardBtn')}
          onPress={() => selected !== null && discard(selected)}
          disabled={!canPlay || selected === null}
          style={fixed(L.atW, L.actH)}
        />
        {duz ? (
          <Button
            title={t('finishBtn')}
            subtitle={canFinish ? t('canFinish') : t('notFinished')}
            variant={canFinish ? 'success' : 'primary'}
            onPress={() => finish !== null && void send({ type: 'finish', tileId: finish })}
            disabled={!canFinish}
            style={fixed(L.acW, L.actH)}
          />
        ) : (
          <Button
            title={openTitle}
            subtitle={openSub}
            variant={canOpen ? 'success' : 'primary'}
            onPress={openOrLay}
            disabled={!canPlay || groups.length === 0 || (!me.opened && groupPoints < OPEN_THRESHOLD)}
            style={fixed(L.acW, L.actH)}
          />
        )}
      </View>

      {/* 4 · The rack: wood from edge to edge, down under the home indicator. */}
      <View style={{ marginTop: 2 }}>
        <Rack
          hand={view.hand}
          okey={view.okey}
          slots={slots}
          tileWidth={L.tileW}
          selectedId={selected}
          freshId={fresh}
          addableIds={addableIds}
          rackGeom={rackGeom}
          hoverSlot={hoverSlot}
          onSlotsChange={moveOnRack}
          onBlocked={() => play('error', 0.4)}
          onSelect={(id) => {
            setSelected(id);
            if (id !== null) buzz('light');
          }}
          onDropOnZone={onDropOnZone}
          bleedLeft={L.insL}
          bleedRight={L.insR}
          bleedBottom={L.insB}
        />
      </View>

      {view.phase === 'finished' && view.result && (
        <RoundResult
          view={view}
          room={room}
          onNext={async () => {
            const r = await client.nextRound();
            if (!r.ok) showToast(tErr(r.error));
          }}
          onLeave={client.leave}
        />
      )}

      {zoomed && (
        <TableOverlay
          table={view.table}
          players={view.players}
          mySeat={view.seat}
          okey={view.okey}
          selected={view.hand.find((t) => t.id === selected) ?? null}
          highlight={highlight}
          onMeldPress={(meldId) => {
            if (selected !== null && highlight.has(meldId)) {
              addToMeld(selected, meldId);
              setZoomed(false);
            }
          }}
          onClose={() => setZoomed(false)}
        />
      )}

      {confirmIslek !== null && (
        <ConfirmDialog
          message={t('confirmIslek')}
          confirm={t('yesDiscard')}
          cancel={t('no')}
          onConfirm={() => {
            const id = confirmIslek;
            setConfirmIslek(null);
            doDiscard(id);
          }}
          onCancel={() => setConfirmIslek(null)}
        />
      )}

      {confirmOkey !== null && (
        <ConfirmDialog
          message={t('confirmOkeyDiscard')}
          confirm={t('yesDiscard')}
          cancel={t('no')}
          onConfirm={() => {
            const id = confirmOkey;
            setConfirmOkey(null);
            doDiscard(id);
          }}
          onCancel={() => setConfirmOkey(null)}
        />
      )}

      {confirmLeave && (
        <ConfirmDialog
          message={t('confirmLeave')}
          confirm={t('yesLeave')}
          cancel={t('noPlay')}
          onConfirm={() => {
            setConfirmLeave(false);
            client.leave();
          }}
          onCancel={() => setConfirmLeave(false)}
        />
      )}
    </View>
  );
}

/** Short, plain instructions; while others play, say what they just did. */
function statusText(view: PlayerView, myTurn: boolean, hasAddable: boolean, canFinish: boolean, lastTile: boolean): string {
  if (view.phase === 'finished') return t('handOver');
  if (myTurn) {
    if (view.turnPhase === 'draw') return t('yourTurnDraw');
    if (view.mustUseTileId !== null) return t('useTakenTile');
    if (canFinish) return t('handDone');
    if (lastTile) return t('finishOnDeck');
    if (hasAddable && view.players[view.seat].opened) return t('canAddPlus');
    return t('yourTurnDiscard');
  }
  return lastActionText(view) ?? t('playing', { name: view.players[view.turn].name });
}

function lastActionText(view: PlayerView): string | null {
  const a = view.lastAction;
  if (!a || a.seat === view.seat) return null;
  const name = view.players[a.seat].name;
  switch (a.type) {
    case 'open':
      return t('actOpened', { name, points: a.points });
    case 'meld':
      return t('actMelded', { name });
    case 'addToMeld':
      return t('actAdded', { name });
    case 'draw':
      return a.source === 'discard' ? t('actTookDiscard', { name }) : t('actDrewDeck', { name });
    case 'discard':
      return t('actDiscarded', { name, tile: tileName(a.tile) });
    case 'finish':
      return t('actFinished', { name });
    case 'showIndicator':
      return t('gostergeOther', { name });
  }
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  waiting: { color: colors.text, fontSize: font.body },
  row: { flexDirection: 'row', alignItems: 'center' },
  zones: { flex: 1, flexDirection: 'row', alignItems: 'flex-start' },
  zone: { backgroundColor: colors.panel, borderRadius: 12, borderWidth: 3, borderColor: 'transparent' },
  drawZone: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-evenly' },
  cell: { alignItems: 'center', justifyContent: 'center' },
  zoneLabel: { color: colors.text, fontSize: font.small, fontWeight: '700', lineHeight: 18, marginTop: 1 },
  okeyBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 6,
    borderRadius: 12,
    backgroundColor: colors.panel,
  },
  okeyLabel: { color: colors.muted, fontSize: font.small, fontWeight: '600', lineHeight: 18 },
  okeyShow: { backgroundColor: colors.accent },
  okeyValue: { color: colors.text, fontSize: 17, fontWeight: '800', lineHeight: 20 },
  pulse: { borderWidth: 3, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  pileTop: { position: 'absolute', top: 0, left: 0 },
  stackShadow: { position: 'absolute', top: 3, left: 3, opacity: 0.7 },
  emptyFrame: {
    margin: 1,
    borderRadius: 6,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.35)',
  },
  // While a pile tile is held, lift its containers over the table, status bar and rack.
  raised: { zIndex: 50, elevation: 50 },
  info: {
    color: '#0b3d2e',
    backgroundColor: colors.ok,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: 'hidden',
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'center',
  },
  // Above the idle top tile (zIndex 1), below a tile being dragged (100).
  deckCountBox: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', zIndex: 5 },
  deckCount: { color: '#5a4a2a', fontWeight: '900' },
  duzCenter: {
    flex: 1,
    flexDirection: 'row',
    borderRadius: 12,
    backgroundColor: colors.feltLight,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    gap: 14,
    overflow: 'hidden',
  },
  duzScoreBox: { alignItems: 'center', backgroundColor: colors.panel, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 2 },
  duzScoreLabel: { color: colors.muted, fontSize: font.small, fontWeight: '700', lineHeight: 18 },
  duzScore: { color: colors.accent, fontSize: 30, fontWeight: '900', lineHeight: 34 },
  duzHint: { flexShrink: 1, color: colors.text, fontSize: 17, fontWeight: '600', textAlign: 'center', lineHeight: 22 },
  statusBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  timer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    backgroundColor: colors.panel,
    borderWidth: 2,
    borderColor: colors.accent,
  },
  timerUrgent: { backgroundColor: colors.danger, borderColor: colors.danger },
  timerText: { color: colors.accent, fontWeight: '900', fontVariant: ['tabular-nums'] },
  status: { color: colors.text, fontSize: font.status, fontWeight: '800', textAlign: 'center' },
  toast: {
    color: '#fff',
    backgroundColor: colors.danger,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: 'hidden',
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
});
