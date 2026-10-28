import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type HostInstance, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { type Action, type PlayerView, type RoomInfo, OPEN_THRESHOLD, leftOf } from '@okey/shared';
import { Button } from '../components/Button';
import { DragSource } from '../components/DragSource';
import { OpponentPanel } from '../components/OpponentPanel';
import { RACK_PAD, Rack, rackHeight } from '../components/Rack';
import { RoundResult } from '../components/RoundResult';
import { TableMelds } from '../components/TableMelds';
import { TileBack, TileView, tileHeight } from '../components/TileView';
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
import { colors } from '../theme';

const ACTION_BAR = 38;

export function GameScreen({ client }: { client: OkeyClient }) {
  const { view, room } = client;
  if (!view || !room) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Masa hazırlanıyor…</Text>
      </View>
    );
  }
  return <Table view={view} room={room} client={client} />;
}

/** Rack tiles as large as the screen allows: full width, at most about half the height. */
function useLayoutSizes() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const usableW = width - insets.left - insets.right - 12;
  const byWidth = Math.floor((usableW - RACK_PAD * 2 - 4) / RACK_COLS);
  const byHeight = Math.floor((height * 0.5 - 22) / 2.76);
  const tileW = Math.max(32, Math.min(72, byWidth, byHeight));
  const topH = height - insets.top - insets.bottom - rackHeight(tileW) - ACTION_BAR - 12;
  const pileW = Math.max(30, Math.min(Math.round(tileW * 0.85), Math.floor((topH - 85) / 1.38)));
  const sideW = Math.max(108, pileW + 40);
  return { tileW, pileW, sideW, topH };
}

function Table({ view, room, client }: { view: PlayerView; room: RoomInfo; client: OkeyClient }) {
  const { tileW, pileW, sideW, topH } = useLayoutSizes();
  const zones = useDropZones();
  const [slots, setSlots] = useState<RackSlots>(emptyRack);
  const [selected, setSelected] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rackGeom = useSharedValue<RackGeom | null>(null);
  const hoverSlot = useSharedValue(-1);
  /** Where a tile dragged from a pile should land once the server confirms the draw. */
  const pendingSlot = useRef<number | null>(null);

  const me = view.players[view.seat];
  const myTurn = view.phase === 'playing' && view.turn === view.seat;
  const canDraw = myTurn && view.turnPhase === 'draw';
  const canPlay = myTurn && view.turnPhase === 'play';
  const rightSeat = (view.seat + 1) % 4;
  const acrossSeat = (view.seat + 2) % 4;
  const leftSeat = leftOf(view.seat);
  const leftTop = view.players[leftSeat].discards.at(-1);
  const myTop = me.discards.at(-1);

  // Rack follows the hand; a brand-new hand (new round) gets auto-arranged.
  useEffect(() => {
    const prefer = pendingSlot.current;
    pendingSlot.current = null;
    setSlots((s) => {
      const known = new Set(s.filter((id) => id !== null));
      return view.hand.some((t) => known.has(t.id))
        ? syncRack(s, view.hand, prefer)
        : autoArrange(view.hand, view.okey);
    });
  }, [view.hand, view.okey]);

  useEffect(() => {
    if (selected !== null && !view.hand.some((t) => t.id === selected)) setSelected(null);
  }, [view.hand, selected]);

  const groups = useMemo(() => validGroups(slots, view.hand, view.okey), [slots, view.hand, view.okey]);
  const groupPoints = groups.reduce((s, g) => s + g.points, 0);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2800);
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
    setSelected(null);
    void send({ type: 'discard', tileId });
  };

  const onDropOnZone = (tileId: number, zone: string) => {
    if (zone !== 'discard' && !zone.startsWith('meld:')) return;
    if (!canPlay) return showToast(canDraw ? 'Önce taş çek' : 'Sıra sende değil');
    if (zone === 'discard') discard(tileId);
    else void send({ type: 'addToMeld', meldId: Number(zone.slice(5)), tileIds: [tileId] });
  };

  const draw = (source: 'deck' | 'discard', slot: number | null = null) => {
    if (!canDraw) return showToast(myTurn ? 'Bu tur zaten taş çektin' : 'Sıra sende değil');
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

  // The whole right column is the discard target ("throw to the right").
  const discardRef = useRef<HostInstance>(null);
  useEffect(() => zones.register('discard', discardRef), [zones]);

  const status = statusText(view, myTurn);
  const totals = room.totals;
  const lastText = lastActionText(view);

  return (
    <View style={styles.root}>
      <View style={[styles.top, { height: topH }]}>
        <View style={[styles.side, { width: sideW }]}>
          <OpponentPanel
            player={view.players[leftSeat]}
            seatInfo={room.seats[leftSeat]}
            total={totals[leftSeat]}
            active={view.turn === leftSeat}
            okey={view.okey}
            showDiscard={false}
          />
          <Text style={styles.tiny}>Soldan al</Text>
          <DragSource
            enabled={canDraw && !!leftTop}
            rackGeom={rackGeom}
            hoverSlot={hoverSlot}
            onTap={() => leftTop && draw('discard')}
            onDragStart={zones.measureAll}
            onDrop={dropFromPile('discard')}
          >
            <View style={[styles.pile, { width: pileW + 12, height: tileHeight(pileW) + 12 }, canDraw && leftTop && styles.glow]}>
              {leftTop ? <TileView tile={leftTop} okey={view.okey} width={pileW} /> : <Text style={styles.tiny}>boş</Text>}
            </View>
          </DragSource>
        </View>

        <View style={styles.middle}>
          <OpponentPanel
            player={view.players[acrossSeat]}
            seatInfo={room.seats[acrossSeat]}
            total={totals[acrossSeat]}
            active={view.turn === acrossSeat}
            okey={view.okey}
            horizontal
          />
          <View style={styles.tableRow}>
            <View style={styles.centerPile}>
              <DragSource
                enabled={canDraw}
                rackGeom={rackGeom}
                hoverSlot={hoverSlot}
                onTap={() => draw('deck')}
                onDragStart={zones.measureAll}
                onDrop={dropFromPile('deck')}
              >
                <View style={[styles.deck, canDraw && styles.glow]}>
                  <TileBack width={pileW} />
                  <View style={styles.deckCountBox}>
                    <Text style={styles.deckCount}>{view.deckCount}</Text>
                  </View>
                </View>
              </DragSource>
              <View style={{ alignItems: 'center' }}>
                <TileView tile={view.indicator} width={Math.round(pileW * 0.62)} />
                <Text style={styles.tiny}>Gösterge</Text>
              </View>
            </View>
            <View style={styles.tableArea}>
              <TableMelds table={view.table} players={view.players} okey={view.okey} />
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
          <Text style={styles.tiny}>At</Text>
          <Pressable
            onPress={() => (canPlay && selected !== null ? discard(selected) : undefined)}
            style={[
              styles.pile,
              styles.discardZone,
              { width: pileW + 24, height: tileHeight(pileW) + 12 },
              canPlay && styles.glow,
            ]}
          >
            {myTop ? <TileView tile={myTop} okey={view.okey} width={pileW} /> : <Text style={[styles.tiny, { textAlign: 'center' }]}>buraya sürükle</Text>}
          </Pressable>
        </View>
      </View>

      <View style={styles.actionBar}>
        <Button title="Diz" variant="secondary" onPress={() => setSlots(autoArrange(view.hand, view.okey))} />
        <View style={styles.statusBox}>
          {toast ? (
            <Text style={styles.toast} numberOfLines={1}>
              {toast}
            </Text>
          ) : (
            <Text style={[styles.status, myTurn && { color: colors.accent }]} numberOfLines={1}>
              {status}
              {lastText ? <Text style={styles.info}>{`  ·  ${lastText}`}</Text> : null}
            </Text>
          )}
        </View>
        {selected !== null && canPlay && <Button title="At" onPress={() => discard(selected)} />}
        <Button
          title={me.opened ? 'İndir' : `Aç ${groupPoints}`}
          onPress={openOrLay}
          disabled={!canPlay || groups.length === 0 || (!me.opened && groupPoints < OPEN_THRESHOLD)}
        />
        <Button title="Çık" variant="secondary" onPress={client.leave} />
      </View>

      <View style={styles.rackRow}>
        <Rack
          hand={view.hand}
          okey={view.okey}
          slots={slots}
          tileWidth={tileW}
          selectedId={selected}
          rackGeom={rackGeom}
          hoverSlot={hoverSlot}
          onSlotsChange={setSlots}
          onSelect={setSelected}
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
    </View>
  );
}

function statusText(view: PlayerView, myTurn: boolean): string {
  if (view.phase === 'finished') return 'El bitti';
  if (!myTurn) return `${view.players[view.turn].name} oynuyor…`;
  if (view.turnPhase === 'draw') return 'Sıra sende: ortadan ya da soldan taşı ıstakaya sürükle (ya da dokun)';
  if (view.mustUseTileId !== null) return 'Yerden aldığın taşı kullan (yoksa 101 ceza), sonra sağa at';
  return view.players[view.seat].opened
    ? 'Per indir ya da taşı pere sürükleyip işle, sonra sağa at'
    : `Perleri yan yana diz, ${OPEN_THRESHOLD} olunca Aç — ya da taşı sağa sürükleyip at`;
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
      return `${name} işledi`;
    case 'draw':
      return a.source === 'discard' ? `${name} yerden aldı` : null;
    default:
      return null;
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 6, paddingVertical: 4 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  muted: { color: colors.muted },
  top: { flexDirection: 'row', gap: 6 },
  side: { alignItems: 'center', gap: 3 },
  middle: { flex: 1, gap: 4, alignItems: 'center' },
  tableRow: { flex: 1, flexDirection: 'row', alignSelf: 'stretch', gap: 6 },
  centerPile: { alignItems: 'center', justifyContent: 'center', gap: 4 },
  deck: { alignItems: 'center', borderRadius: 8, padding: 4, borderWidth: 2, borderColor: 'transparent' },
  deckCountBox: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  deckCount: { color: '#5a4a2a', fontWeight: '900', fontSize: 16 },
  tableArea: { flex: 1, backgroundColor: colors.feltLight, borderRadius: 10 },
  actionBar: { height: ACTION_BAR, flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 2 },
  statusBox: { flex: 1, alignItems: 'center' },
  status: { color: colors.text, fontSize: 13, fontWeight: '600' },
  info: { color: colors.ok, fontSize: 12, fontWeight: '400' },
  toast: {
    color: '#fff',
    backgroundColor: colors.danger,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
    overflow: 'hidden',
    fontSize: 13,
    fontWeight: '700',
  },
  rackRow: { alignItems: 'center' },
  pile: {
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.25)',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  discardZone: { backgroundColor: 'rgba(0,0,0,0.15)' },
  glow: { borderColor: colors.accent, borderStyle: 'solid' },
  tiny: { color: colors.muted, fontSize: 10 },
});
