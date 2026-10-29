import { useEffect, useMemo, useRef, useState } from 'react';
import { type HostInstance, Pressable, StyleSheet, Text, View } from 'react-native';
import type { OkeyInfo, PublicPlayer, TableMeld, Tile } from '@okey/shared';
import { useDropZones } from '../game/dropZones';
import { colors, font } from '../theme';
import { TileView, tileHeight } from './TileView';

const GAP = 6;
const INSET = 4;
/** Meld box chrome around its tiles: padding 2 + border 2 on each side, plus the owner line. */
const MELD_X = 8;
const LABEL_H = 18;
const meldHeight = (w: number) => tileHeight(w) + 8 + LABEL_H;

/** Rows of melds laid left to right at tile width `w`. */
function pack(sizes: number[], areaW: number, w: number): number[][] {
  const rows: number[][] = [];
  let row: number[] = [];
  let x = 0;
  sizes.forEach((n, i) => {
    const mw = n * w + MELD_X;
    if (row.length && x + mw > areaW) {
      rows.push(row);
      row = [];
      x = 0;
    }
    row.push(i);
    x += mw + GAP;
  });
  if (row.length) rows.push(row);
  return rows;
}

/** Largest tile width (≤ max) at which every meld fits the area; used by the large view. */
export function fitTileWidth(sizes: number[], areaW: number, areaH: number, max: number, min = 16): number {
  for (let w = max; w > min; w--) {
    if (pack(sizes, areaW, w).length * (meldHeight(w) + GAP) <= areaH) return w;
  }
  return min;
}

/**
 * Inline table sizing (TASARIM.md §8): the largest tile that puts the most
 * melds (up to 3) on the first row; then as many whole rows as fit. Melds
 * that don't fit are hidden, never cut in half.
 */
function inlineFit(sizes: number[], areaW: number, areaH: number, max: number, min: number) {
  let best = { w: max, firstRow: 0 };
  for (let w = max; w >= min; w--) {
    const first = Math.min(3, pack(sizes, areaW, w)[0]?.length ?? 0);
    if (first > best.firstRow) best = { w, firstRow: first };
  }
  const rows = pack(sizes, areaW, best.w);
  const fitRows = Math.max(1, Math.floor((areaH + GAP) / (meldHeight(best.w) + GAP)));
  const shown = rows.slice(0, fitRows).flat().length;
  return { w: best.w, shown };
}

export function ownerLabel(meld: TableMeld, players: PublicPlayer[], mySeat: number) {
  return meld.owner === mySeat ? 'Sen' : (players[meld.owner]?.name ?? '');
}

/** Player's own melds first, then left, across, right — the seating order. */
const SEAT_ORDER = [0, 3, 2, 1];

export function sortMelds(table: TableMeld[], mySeat: number, first: Set<number> = new Set()) {
  return [...table].sort((a, b) => {
    const fa = first.has(a.id) ? 0 : 1;
    const fb = first.has(b.id) ? 0 : 1;
    const oa = SEAT_ORDER[(a.owner - mySeat + 4) % 4];
    const ob = SEAT_ORDER[(b.owner - mySeat + 4) % 4];
    return fa - fb || oa - ob || a.id - b.id;
  });
}

interface Props {
  table: TableMeld[];
  players: PublicPlayer[];
  mySeat: number;
  okey: OkeyInfo;
  maxTileWidth: number;
  /** Width of the "Tümü" button on the right. */
  zoomWidth: number;
  emptyText: string;
  /** Melds the selected tile can be added to: sorted first, glow, can be tapped. */
  highlight: Set<number>;
  onMeldPress(meldId: number): void;
  onZoom(): void;
}

/** The melds on the table, as many as fit readably, plus a button for the large view. */
export function TableMelds(p: Props) {
  const { table, players, mySeat, okey, highlight } = p;
  const [area, setArea] = useState({ w: 0, h: 0 });
  const melds = useMemo(() => sortMelds(table, mySeat, highlight), [table, mySeat, highlight]);
  const usableW = area.w - INSET * 2 - p.zoomWidth - GAP;
  const { w, shown } = useMemo(
    () => inlineFit(melds.map((m) => m.tiles.length), usableW, area.h - INSET * 2, p.maxTileWidth, 30),
    [melds, usableW, area.h, p.maxTileWidth],
  );
  const hidden = melds.length - shown;
  const hiddenLit = melds.slice(shown).some((m) => highlight.has(m.id));

  return (
    <Pressable
      style={styles.area}
      onPress={p.onZoom}
      onLayout={(e) => setArea({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
    >
      {table.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>{p.emptyText}</Text>
        </View>
      ) : (
        <>
          <View style={[styles.wrap, { width: usableW + INSET * 2 }]}>
            {area.w > 0 &&
              melds.slice(0, shown).map((m) => (
                <MeldView
                  key={m.id}
                  meld={m}
                  owner={ownerLabel(m, players, mySeat)}
                  okey={okey}
                  tileWidth={w}
                  lit={highlight.has(m.id)}
                  onPress={() => p.onMeldPress(m.id)}
                />
              ))}
          </View>
          <Pressable
            onPress={p.onZoom}
            style={[
              styles.zoom,
              { width: p.zoomWidth, maxHeight: 86 },
              hidden > 0 && styles.zoomMore,
              hiddenLit && styles.zoomLit,
            ]}
          >
            <Text style={styles.zoomIcon}>🔍</Text>
            <Text style={[styles.zoomText, hidden > 0 && { color: '#2b1d00' }]}>
              {hiddenLit ? 'Uyan\nper' : hidden > 0 ? `Tümü\n(${melds.length})` : 'Büyüt'}
            </Text>
          </Pressable>
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
  dim?: boolean;
  onPress(): void;
  /** Registered as a drop target (only the in-table copy, not the large view). */
  dropTarget?: boolean;
}

export function MeldView({ meld, owner, okey, tileWidth, lit, dim, onPress, dropTarget = true }: MeldProps) {
  const zones = useDropZones();
  const ref = useRef<HostInstance>(null);
  useEffect(() => (dropTarget ? zones.register(`meld:${meld.id}`, ref) : undefined), [zones, meld.id, dropTarget]);
  const byId = new Map<number, Tile>(meld.tiles.map((t) => [t.id, t]));
  return (
    <Pressable ref={ref} onPress={onPress} style={[styles.meld, lit && styles.lit, dim && { opacity: 0.45 }]} collapsable={false}>
      <View style={{ flexDirection: 'row' }}>
        {meld.ordered.map((id) => (
          <TileView key={id} tile={byId.get(id)!} okey={okey} width={tileWidth} />
        ))}
      </View>
      <Text style={styles.owner} numberOfLines={1}>
        {owner} · {meld.points}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  area: {
    flex: 1,
    flexDirection: 'row',
    overflow: 'hidden',
    borderRadius: 12,
    backgroundColor: colors.feltLight,
    padding: INSET,
  },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP, alignContent: 'flex-start', marginLeft: -INSET, paddingLeft: INSET },
  meld: {
    backgroundColor: 'rgba(0,0,0,0.18)',
    borderRadius: 8,
    padding: 2,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  lit: { borderColor: colors.ok, backgroundColor: 'rgba(95,208,125,0.25)' },
  owner: { color: colors.muted, fontSize: font.small, fontWeight: '600', height: LABEL_H, lineHeight: LABEL_H },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 8 },
  emptyText: { color: colors.text, fontSize: font.body, textAlign: 'center' },
  zoom: {
    position: 'absolute',
    right: INSET,
    top: INSET,
    bottom: INSET,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomMore: { backgroundColor: colors.accent },
  zoomLit: { backgroundColor: colors.ok },
  zoomIcon: { fontSize: 20 },
  zoomText: { color: colors.text, fontSize: font.small, fontWeight: '800', textAlign: 'center' },
});
