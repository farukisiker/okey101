import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type HostInstance, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { type Action, type PlayerView, type RoomInfo, OPEN_THRESHOLD, leftOf } from '@okey/shared';
import { Button } from '../components/Button';
import { OpponentPanel } from '../components/OpponentPanel';
import { Rack } from '../components/Rack';
import { RoundResult } from '../components/RoundResult';
import { TableMelds } from '../components/TableMelds';
import { TileBack, TileView } from '../components/TileView';
import { useDropZones } from '../game/dropZones';
import { type RackSlots, autoArrange, emptyRack, syncRack, validGroups } from '../game/rackLayout';
import type { OkeyClient } from '../net/useOkey';
import { colors } from '../theme';

const SIDE = 76;

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

function Table({ view, room, client }: { view: PlayerView; room: RoomInfo; client: OkeyClient }) {
  const { width, height } = useWindowDimensions();
  const zones = useDropZones();
  const [slots, setSlots] = useState<RackSlots>(emptyRack);
  const [selected, setSelected] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    setSlots((s) => {
      const known = new Set(s.filter((id) => id !== null));
      return view.hand.some((t) => known.has(t.id)) ? syncRack(s, view.hand) : autoArrange(view.hand, view.okey);
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
    if (!canPlay) return showToast(canDraw ? 'Önce taş çek' : 'Sıra sende değil');
    if (zone === 'discard') discard(tileId);
    else if (zone.startsWith('meld:')) void send({ type: 'addToMeld', meldId: Number(zone.slice(5)), tileIds: [tileId] });
  };

  const openOrLay = async () => {
    if (!me.opened) {
      await send({ type: 'open', melds: groups.map((g) => g.tileIds) });
      return;
    }
    for (const g of groups) if (!(await send({ type: 'meld', tileIds: g.tileIds }))) break;
  };

  // Layout: rack sized to the screen width, opponents and table share the rest.
  const tileW = Math.max(30, Math.min(50, Math.floor((width - SIDE * 2 - 48) / 13)));
  const discardZoneRef = useRef<HostInstance>(null);
  useEffect(() => zones.register('discard', discardZoneRef), [zones]);

  const status = statusText(view, myTurn);
  const totals = room.totals;

  return (
    <View style={styles.root}>
      <View style={[styles.top, { height: height * 0.5 }]}>
        <OpponentPanel
          player={view.players[leftSeat]}
          seatInfo={room.seats[leftSeat]}
          total={totals[leftSeat]}
          active={view.turn === leftSeat}
          okey={view.okey}
          showDiscard={false}
        />
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
              <Pressable onPress={() => canDraw && send({ type: 'draw', source: 'deck' })} disabled={!canDraw}>
                <View style={[styles.deck, canDraw && styles.glow]}>
                  <TileBack width={34} />
                  <Text style={styles.deckCount}>{view.deckCount}</Text>
                </View>
              </Pressable>
              <View style={{ alignItems: 'center' }}>
                <TileView tile={view.indicator} width={30} />
                <Text style={styles.tiny}>Gösterge</Text>
              </View>
            </View>
            <View style={styles.tableArea}>
              <TableMelds table={view.table} players={view.players} okey={view.okey} />
            </View>
          </View>
        </View>
        <OpponentPanel
          player={view.players[rightSeat]}
          seatInfo={room.seats[rightSeat]}
          total={totals[rightSeat]}
          active={view.turn === rightSeat}
          okey={view.okey}
        />
      </View>

      <View style={styles.statusBar}>
        <Text style={[styles.status, myTurn && { color: colors.accent }]} numberOfLines={1}>
          {status}
        </Text>
        {lastActionText(view) && <Text style={styles.info}>{lastActionText(view)}</Text>}
        {toast && <Text style={styles.toast}>{toast}</Text>}
      </View>

      <View style={styles.bottom}>
        <View style={[styles.side, { width: SIDE }]}>
          <Text style={styles.tiny}>Soldan al</Text>
          <Pressable
            onPress={() => canDraw && leftTop && send({ type: 'draw', source: 'discard' })}
            disabled={!canDraw || !leftTop}
            style={[styles.pile, canDraw && leftTop && styles.glow]}
          >
            {leftTop ? <TileView tile={leftTop} okey={view.okey} width={tileW} /> : <Text style={styles.tiny}>boş</Text>}
          </Pressable>
          <Button title="Diz" variant="secondary" onPress={() => setSlots(autoArrange(view.hand, view.okey))} />
        </View>

        <Rack
          hand={view.hand}
          okey={view.okey}
          slots={slots}
          tileWidth={tileW}
          selectedId={selected}
          onSlotsChange={setSlots}
          onSelect={setSelected}
          onDropOnZone={onDropOnZone}
        />

        <View style={[styles.side, { width: SIDE }]}>
          <View ref={discardZoneRef} collapsable={false} style={[styles.pile, styles.discardZone, canPlay && styles.glow]}>
            {myTop ? <TileView tile={myTop} okey={view.okey} width={tileW} /> : <Text style={styles.tiny}>At</Text>}
          </View>
          {selected !== null && canPlay ? (
            <Button title="At" onPress={() => discard(selected)} />
          ) : (
            <Button
              title={me.opened ? 'İndir' : `Aç ${groupPoints}`}
              onPress={openOrLay}
              disabled={!canPlay || groups.length === 0 || (!me.opened && groupPoints < OPEN_THRESHOLD)}
            />
          )}
          <Button title="Çık" variant="secondary" onPress={client.leave} />
        </View>
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
  if (view.turnPhase === 'draw') return 'Sıra sende: ortadan ya da soldan taş çek';
  if (view.mustUseTileId !== null) return 'Yerden aldığın taşı kullan (kullanmazsan 101 ceza), sonra taş at';
  return view.players[view.seat].opened
    ? 'Per indir / taşı pere sürükleyip işle, sonra taş at'
    : `Perlerini ıstakada yan yana diz, ${OPEN_THRESHOLD} olunca Aç — ya da taş at`;
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
  root: { flex: 1, padding: 6 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  muted: { color: colors.muted },
  top: { flexDirection: 'row', gap: 6, alignItems: 'flex-start' },
  middle: { flex: 1, gap: 4, alignItems: 'center' },
  tableRow: { flex: 1, flexDirection: 'row', alignSelf: 'stretch', gap: 6 },
  centerPile: { alignItems: 'center', justifyContent: 'center', gap: 6 },
  deck: { alignItems: 'center', borderRadius: 6, padding: 2 },
  deckCount: { color: colors.text, fontWeight: '800', fontSize: 12 },
  tableArea: { flex: 1, backgroundColor: colors.feltLight, borderRadius: 10 },
  statusBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, height: 22 },
  status: { color: colors.text, fontSize: 13, fontWeight: '600' },
  info: { color: colors.ok, fontSize: 12 },
  toast: {
    color: '#fff',
    backgroundColor: colors.danger,
    paddingHorizontal: 8,
    borderRadius: 6,
    overflow: 'hidden',
    fontSize: 12,
  },
  bottom: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 8 },
  side: { alignItems: 'center', gap: 6 },
  pile: {
    minWidth: 44,
    minHeight: 60,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  discardZone: { minWidth: 60, minHeight: 76 },
  glow: { borderColor: colors.accent, borderWidth: 2, borderStyle: 'solid' },
  tiny: { color: colors.muted, fontSize: 10 },
});
