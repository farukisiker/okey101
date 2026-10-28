import { memo, useEffect } from 'react';
import { GestureDetector, useCompetingGestures, usePanGesture, useTapGesture } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import type { OkeyInfo, Tile } from '@okey/shared';
import { TileView } from './TileView';

interface Props {
  tile: Tile;
  okey: OkeyInfo;
  width: number;
  left: number;
  top: number;
  selected: boolean;
  dim?: boolean;
  onTap(tileId: number): void;
  onDragStart(): void;
  onDrop(tileId: number, x: number, y: number): void;
}

/** A rack tile that can be dragged anywhere on screen; the drop point is resolved on the JS side. */
export const DraggableTile = memo(function DraggableTile(p: Props) {
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const dragging = useSharedValue(false);
  const { tile, onTap, onDragStart, onDrop } = p;
  const id = tile.id;

  // Moved to a new slot: drop the leftover drag offset so it doesn't spring from the old place.
  useEffect(() => {
    tx.value = 0;
    ty.value = 0;
  }, [p.left, p.top, tx, ty]);

  const pan = usePanGesture({
    minDistance: 4,
    onActivate: () => {
      dragging.value = true;
      scheduleOnRN(onDragStart);
    },
    onUpdate: (e) => {
      tx.value = e.translationX;
      ty.value = e.translationY;
    },
    onDeactivate: (e) => {
      scheduleOnRN(onDrop, id, e.absoluteX, e.absoluteY);
    },
    onFinalize: () => {
      dragging.value = false;
      tx.value = withSpring(0, { duration: 180 });
      ty.value = withSpring(0, { duration: 180 });
    },
  });
  const tap = useTapGesture({
    onActivate: () => {
      scheduleOnRN(onTap, id);
    },
  });
  const gesture = useCompetingGestures(pan, tap);

  const style = useAnimatedStyle(() => ({
    zIndex: dragging.value ? 100 : 1,
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: dragging.value ? 1.12 : 1 }],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[{ position: 'absolute', left: p.left, top: p.top }, style]}>
        <TileView tile={tile} okey={p.okey} width={p.width} selected={p.selected} dim={p.dim} />
      </Animated.View>
    </GestureDetector>
  );
});
