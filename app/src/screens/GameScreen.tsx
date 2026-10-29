import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type HostInstance, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { type Action, type PlayerView, type RoomInfo, type Tile, OPEN_THRESHOLD, addableTiles, leftOf } from '@okey/shared';
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
import { colorNames, colors, font } from '../theme';

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

/** Exact width and height for a button, overriding its minimums. */
function fixed(width: number, height: number) {
  return { width, minWidth: width, height, minHeight: height, paddingHorizontal: 4 };
}

function tileName(t: Tile): string {
  return t.kind === 'fake' ? 'sahte okey' : `${colorNames[t.color]} ${t.value}`;
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

  // "İşlek" tiles: hand tiles that fit a meld on the table. Marked on the rack;
  // selecting one lights up the melds it fits.
  const addable = useMemo(() => addableTiles(view.hand, view.table, view.okey), [view.hand, view.table, view.okey]);
  const addableIds = useMemo(() => new Set(addable.keys()), [addable]);
  const highlight = useMemo(() => new Set(selected === null ? [] : (addable.get(selected) ?? [])), [addable, selected]);
  const [zoomed, setZoomed] = useState(false);
  const [confirmIslek, setConfirmIslek] = useState<number | null>(null);

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

  const doDiscard = (tileId: number) => {
    setSelected(null);
    void send({ type: 'discard', tileId });
  };
  const discard = (tileId: number) => {
    if (!canPlay) return showToast(canDraw ? 'Önce taş çek' : 'Sıra sende değil');
    // Throwing a tile that fits a meld on the table usually helps the next player: ask first.
    if (addable.has(tileId)) return setConfirmIslek(tileId);
    doDiscard(tileId);
  };

  const addToMeld = (tileId: number, meldId: number) => {
    if (!canPlay) return showToast(canDraw ? 'Önce taş çek' : 'Sıra sende değil');
    if (!me.opened) return showToast('Pere taş eklemek için önce açmalısın');
    setSelected(null);
    void send({ type: 'addToMeld', meldId, tileIds: [tileId] });
  };

  // Tapping a meld with a fitting tile selected adds it; otherwise opens the large view.
  const onMeldPress = (meldId: number) => {
    if (selected !== null && highlight.has(meldId)) return addToMeld(selected, meldId);
    setZoomed(true);
  };

  const onDropOnZone = (tileId: number, zone: string) => {
    if (zone === 'discard') discard(tileId);
    else if (zone.startsWith('meld:')) addToMeld(tileId, Number(zone.slice(5)));
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

  // The discard zone is a drop target for tiles dragged off the rack.
  const discardRef = useRef<HostInstance>(null);
  useEffect(() => zones.register('discard', discardRef), [zones]);

  const totals = room.totals;
  const status = statusText(view, myTurn, addable.size > 0);
  const okeyName = `${colorNames[view.okey.color]} ${view.okey.value}`;
  const openTitle = me.opened ? 'Per İndir' : `Aç ${groupPoints}/${OPEN_THRESHOLD}`;
  const openSub = me.opened
    ? undefined
    : groupPoints >= OPEN_THRESHOLD
      ? 'Açabilirsin!'
      : `${OPEN_THRESHOLD - groupPoints} sayı daha`;

  const cellW = Math.floor((L.drawW - 12) / 2);
  const emptyFrame = <View style={[styles.emptyFrame, { width: L.pileW - 2, height: L.pileH - 2 }]} />;

  return (
    <View style={[styles.root, { paddingTop: L.gap }]}>
      {/* 1 · Header strip: leave, sound, the three opponents in seating order, the okey. */}
      <View style={[styles.row, { height: L.headH }]}>
        <Button
          title="Çık"
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
              active={view.turn === seat}
              width={L.oppW}
              height={L.headH}
            />
          </View>
        ))}
        <View style={{ flex: 1 }} />
        <View style={[styles.okeyBox, { width: L.okW, height: L.headH }]}>
          <TileView tile={view.indicator} width={28} />
          <View>
            <Text style={styles.okeyLabel}>Okey</Text>
            <Text style={styles.okeyValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
              {okeyName}
            </Text>
          </View>
        </View>
      </View>

      {/* 2 · Zones: draw (deck, left discard) · table · discard. */}
      <View style={[styles.zones, { marginTop: L.gap }, dragging && styles.raised]}>
        <View style={[styles.zone, styles.drawZone, { width: L.drawW, height: L.sideH }, dragging && styles.raised]}>
          <View style={[styles.cell, { width: cellW }, dragging === 'deck' && styles.raised]}>
            <Pulse on={canDraw}>
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
                  onTap={() => draw('deck')}
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
            <Text style={styles.zoneLabel}>Deste</Text>
          </View>
          <View style={[styles.cell, { width: cellW }, dragging === 'discard' && styles.raised]}>
            <Pulse on={canDraw && !!leftTop}>
              {/* What stays on the table while the top tile is in the player's hand. */}
              {dragging === 'discard'
                ? leftUnder
                  ? <TileView tile={leftUnder} okey={view.okey} width={L.pileW} />
                  : emptyFrame
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
            <Text style={styles.zoneLabel} numberOfLines={1}>
              Soldan al
            </Text>
          </View>
        </View>

        <View style={{ flex: 1, height: L.zoneH, marginHorizontal: 6 }}>
          <TableMelds
            table={view.table}
            players={view.players}
            mySeat={view.seat}
            okey={view.okey}
            maxTileWidth={L.meldCap}
            zoomWidth={Math.round(56 * L.s)}
            emptyText={`Açmak için ${OPEN_THRESHOLD} sayı gerekir`}
            highlight={highlight}
            onMeldPress={onMeldPress}
            onZoom={() => view.table.length > 0 && setZoomed(true)}
          />
        </View>

        <Pressable
          ref={discardRef}
          collapsable={false}
          onPress={() => (selected !== null ? discard(selected) : undefined)}
          style={[styles.zone, styles.cell, { width: L.discW, height: L.sideH }]}
        >
          <Pulse on={canPlay}>{myTop ? <TileView tile={myTop} okey={view.okey} width={L.pileW} /> : emptyFrame}</Pulse>
          <Text style={styles.zoneLabel}>Buraya at</Text>
        </Pressable>
      </View>

      {/* 3 · Actions: arrange · status · throw · open. */}
      <View style={[styles.row, { height: L.actH, gap: L.ag, marginTop: L.gap }]}>
        <Button
          title="Diz"
          variant="secondary"
          onPress={() => moveOnRack(autoArrange(view.hand, view.okey))}
          style={fixed(L.dizW, L.actH)}
        />
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
          title="At"
          onPress={() => selected !== null && discard(selected)}
          disabled={!canPlay || selected === null}
          style={fixed(L.atW, L.actH)}
        />
        <Button
          title={openTitle}
          subtitle={openSub}
          variant={canOpen ? 'success' : 'primary'}
          onPress={openOrLay}
          disabled={!canPlay || groups.length === 0 || (!me.opened && groupPoints < OPEN_THRESHOLD)}
          style={fixed(L.acW, L.actH)}
        />
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
            if (!r.ok) showToast(r.error);
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
          message="Bu taş yerdeki bir pere işlenebilir. Yine de atmak istiyor musun?"
          confirm="Evet, at"
          cancel="Hayır"
          onConfirm={() => {
            const id = confirmIslek;
            setConfirmIslek(null);
            doDiscard(id);
          }}
          onCancel={() => setConfirmIslek(null)}
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
function statusText(view: PlayerView, myTurn: boolean, hasAddable: boolean): string {
  if (view.phase === 'finished') return 'El bitti';
  if (myTurn) {
    if (view.turnPhase === 'draw') return 'SIRA SENDE — TAŞ ÇEK';
    if (view.mustUseTileId !== null) return 'Yerden aldığın taşı kullan';
    if (hasAddable && view.players[view.seat].opened) return '"+" işaretli taşı pere ekleyebilirsin';
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
  statusBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
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
