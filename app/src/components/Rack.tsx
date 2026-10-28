import { useCallback, useEffect, useRef } from 'react';
import { type HostInstance, StyleSheet, View } from 'react-native';
import type { OkeyInfo, Tile } from '@okey/shared';
import { useDropZones } from '../game/dropZones';
import { RACK_COLS, RACK_ROWS, type RackSlots, moveTile } from '../game/rackLayout';
import { colors } from '../theme';
import { DraggableTile } from './DraggableTile';
import { tileHeight } from './TileView';

interface Props {
  hand: Tile[];
  okey: OkeyInfo;
  slots: RackSlots;
  tileWidth: number;
  selectedId: number | null;
  onSlotsChange(slots: RackSlots): void;
  onSelect(tileId: number | null): void;
  /** A tile was dropped on a zone outside the rack (discard pile, a table meld). */
  onDropOnZone(tileId: number, zone: string): void;
}

const PAD = 6;
const SHELF = 6;

/** The istaka: two shelves of slots; drag tiles to rearrange, or out to play them. */
export function Rack(p: Props) {
  const zones = useDropZones();
  const ref = useRef<HostInstance>(null);
  useEffect(() => zones.register('rack', ref), [zones]);

  const w = p.tileWidth;
  const h = tileHeight(w);
  const rowH = h + SHELF;

  // Keep the latest props for gesture callbacks without re-creating them.
  const latest = useRef(p);
  latest.current = p;

  const onDragStart = useCallback(() => zones.measureAll(), [zones]);
  const onTap = useCallback((id: number) => {
    const { selectedId, onSelect } = latest.current;
    onSelect(selectedId === id ? null : id);
  }, []);
  const onDrop = useCallback(
    (id: number, x: number, y: number) => {
      const hit = zones.hitTest(x, y);
      if (!hit) return;
      const cur = latest.current;
      if (hit.key === 'rack') {
        const col = Math.floor((x - hit.rect.x - PAD) / w);
        const row = Math.floor((y - hit.rect.y - PAD) / rowH);
        if (col < 0 || col >= RACK_COLS || row < 0 || row >= RACK_ROWS) return;
        cur.onSlotsChange(moveTile(cur.slots, id, row * RACK_COLS + col));
      } else {
        cur.onDropOnZone(id, hit.key);
      }
    },
    [zones, w, rowH],
  );

  const byId = new Map(p.hand.map((t) => [t.id, t]));

  return (
    <View
      ref={ref}
      style={[styles.rack, { width: RACK_COLS * w + PAD * 2, height: RACK_ROWS * rowH + PAD * 2 - SHELF + 4 }]}
    >
      {Array.from({ length: RACK_ROWS }, (_, r) => (
        <View key={r} style={[styles.shelf, { top: PAD + r * rowH + h - 2, width: RACK_COLS * w }]} />
      ))}
      {p.slots.map((id, i) => {
        const tile = id === null ? undefined : byId.get(id);
        if (!tile) return null;
        const row = Math.floor(i / RACK_COLS);
        const col = i % RACK_COLS;
        return (
          <DraggableTile
            key={tile.id}
            tile={tile}
            okey={p.okey}
            width={w}
            left={PAD + col * w}
            top={PAD + row * rowH}
            selected={p.selectedId === tile.id}
            onTap={onTap}
            onDragStart={onDragStart}
            onDrop={onDrop}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  rack: {
    backgroundColor: colors.wood,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.woodDark,
    overflow: 'visible',
  },
  shelf: {
    position: 'absolute',
    left: PAD,
    height: 6,
    backgroundColor: colors.woodDark,
    borderRadius: 3,
  },
});
