import { useEffect, useMemo, useRef, useState } from 'react';
import { type HostInstance, Pressable, StyleSheet, Text, View } from 'react-native';
import type { OkeyInfo, PublicPlayer, TableMeld, Tile } from '@okey/shared';
import { useDropZones } from '../game/dropZones';
import { colors, font } from '../theme';
import { TileView, tileHeight } from './TileView';

const GAP = 6;
const MELD_PAD = 4;
const LABEL_H = 18;
/** A strip on the right kept free for the zoom button, so it never covers a meld. */
const ZOOM_W = 58;

/**
 * Largest tile width (≤ max) at which every meld fits the area without
 * scrolling, packing melds left to right into rows.
 */
export function fitTileWidth(sizes: number[], areaW: number, areaH: number, max: number, min = 16): number {
  return fitTiles(sizes, areaW, areaH, max, min).w;
}

/** Like fitTileWidth, and says whether everything fits even at the smallest size. */
export function fitTiles(sizes: number[], areaW: number, areaH: number, max: number, min = 16) {
  for (let w = max; w >= min; w--) {
    const meldH = tileHeight(w) + MELD_PAD * 2 + LABEL_H;
    let rows = 1;
    let x = 0;
    for (const n of sizes) {
      const mw = n * w + MELD_PAD * 2;
      if (x > 0 && x + mw > areaW) {
        rows++;
        x = 0;
      }
      x += mw + GAP;
    }
    if (rows * (meldH + GAP) <= areaH) return { w, fits: true };
  }
  return { w: min, fits: false };
}

export function ownerLabel(meld: TableMeld, players: PublicPlayer[], mySeat: number) {
  return meld.owner === mySeat ? 'Sen' : (players[meld.owner]?.name ?? '');
}

/** Melds sorted so each player's melds sit together, the player's own first. */
export function sortMelds(table: TableMeld[], mySeat: number) {
  return [...table].sort((a, b) => {
    const oa = (a.owner - mySeat + 4) % 4;
    const ob = (b.owner - mySeat + 4) % 4;
    return oa - ob || a.id - b.id;
  });
}

interface Props {
  table: TableMeld[];
  players: PublicPlayer[];
  mySeat: number;
  okey: OkeyInfo;
  maxTileWidth: number;
  emptyText: string;
  /** Melds the selected tile can be added to; they glow and can be tapped. */
  highlight: Set<number>;
  onMeldPress(meldId: number): void;
  /** Tap on the table itself: open the large view. */
  onZoom(): void;
}

/**
 * Every meld on the table, shrunk just enough to fit the area so nothing is
 * hidden behind a scroll. Each meld is also a drop target for adding a tile.
 */
export function TableMelds({ table, players, mySeat, okey, maxTileWidth, emptyText, highlight, onMeldPress, onZoom }: Props) {
  const [area, setArea] = useState({ w: 0, h: 0 });
  const melds = useMemo(() => sortMelds(table, mySeat), [table, mySeat]);
  // Below ~20pt a tile can't be read; then the rest is clipped and the large view takes over.
  const { w, fits } = useMemo(
    () => fitTiles(melds.map((m) => m.tiles.length), area.w - 12 - ZOOM_W, area.h - 12, maxTileWidth, 20),
    [melds, area, maxTileWidth],
  );

  return (
    <Pressable
      style={styles.area}
      onPress={onZoom}
      onLayout={(e) => setArea({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
    >
      {table.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>{emptyText}</Text>
        </View>
      ) : (
        <>
          <View style={styles.wrap}>
            {melds.map((m) => (
              <MeldView
                key={m.id}
                meld={m}
                owner={ownerLabel(m, players, mySeat)}
                okey={okey}
                tileWidth={w}
                lit={highlight.has(m.id)}
                onPress={() => onMeldPress(m.id)}
              />
            ))}
          </View>
          {/* When melds are clipped and the selected tile fits one, the button turns green: look here. */}
          <View
            style={[styles.zoomHint, !fits && styles.zoomHintMore, !fits && highlight.size > 0 && styles.zoomHintLit]}
            pointerEvents="none"
          >
            <Text style={styles.zoomIcon}>🔍</Text>
            <Text style={[styles.zoomText, !fits && { color: '#2b1d00' }]}>
              {fits ? 'Büyüt' : highlight.size > 0 ? 'Uyan per\nburada' : `Tümü\n(${table.length})`}
            </Text>
          </View>
        </>
      )}
    </Pressable>
  );
}

interface MeldProps {
  meld: TableMeld;
  owner: string;
  okey: OkeyInfo;
  tileWidth: number;
  lit: boolean;
  onPress(): void;
  /** Registered as a drop target (only the in-table copy, not the large view). */
  dropTarget?: boolean;
}

export function MeldView({ meld, owner, okey, tileWidth, lit, onPress, dropTarget = true }: MeldProps) {
  const zones = useDropZones();
  const ref = useRef<HostInstance>(null);
  useEffect(() => (dropTarget ? zones.register(`meld:${meld.id}`, ref) : undefined), [zones, meld.id, dropTarget]);
  const byId = new Map<number, Tile>(meld.tiles.map((t) => [t.id, t]));
  return (
    <Pressable ref={ref} onPress={onPress} style={[styles.meld, lit && styles.lit]} collapsable={false}>
      <View style={{ flexDirection: 'row' }}>
        {meld.ordered.map((id) => (
          <TileView key={id} tile={byId.get(id)!} okey={okey} width={tileWidth} />
        ))}
      </View>
      <Text style={[styles.owner, tileWidth < 26 && { fontSize: 12 }]} numberOfLines={1}>
        {owner} · {meld.points}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  area: { flex: 1, overflow: 'hidden', borderRadius: 10 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP, padding: 6, paddingRight: 6 + ZOOM_W, alignContent: 'flex-start' },
  meld: {
    backgroundColor: 'rgba(0,0,0,0.18)',
    borderRadius: 8,
    padding: MELD_PAD - 2,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  lit: { borderColor: colors.ok, backgroundColor: 'rgba(95,208,125,0.25)' },
  owner: { color: colors.muted, fontSize: 14, height: LABEL_H },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 8 },
  emptyText: { color: colors.text, fontSize: font.body, textAlign: 'center' },
  zoomHint: {
    position: 'absolute',
    right: 4,
    top: 4,
    bottom: 4,
    width: ZOOM_W - 6,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomIcon: { fontSize: 20 },
  zoomHintMore: { backgroundColor: colors.accent },
  zoomHintLit: { backgroundColor: colors.ok },
  zoomText: { color: colors.text, fontSize: 13, fontWeight: '800', textAlign: 'center' },
});
