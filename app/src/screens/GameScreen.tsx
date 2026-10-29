import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type HostInstance, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { type Action, type PlayerView, type RoomInfo, type Tile, OPEN_THRESHOLD, leftOf } from '@okey/shared';
import { Button } from '../components/Button';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { DragSource } from '../components/DragSource';
import { OpponentPanel } from '../components/OpponentPanel';
import { RACK_PAD, Rack, rackHeight } from '../components/Rack';
import { RoundResult } from '../components/RoundResult';
import { TableMelds } from '../components/TableMelds';
import { TileBack, TileView, tileHeight } from '../components/TileView';
import { buzz, feedback, isSoundOn, play, setSoundOn } from '../feedback';
import { useDropZones } from '../game/dropZones';
import {
  RACK_COLS,
  type RackGeom,
  type RackSlots,
  autoArrange,
  emptyRack,
  slotAt,
  syncRack,
  validGroups,
} from '../game/rackLayout';
import type { OkeyClient } from '../net/useOkey';
import { colorNames, colors, font } from '../theme';

const ACTION_BAR = 64;

export function GameScreen({ client }: { client: OkeyClient }) {
  const { view, room } = client;
  if (!view || !room) {
    return (
      <View style={styles.center}>
        <Text style={styles.waiting}>Masa hazırlanıyor…</Text>
      </View>
    );
  }
  return <Table view={view} room={room} client={client} />;
}

/**
 * Sizes from the screen: rack tiles as large as width and about half the
 * height allow; everything else scales up on tablets (factor 1–1.6).
 */
function useLayoutSizes() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const scale = Math.min(1.6, Math.max(1, width / 852));
  const usableW = width - insets.left - insets.right - 12;
  const byWidth = Math.floor((usableW - RACK_PAD * 2 - 4) / RACK_COLS);
  const byHeight = Math.floor((height * 0.46 - 22) / 2.76);
  const tileW = Math.max(32, Math.min(96, byWidth, byHeight));
  const topH = height - insets.top - insets.bottom - rackHeight(tileW) - ACTION_BAR - 10;
  const pileW = Math.max(30, Math.min(Math.round(tileW * 0.9), Math.floor((topH - 70) / 1.38), 80));
  const sideW = Math.round(Math.max(136, pileW + 40) * scale);
  // Melds on the table: big enough to read (rank ≥ 18pt), but they must fit the table area.
  const tableH = topH - 56 * scale;
  const meldTileW = Math.max(26, Math.min(Math.round(38 * scale), Math.floor((tableH - 30) / 1.38)));
  return { tileW, pileW, sideW, topH, meldTileW, scale };
}

/** Gently pulses a highlight while `on`: shows where to act next. */
function Pulse({ on, children, style }: { on: boolean; children: ReactNode; style?: object }) {
  const v = useSharedValue(0);
  useEffect(() => {
    if (on) v.value = withRepeat(withTiming(1, { duration: 700 }), -1, true);
    else {
      cancelAnimation(v);
      v.value = 0;
    }
  }, [on, v]);
  const animated = useAnimatedStyle(() => ({
    borderColor: on ? `rgba(242,182,50,${0.35 + 0.65 * v.value})` : 'transparent',
    transform: [{ scale: 1 + 0.04 * v.value }],
  }));
  return <Animated.View style={[styles.pulse, style, animated]}>{children}</Animated.View>;
}

function tileName(t: Tile): string {
  return t.kind === 'fake' ? 'sahte okey' : `${colorNames[t.color]} ${t.value}`;
}

function Table({ view, room, client }: { view: PlayerView; room: RoomInfo; client: OkeyClient }) {
  const { tileW, pileW, sideW, topH, meldTileW } = useLayoutSizes();
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
  const myTurn = view.phase === 'playing' && view.turn === view.seat;
  const canDraw = myTurn && view.turnPhase === 'draw';
  const canPlay = myTurn && view.turnPhase === 'play';
  const rightSeat = (view.seat + 1) % 4;
  const acrossSeat = (view.seat + 2) % 4;
  const leftSeat = leftOf(view.seat);
  const leftTop = view.players[leftSeat].discards.at(-1);
  const leftUnder = view.players[leftSeat].discards.at(-2);
  const myTop = me.discards.at(-1);

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
    const t = setTimeout(() => setFresh(null), 2000);
    return () => clearTimeout(t);
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

  // Middle ran out and the discards were shuffled back in: say so, the game goes on.
  const seenReshuffles = useRef(view.reshuffles);
  useEffect(() => {
    if (view.reshuffles > seenReshuffles.current) {
      setInfo('Ortadaki taşlar bitti — yerdekiler karıştırıldı, oyun devam ediyor');
      play('draw');
      const t = setTimeout(() => setInfo(null), 4000);
      seenReshuffles.current = view.reshuffles;
      return () => clearTimeout(t);
    }
    seenReshuffles.current = view.reshuffles;
  }, [view.reshuffles]);

  const groups = useMemo(() => validGroups(slots, view.hand, view.okey), [slots, view.hand, view.okey]);
  const groupPoints = groups.reduce((s, g) => s + g.points, 0);
  const canOpen = canPlay && !me.opened && groupPoints >= OPEN_THRESHOLD;

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
      if (!res.ok) showToast(res.error);
      return res.ok;
    },
    [client, showToast],
  );

  const discard = (tileId: number) => {
    if (!canPlay) return showToast(canDraw ? 'Önce taş çek' : 'Sıra sende değil');
    setSelected(null);
    void send({ type: 'discard', tileId });
  };

  const onDropOnZone = (tileId: number, zone: string) => {
    if (zone !== 'discard' && !zone.startsWith('meld:')) return;
    if (zone === 'discard') discard(tileId);
    else if (!canPlay) showToast(canDraw ? 'Önce taş çek' : 'Sıra sende değil');
    else void send({ type: 'addToMeld', meldId: Number(zone.slice(5)), tileIds: [tileId] });
  };

  const draw = (source: 'deck' | 'discard', slot: number | null = null) => {
    if (!canDraw) return showToast(myTurn ? 'Bu el taşını çektin, şimdi bir taş at' : 'Sıra sende değil');
    pendingSlot.current = slot;
    void send({ type: 'draw', source });
  };
  // Dragging from a pile: drop it on the rack to draw it into that slot.
  const dropFromPile = (source: 'deck' | 'discard') => (x: number, y: number) => {
    const slot = slotAt(rackGeom.value, x, y);
    if (slot >= 0) draw(source, slot);
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

  // The whole right column is the discard target ("throw to the right").
  const discardRef = useRef<HostInstance>(null);
  useEffect(() => zones.register('discard', discardRef), [zones]);

  const totals = room.totals;
  const status = statusText(view, myTurn);
  const okeyText = `Okey: ${colorNames[view.okey.color]} ${view.okey.value}`;
  const openTitle = me.opened ? 'Per İndir' : `Aç ${groupPoints}/${OPEN_THRESHOLD}`;
  const openSub = me.opened
    ? undefined
    : groupPoints >= OPEN_THRESHOLD
      ? 'Açabilirsin!'
      : `${OPEN_THRESHOLD - groupPoints} sayı daha`;

  return (
    <View style={styles.root}>
      <View style={[styles.top, { height: topH }, dragging && styles.raised]}>
        <View style={[styles.side, { width: sideW }, dragging === 'discard' && styles.raised]}>
          <OpponentPanel
            player={view.players[leftSeat]}
            seatInfo={room.seats[leftSeat]}
            total={totals[leftSeat]}
            active={view.turn === leftSeat}
            okey={view.okey}
            showDiscard={false}
          />
          <Text style={styles.label}>Soldan al</Text>
          <Pulse on={canDraw && !!leftTop} style={{ width: pileW + 16, height: tileHeight(pileW) + 12 }}>
            {/* What stays on the table while the top tile is in the player's hand. */}
            {dragging === 'discard' ? (
              leftUnder ? <TileView tile={leftUnder} okey={view.okey} width={pileW} /> : <Text style={styles.label}>boş</Text>
            ) : !leftTop ? (
              <Text style={styles.label}>boş</Text>
            ) : null}
            {leftTop && (
              <DragSource
                enabled={canDraw}
                instantReturn
                style={styles.leftPileTop}
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
                <TileView tile={leftTop} okey={view.okey} width={pileW} />
              </DragSource>
            )}
          </Pulse>
        </View>

        <View style={[styles.middle, dragging === 'deck' && styles.raised]}>
          <View style={styles.headerRow}>
            <Button
              title={sound ? '🔊' : '🔇'}
              variant="secondary"
              onPress={() => {
                setSoundOn(!sound);
                setSound(!sound);
              }}
              style={styles.iconBtn}
            />
            <OpponentPanel
              player={view.players[acrossSeat]}
              seatInfo={room.seats[acrossSeat]}
              total={totals[acrossSeat]}
              active={view.turn === acrossSeat}
              okey={view.okey}
              horizontal
            />
            <Button title="Çık" variant="secondary" onPress={() => setConfirmLeave(true)} style={styles.iconBtn} />
          </View>
          <View style={styles.tableRow}>
            <View style={[styles.centerPile, dragging === 'deck' && styles.raised]}>
              <Pulse on={canDraw}>
                {/* The stack stays put; only its top tile follows the finger, and the count drops by one. */}
                {view.deckCount > 1 || dragging !== 'deck' ? <TileBack width={pileW} /> : <View style={{ width: pileW, height: tileHeight(pileW) }} />}
                {view.deckCount > 0 && (
                  <DragSource
                    enabled={canDraw}
                    instantReturn
                    style={styles.pileTop}
                    rackGeom={rackGeom}
                    hoverSlot={hoverSlot}
                    onTap={() => draw('deck')}
                    onDragStart={() => {
                      setDragging('deck');
                      zones.measureAll();
                    }}
                    onDragEnd={() => setDragging(null)}
                    onDrop={dropFromPile('deck')}
                  >
                    <TileBack width={pileW} />
                  </DragSource>
                )}
                <View style={styles.deckCountBox} pointerEvents="none">
                  <Text style={styles.deckCount}>{dragging === 'deck' ? view.deckCount - 1 : view.deckCount}</Text>
                </View>
              </Pulse>
              <View style={styles.indicatorBox}>
                <TileView tile={view.indicator} width={Math.round(pileW * 0.62)} />
                <Text style={styles.okeyText}>{okeyText}</Text>
              </View>
            </View>
            <View style={styles.tableArea}>
              <TableMelds
                table={view.table}
                players={view.players}
                myName={me.name}
                okey={view.okey}
                tileWidth={meldTileW}
                emptyText={`Açmak için ${OPEN_THRESHOLD} sayı gerekir`}
              />
            </View>
          </View>
        </View>

        <View ref={discardRef} collapsable={false} style={[styles.side, { width: sideW }]}>
          <OpponentPanel
            player={view.players[rightSeat]}
            seatInfo={room.seats[rightSeat]}
            total={totals[rightSeat]}
            active={view.turn === rightSeat}
            okey={view.okey}
            showDiscard={false}
          />
          <Text style={styles.label}>Buraya at</Text>
          <Pressable onPress={() => (selected !== null ? discard(selected) : undefined)}>
            <Pulse on={canPlay} style={[styles.discardZone, { width: pileW + 24, height: tileHeight(pileW) + 12 }]}>
              {myTop ? (
                <TileView tile={myTop} okey={view.okey} width={pileW} />
              ) : (
                <Text style={[styles.label, { textAlign: 'center' }]}>taşı buraya sürükle</Text>
              )}
            </Pulse>
          </Pressable>
        </View>
      </View>

      <View style={styles.actionBar}>
        <Button title="Diz" variant="secondary" onPress={() => moveOnRack(autoArrange(view.hand, view.okey))} />
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
            <Text style={[styles.status, myTurn && { color: colors.accent }]} numberOfLines={1} adjustsFontSizeToFit>
              {status}
            </Text>
          )}
        </View>
        <Button title="At" onPress={() => selected !== null && discard(selected)} disabled={!canPlay || selected === null} />
        <Button
          title={openTitle}
          subtitle={openSub}
          variant={canOpen ? 'success' : 'primary'}
          onPress={openOrLay}
          disabled={!canPlay || groups.length === 0 || (!me.opened && groupPoints < OPEN_THRESHOLD)}
          style={{ minWidth: 150 }}
        />
      </View>

      <View style={styles.rackRow}>
        <Rack
          hand={view.hand}
          okey={view.okey}
          slots={slots}
          tileWidth={tileW}
          selectedId={selected}
          freshId={fresh}
          rackGeom={rackGeom}
          hoverSlot={hoverSlot}
          onSlotsChange={moveOnRack}
          onBlocked={() => play('error', 0.4)}
          onSelect={(id) => {
            setSelected(id);
            if (id !== null) buzz('light');
          }}
          onDropOnZone={onDropOnZone}
        />
      </View>

      {view.phase === 'finished' && view.result && (
        <RoundResult
          view={view}
          room={room}
          onNext={async () => {
            const r = await client.nextRound();
            if (!r.ok) showToast(r.error);
          }}
          onLeave={client.leave}
        />
      )}

      {confirmLeave && (
        <ConfirmDialog
          message="Masadan kalkmak istiyor musun?"
          confirm="Evet, kalk"
          cancel="Hayır, oyna"
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
function statusText(view: PlayerView, myTurn: boolean): string {
  if (view.phase === 'finished') return 'El bitti';
  if (myTurn) {
    if (view.turnPhase === 'draw') return 'SIRA SENDE — TAŞ ÇEK';
    if (view.mustUseTileId !== null) return 'Yerden aldığın taşı kullan';
    return 'SIRA SENDE — BİR TAŞ AT';
  }
  return lastActionText(view) ?? `${view.players[view.turn].name} oynuyor…`;
}

function lastActionText(view: PlayerView): string | null {
  const a = view.lastAction;
  if (!a || a.seat === view.seat) return null;
  const name = view.players[a.seat].name;
  switch (a.type) {
    case 'open':
      return `${name} açtı (${a.points})`;
    case 'meld':
      return `${name} per indirdi`;
    case 'addToMeld':
      return `${name} pere taş işledi`;
    case 'draw':
      return a.source === 'discard' ? `${name} yerden aldı` : `${name} ortadan çekti`;
    case 'discard':
      return `${name} ${tileName(a.tile)} attı`;
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 6, paddingVertical: 4 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  waiting: { color: colors.text, fontSize: font.body },
  top: { flexDirection: 'row', gap: 6 },
  side: { alignItems: 'center', gap: 2 },
  middle: { flex: 1, gap: 4, alignItems: 'stretch' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  iconBtn: { minWidth: 64, minHeight: 48, paddingHorizontal: 10 },
  tableRow: { flex: 1, flexDirection: 'row', gap: 6 },
  centerPile: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  indicatorBox: { alignItems: 'center', width: 104 },
  okeyText: { color: colors.text, fontSize: font.small, fontWeight: '700', textAlign: 'center' },
  pileTop: { position: 'absolute', top: 2, left: 2 },
  // While a pile tile is held, lift its containers over the table, status bar and rack.
  raised: { zIndex: 50, elevation: 50 },
  // The left pile box is wider than a tile and centres it: border 4 + padding 2 + 2 of slack.
  leftPileTop: { position: 'absolute', top: 2, left: 4 },
  info: {
    color: '#0b3d2e',
    backgroundColor: colors.ok,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: 'hidden',
    fontSize: font.body,
    fontWeight: '800',
    textAlign: 'center',
  },
  pulse: { borderWidth: 4, borderRadius: 10, padding: 2, alignItems: 'center', justifyContent: 'center' },
  // Above the idle top tile (zIndex 1), below a tile being dragged (100).
  deckCountBox: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', zIndex: 5 },
  deckCount: { color: '#5a4a2a', fontWeight: '900', fontSize: 20 },
  tableArea: { flex: 1, backgroundColor: colors.feltLight, borderRadius: 10 },
  label: { color: colors.text, fontSize: font.small, fontWeight: '600' },
  discardZone: { backgroundColor: 'rgba(0,0,0,0.2)', borderStyle: 'solid' },
  actionBar: { height: ACTION_BAR, flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 2 },
  statusBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  status: { color: colors.text, fontSize: font.status, fontWeight: '800' },
  toast: {
    color: '#fff',
    backgroundColor: colors.danger,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: 'hidden',
    fontSize: font.body,
    fontWeight: '700',
    textAlign: 'center',
  },
  rackRow: { alignItems: 'center' },
});
