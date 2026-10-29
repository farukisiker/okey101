import { useEffect, useRef } from 'react';
import { type HostInstance, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { OkeyInfo, PublicPlayer, TableMeld, Tile } from '@okey/shared';
import { useDropZones } from '../game/dropZones';
import { colors, font } from '../theme';
import { TileView } from './TileView';

interface Props {
  table: TableMeld[];
  players: PublicPlayer[];
  myName: string;
  okey: OkeyInfo;
  tileWidth: number;
  /** Center message when the table is empty (e.g. the last move). */
  emptyText: string;
}

/** Melds laid on the table. Each one is a drop target for adding a tile (işleme). */
export function TableMelds({ table, players, myName, okey, tileWidth, emptyText }: Props) {
  if (table.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>{emptyText}</Text>
      </View>
    );
  }
  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      {table.map((m) => {
        const owner = players[m.owner]?.name ?? '';
        return <MeldView key={m.id} meld={m} ownerName={owner === myName ? 'Sen' : owner} okey={okey} tileWidth={tileWidth} />;
      })}
    </ScrollView>
  );
}

function MeldView({ meld, ownerName, okey, tileWidth }: { meld: TableMeld; ownerName: string; okey: OkeyInfo; tileWidth: number }) {
  const zones = useDropZones();
  const ref = useRef<HostInstance>(null);
  useEffect(() => zones.register(`meld:${meld.id}`, ref), [zones, meld.id]);
  const byId = new Map<number, Tile>(meld.tiles.map((t) => [t.id, t]));
  return (
    <View ref={ref} style={styles.meld} collapsable={false}>
      <View style={{ flexDirection: 'row' }}>
        {meld.ordered.map((id) => (
          <TileView key={id} tile={byId.get(id)!} okey={okey} width={tileWidth} />
        ))}
      </View>
      <Text style={styles.owner} numberOfLines={1}>
        {ownerName} · {meld.points}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 6 },
  meld: { backgroundColor: 'rgba(0,0,0,0.18)', borderRadius: 8, padding: 4, alignItems: 'center' },
  owner: { color: colors.muted, fontSize: 14 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 8 },
  emptyText: { color: colors.text, fontSize: font.body, textAlign: 'center' },
});
