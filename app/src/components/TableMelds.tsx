import { useEffect, useRef } from 'react';
import { type HostInstance, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { OkeyInfo, PublicPlayer, TableMeld, Tile } from '@okey/shared';
import { useDropZones } from '../game/dropZones';
import { colors } from '../theme';
import { TileView } from './TileView';

interface Props {
  table: TableMeld[];
  players: PublicPlayer[];
  okey: OkeyInfo;
}

/** Melds laid on the table. Each one is a drop target for adding a tile (işleme). */
export function TableMelds({ table, players, okey }: Props) {
  if (table.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Henüz açan yok — açmak için 101 sayı gerekir</Text>
      </View>
    );
  }
  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      {table.map((m) => (
        <MeldView key={m.id} meld={m} ownerName={players[m.owner]?.name ?? ''} okey={okey} />
      ))}
    </ScrollView>
  );
}

function MeldView({ meld, ownerName, okey }: { meld: TableMeld; ownerName: string; okey: OkeyInfo }) {
  const zones = useDropZones();
  const ref = useRef<HostInstance>(null);
  useEffect(() => zones.register(`meld:${meld.id}`, ref), [zones, meld.id]);
  const byId = new Map<number, Tile>(meld.tiles.map((t) => [t.id, t]));
  return (
    <View ref={ref} style={styles.meld} collapsable={false}>
      <View style={{ flexDirection: 'row' }}>
        {meld.ordered.map((id) => (
          <TileView key={id} tile={byId.get(id)!} okey={okey} width={24} />
        ))}
      </View>
      <Text style={styles.owner} numberOfLines={1}>
        {ownerName} · {meld.points}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, padding: 4 },
  meld: { backgroundColor: 'rgba(0,0,0,0.18)', borderRadius: 6, padding: 3, alignItems: 'center' },
  owner: { color: colors.muted, fontSize: 9 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: colors.muted, fontSize: 12 },
});
