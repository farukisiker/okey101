import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { type OkeyInfo, type Tile, isJoker } from '@okey/shared';
import { colorMarks, colors, tileColors } from '../theme';

interface Props {
  tile: Tile;
  okey?: OkeyInfo;
  width: number;
  selected?: boolean;
  dim?: boolean;
  /** Briefly glows, e.g. the tile just drawn. */
  fresh?: boolean;
  style?: ViewStyle;
}

export const tileHeight = (width: number) => Math.round(width * 1.38);

export function TileView({ tile, okey, width, selected, dim, fresh, style }: Props) {
  const height = tileHeight(width);
  const joker = okey ? isJoker(tile, okey) : false;
  return (
    <View
      style={[
        styles.tile,
        { width: width - 2, height: height - 2, borderRadius: width * 0.12 },
        fresh && styles.fresh,
        selected && styles.selected,
        dim && { opacity: 0.45 },
        style,
      ]}
    >
      {tile.kind === 'fake' ? (
        <Text style={[styles.fake, { fontSize: width * 0.52 }]}>✿</Text>
      ) : (
        <>
          <Text style={[styles.value, { color: tileColors[tile.color], fontSize: width * 0.5 }]}>{tile.value}</Text>
          <Text style={[styles.mark, { color: tileColors[tile.color], fontSize: Math.max(8, width * 0.22) }]}>
            {colorMarks[tile.color]}
          </Text>
        </>
      )}
      {joker && (
        <View style={styles.jokerBadge}>
          <Text style={styles.jokerText}>OK</Text>
        </View>
      )}
    </View>
  );
}

export function TileBack({ width }: { width: number }) {
  return (
    <View style={[styles.tile, styles.back, { width: width - 2, height: tileHeight(width) - 2, borderRadius: width * 0.12 }]} />
  );
}

const styles = StyleSheet.create({
  tile: {
    margin: 1,
    backgroundColor: colors.tile,
    borderColor: colors.tileBorder,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  selected: {
    borderColor: colors.accent,
    borderWidth: 4,
    shadowColor: colors.accent,
    shadowOpacity: 0.9,
    shadowRadius: 8,
    transform: [{ translateY: -12 }, { scale: 1.08 }],
  },
  fresh: { borderColor: colors.ok, borderWidth: 4 },
  back: { backgroundColor: '#e8dcc0' },
  value: { fontWeight: '800', marginTop: -4 },
  mark: { marginTop: -4 },
  fake: { color: '#2e7d32', fontWeight: '900' },
  jokerBadge: {
    position: 'absolute',
    top: 1,
    right: 1,
    backgroundColor: colors.accent,
    borderRadius: 4,
    paddingHorizontal: 2,
  },
  jokerText: { fontSize: 10, fontWeight: '900', color: '#3b2a00' },
});
