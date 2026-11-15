import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { GameId, TableGroup } from '@kahve/core';
import { Button } from '../components/Button';
import { t } from '../i18n';
import { colors, font } from '../theme';
import { gameTitleKey, gamesOf } from './kahveGames';

/** Games inside one table group. In phase A the card and backgammon groups only list "soon" games. */
export function OyunSecimi({ group, onBack, onPick }: { group: TableGroup; onBack(): void; onPick?(gameId: GameId): void }) {
  return (
    <ScrollView contentContainerStyle={styles.root}>
      <Text style={styles.title}>{t('pickGame')}</Text>
      <View style={styles.list}>
        {gamesOf(group).map((g) => {
          const open = g.status === 'active' && !!onPick;
          return (
            <Pressable
              key={g.id}
              style={({ pressed }) => [styles.row, open && pressed && { opacity: 0.7 }]}
              disabled={!open}
              onPress={() => onPick?.(g.id)}
              accessibilityRole={open ? 'button' : undefined}
              accessibilityState={{ disabled: !open }}
              accessibilityLabel={g.status === 'soon' ? t('soonA11y', { name: t(gameTitleKey(g)) }) : t(gameTitleKey(g))}
            >
              <Text style={styles.name}>{t(gameTitleKey(g))}</Text>
              {g.status === 'soon' && <Text style={styles.badge}>{`◷ ${t('soon')}`}</Text>}
            </Pressable>
          );
        })}
      </View>
      <Button title={t('backToSalon')} variant="secondary" onPress={onBack} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 16, gap: 14 },
  title: { color: colors.text, fontSize: font.title, fontWeight: '700' },
  list: { gap: 10, width: '100%', maxWidth: 480 },
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    borderRadius: 14,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.muted,
    backgroundColor: colors.panel,
  },
  name: { color: colors.text, fontSize: font.status, fontWeight: '800' },
  badge: { color: colors.muted, fontSize: font.body, fontWeight: '700' },
});
