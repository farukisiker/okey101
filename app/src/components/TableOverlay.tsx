import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { OkeyInfo, PublicPlayer, TableMeld, Tile } from '@okey/shared';
import { colors, font } from '../theme';
import { Button } from './Button';
import { MeldView, fitTileWidth, ownerLabel, sortMelds } from './TableMelds';
import { TileView } from './TileView';

interface Props {
  table: TableMeld[];
  players: PublicPlayer[];
  mySeat: number;
  okey: OkeyInfo;
  /** Tile chosen on the rack, if any: shown at the top so the player knows what will be added. */
  selected: Tile | null;
  highlight: Set<number>;
  onMeldPress(meldId: number): void;
  onClose(): void;
}

/** The whole table, large: every player's melds grouped under their name. */
export function TableOverlay({ table, players, mySeat, okey, selected, highlight, onMeldPress, onClose }: Props) {
  const [area, setArea] = useState({ w: 0, h: 0 });
  const melds = useMemo(() => sortMelds(table, mySeat), [table, mySeat]);
  const owners = useMemo(() => [...new Set(melds.map((m) => m.owner))], [melds]);
  // One size for all groups: fit everything (plus a title line per player) if possible, readable at least.
  const w = useMemo(
    () => fitTileWidth(melds.map((m) => m.tiles.length), area.w - 24, area.h - owners.length * 34 - 16, 64, 30),
    [melds, owners.length, area],
  );

  return (
    <View style={styles.overlay}>
      <View style={styles.header}>
        <Text style={styles.title}>Masadaki perler</Text>
        {selected ? (
          <View style={styles.selected}>
            <Text style={styles.hint}>Seçili taş:</Text>
            <TileView tile={selected} okey={okey} width={30} />
            <Text style={styles.hint}>{highlight.size ? 'yeşil pere dokun, eklensin' : 'bu taş hiçbir pere uymuyor'}</Text>
          </View>
        ) : null}
        <Button title="Kapat" onPress={onClose} style={{ minWidth: 120 }} />
      </View>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.body}
        onLayout={(e) => setArea({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      >
        {owners.map((owner) => (
          <View key={owner} style={styles.group}>
            <Text style={styles.owner}>{owner === mySeat ? 'Senin perlerin' : `${players[owner]?.name ?? ''} perleri`}</Text>
            <View style={styles.row}>
              {melds
                .filter((m) => m.owner === owner)
                .map((m) => (
                  <MeldView
                    key={m.id}
                    meld={m}
                    owner={ownerLabel(m, players, mySeat)}
                    okey={okey}
                    tileWidth={w}
                    lit={highlight.has(m.id)}
                    onPress={() => onMeldPress(m.id)}
                    dropTarget={false}
                  />
                ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFill, backgroundColor: colors.felt, zIndex: 800, padding: 8 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 4 },
  title: { color: colors.accent, fontSize: font.status, fontWeight: '900' },
  selected: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  hint: { color: colors.text, fontSize: font.body, fontWeight: '600', flexShrink: 1 },
  body: { padding: 4, gap: 8 },
  group: { gap: 2 },
  owner: { color: colors.text, fontSize: font.body, fontWeight: '800', height: 26 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
});
