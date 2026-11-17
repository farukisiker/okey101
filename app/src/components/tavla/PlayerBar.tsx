import { StyleSheet, Text, View } from 'react-native';
import type { TavlaView } from '@kahve/tavla';
import { colors, font } from '../../theme';
import { Checker } from './Checker';
import { t } from '../../i18n';

export interface PlayerBarProps {
  view: Pick<TavlaView, 'players' | 'board' | 'turn' | 'options'>;
  /** Viewer's seat first, then the other (for a spectator seat 0 first). */
  mySeat: number;
  /** Match totals per seat; missing: no score shown. */
  totals?: readonly number[] | null;
  compact: boolean;
}

/**
 * The two players in the GameShell header: checker colour, name, pip count, bear-off count and match score.
 * The player to move gets the gold frame. Compact: one 36 dp line each.
 */
export function PlayerBar({ view, mySeat, totals, compact }: PlayerBarProps) {
  const order = [...view.players].sort((a, b) => (a.seat === Math.max(0, mySeat) ? -1 : b.seat === Math.max(0, mySeat) ? 1 : a.seat - b.seat));
  return (
    <View style={styles.row}>
      {order.map((p) => {
        const active = view.turn === p.seat;
        const off = view.board.off[p.seat] ?? 0;
        const score = totals ? t('tavlaScore', { n: totals[p.seat] ?? 0, target: view.options.targetScore }) : null;
        const pips = t('tavlaPips', { n: p.pips });
        return (
          <View key={p.seat} style={[styles.panel, compact && styles.panelCompact, active && styles.active]} accessibilityLabel={`${p.name}. ${pips}. ${score ?? ''}`}>
            <Checker seat={p.seat} size={compact ? 22 : 30} />
            <View style={styles.texts}>
              <Text style={styles.name} numberOfLines={1}>{p.seat === mySeat ? `${p.name} ★` : p.name}</Text>
              {compact ? null : (
                <Text style={styles.sub} numberOfLines={1}>{[pips, off ? t('tavlaOffCount', { n: off }) : null, score].filter(Boolean).join(' · ')}</Text>
              )}
            </View>
            {compact ? (
              <Text style={styles.sub} numberOfLines={1}>{[pips, score].filter(Boolean).join(' · ')}</Text>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center' },
  panel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.panel,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    paddingHorizontal: 10,
    paddingVertical: 4,
    minHeight: 50,
    maxWidth: 420,
  },
  panelCompact: { minHeight: 34, paddingVertical: 2, paddingHorizontal: 8 },
  active: { backgroundColor: colors.activePanel, borderColor: colors.accent },
  texts: { flexShrink: 1 },
  name: { color: colors.text, fontSize: font.body, fontWeight: '900' },
  sub: { color: colors.muted, fontSize: font.small, fontWeight: '700' },
});
