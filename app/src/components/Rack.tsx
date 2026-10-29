import { useCallback, useEffect, useRef } from 'react';
import { type HostInstance, Pressable, StyleSheet, View } from 'react-native';
import Animated, { type SharedValue, useAnimatedStyle } from 'react-native-reanimated';
import type { OkeyInfo, Tile } from '@okey/shared';
import { useDropZones } from '../game/dropZones';
import { RACK_COLS, RACK_ROWS, type RackGeom, type RackSlots, placeTile, slotAt } from '../game/rackLayout';
import { colors } from '../theme';
import { DragSource } from './DragSource';
import { TileView, tileHeight } from './TileView';

interface Props {
  hand: Tile[];
  okey: OkeyInfo;
  slots: RackSlots;
  tileWidth: number;
  selectedId: number | null;
  /** The tile just drawn; it glows for a moment. */
  freshId: number | null;
  /** Tiles that fit a meld on the table; they get a small "+" mark. */
  addableIds: Set<number>;
  rackGeom: SharedValue<RackGeom | null>;
  hoverSlot: SharedValue<number>;
  /** The player moved a tile to an empty slot. */
  onSlotsChange(slots: RackSlots): void;
  /** A drop on an occupied slot: nothing moves. */
  onBlocked(): void;
  onSelect(tileId: number | null): void;
  /** A tile was dropped outside the rack (discard pile, a table meld). */
  onDropOnZone(tileId: number, zone: string): void;
  /** Safe-area insets: the wood runs edge to edge and under the home indicator. */
  bleedLeft: number;
  bleedRight: number;
  bleedBottom: number;
}

/** Vertical gap above, between and below the two rows. */
const GAP = 4;

export function rackHeight(tileW: number) {
  return RACK_ROWS * tileHeight(tileW) + (RACK_ROWS + 1) * GAP;
}

/**
 * The istaka: a wooden band across the whole screen with two shelves of
 * slots; drag tiles to rearrange, or out to play them.
 */
export function Rack(p: Props) {
  const zones = useDropZones();
  const ref = useRef<HostInstance>(null);
  useEffect(() => zones.register('rack', ref), [zones]);

  const w = p.tileWidth;
  const h = tileHeight(w);
  const rowH = h + GAP;
  const { rackGeom, hoverSlot } = p;

  const measure = useCallback(() => {
    ref.current?.measureInWindow((x, y) => {
      rackGeom.value = { x, y, padX: 0, padY: GAP, tileW: w, rowH };
    });
  }, [rackGeom, w, rowH]);

  // Keep the latest props for gesture callbacks without re-creating them.
  const latest = useRef(p);
  latest.current = p;

  const onDragStart = useCallback(() => {
    measure();
    zones.measureAll();
  }, [zones, measure]);

  const handlers = useRef(new Map<number, { tap(): void; drop(x: number, y: number): void }>());
  const handlersFor = (id: number) => {
    let hnd = handlers.current.get(id);
    if (!hnd) {
      hnd = {
        tap: () => {
          const { selectedId, onSelect } = latest.current;
          onSelect(selectedId === id ? null : id);
        },
        drop: (x, y) => {
          const cur = latest.current;
          const slot = slotAt(rackGeom.value, x, y);
          if (slot >= 0) {
            if (cur.slots[slot] === id) return;
            const next = placeTile(cur.slots, id, slot);
            return next === cur.slots ? cur.onBlocked() : cur.onSlotsChange(next);
          }
          const hit = zones.hitTest(x, y);
          if (hit && hit.key !== 'rack') cur.onDropOnZone(id, hit.key);
        },
      };
      handlers.current.set(id, hnd);
    }
    return hnd;
  };

  const marker = useAnimatedStyle(() => {
    const s = hoverSlot.value;
    if (s < 0) return { opacity: 0 };
    return {
      opacity: 1,
      left: (s % RACK_COLS) * w,
      top: GAP + Math.floor(s / RACK_COLS) * rowH,
    };
  });

  const byId = new Map(p.hand.map((t) => [t.id, t]));

  return (
    <View
      style={[
        styles.band,
        {
          height: rackHeight(w) + p.bleedBottom,
          marginLeft: -p.bleedLeft,
          marginRight: -p.bleedRight,
          paddingBottom: p.bleedBottom,
        },
      ]}
    >
      <View ref={ref} collapsable={false} onLayout={measure} style={{ width: RACK_COLS * w, height: rackHeight(w) }}>
        {Array.from({ length: RACK_ROWS }, (_, r) => (
          <View key={r} style={[styles.shelf, { top: GAP + r * rowH + h - 3, width: RACK_COLS * w }]} />
        ))}
        {/* With a tile selected, every empty slot is a tap target: tap-tap moving, no dragging needed. */}
        {p.selectedId !== null &&
          p.slots.map((id, i) =>
            id === null ? (
              <Pressable
                key={`slot-${i}`}
                onPress={() => {
                  const sel = latest.current.selectedId;
                  if (sel === null) return;
                  latest.current.onSlotsChange(placeTile(latest.current.slots, sel, i));
                  latest.current.onSelect(null);
                }}
                style={[
                  styles.emptySlot,
                  { left: (i % RACK_COLS) * w, top: GAP + Math.floor(i / RACK_COLS) * rowH, width: w - 2, height: h - 2 },
                ]}
              />
            ) : null,
          )}
        <Animated.View pointerEvents="none" style={[styles.marker, { width: w - 2, height: h - 2 }, marker]} />
        {p.slots.map((id, i) => {
          const tile = id === null ? undefined : byId.get(id);
          if (!tile) return null;
          const hnd = handlersFor(tile.id);
          return (
            <DragSource
              key={tile.id}
              style={{ position: 'absolute', left: (i % RACK_COLS) * w, top: GAP + Math.floor(i / RACK_COLS) * rowH }}
              rackGeom={rackGeom}
              hoverSlot={hoverSlot}
              onTap={hnd.tap}
              onDragStart={onDragStart}
              onDrop={hnd.drop}
            >
              <TileView tile={tile} okey={p.okey} width={w} selected={p.selectedId === tile.id} fresh={p.freshId === tile.id} addable={p.addableIds.has(tile.id)} />
            </DragSource>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  band: {
    backgroundColor: colors.wood,
    borderTopWidth: 2,
    borderTopColor: colors.woodDark,
    alignItems: 'center',
    overflow: 'visible',
  },
  shelf: {
    position: 'absolute',
    left: 0,
    height: 5,
    backgroundColor: colors.woodDark,
    borderRadius: 3,
  },
  emptySlot: {
    position: 'absolute',
    margin: 1,
    borderRadius: 6,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(242,182,50,0.7)',
    backgroundColor: 'rgba(242,182,50,0.08)',
  },
  marker: {
    position: 'absolute',
    margin: 1,
    borderRadius: 6,
    borderWidth: 4,
    borderColor: colors.accent,
    backgroundColor: 'rgba(242,182,50,0.25)',
  },
});
