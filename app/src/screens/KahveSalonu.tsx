import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { GameId, TableGroup } from '@kahve/core';
import { Button } from '../components/Button';
import type { Key } from '../i18n';
import { t } from '../i18n';
import { colors, font } from '../theme';
import { KAHVE_GAMES, gameTitleKey } from './kahveGames';

interface GroupCard {
  group: TableGroup;
  icon: string;
  title: Key;
  sub: Key;
  /** Tappable. Phase A: okey, cards and backgammon open; draughts is "soon" only. */
  tappable: boolean;
}

const CARDS: GroupCard[] = [
  { group: 'okey', icon: '🀄', title: 'groupOkey', sub: 'groupOkeySub', tappable: true },
  { group: 'kagit', icon: '🃏', title: 'groupKagit', sub: 'groupKagitSub', tappable: true },
  { group: 'tavla', icon: '🎲', title: 'groupTavla', sub: 'groupTavlaSub', tappable: true },
  { group: 'dama', icon: '⚫', title: 'groupDama', sub: 'groupDamaSub', tappable: false },
];

interface Props {
  last: GameId | null;
  onOpenGroup(group: TableGroup): void;
  onResume(): void;
  /** Own profile; the button shows only when the accounts feature is on. */
  onOpenProfile?(): void;
}

/** The coffeehouse: four big table groups, and a one-tap way back to the last game. */
export function KahveSalonu({ last, onOpenGroup, onResume, onOpenProfile }: Props) {
  const lastMeta = last ? KAHVE_GAMES.find((g) => g.id === last) : undefined;
  return (
    <ScrollView contentContainerStyle={styles.root}>
      <Text style={styles.title}>{t('salonTitle')}</Text>
      {onOpenProfile && <Button title={t('profTitle')} variant="secondary" onPress={onOpenProfile} />}
      {lastMeta && (
        <Pressable
          style={({ pressed }) => [styles.resume, pressed && styles.pressed]}
          onPress={onResume}
          accessibilityRole="button"
          accessibilityLabel={`${t('lastPlayed')}: ${t(gameTitleKey(lastMeta))}. ${t('resume')}`}
        >
          <Text style={styles.resumeLabel}>{t('lastPlayed')}</Text>
          <Text style={styles.resumeName}>{`${t(gameTitleKey(lastMeta))} · ${t('resume')}`}</Text>
          <Text style={styles.resumeArrow}>▶</Text>
        </Pressable>
      )}
      <View style={styles.grid}>
        {CARDS.map((c) => {
          // "Soon" until the catalog has at least one active game in the group.
          const soon = !KAHVE_GAMES.some((g) => g.group === c.group && g.status === 'active');
          return (
            <Pressable
              key={c.group}
              style={({ pressed }) => [styles.card, soon && styles.cardSoon, pressed && c.tappable && styles.pressed]}
              disabled={!c.tappable}
              onPress={() => onOpenGroup(c.group)}
              accessibilityRole="button"
              accessibilityState={{ disabled: !c.tappable }}
              accessibilityLabel={soon ? t('soonA11y', { name: t(c.title) }) : t(c.title)}
            >
              <Text style={styles.icon}>{c.icon}</Text>
              <Text style={styles.cardTitle}>{t(c.title)}</Text>
              <Text style={styles.cardSub}>{t(c.sub)}</Text>
              {soon && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{`◷ ${t('soon')}`}</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 16, gap: 14 },
  title: { color: colors.accent, fontSize: font.title + 8, fontWeight: '900' },
  resume: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    minHeight: 64,
    paddingHorizontal: 22,
    borderRadius: 16,
    backgroundColor: colors.accent,
  },
  resumeLabel: { color: '#2b1d00', fontSize: font.body, fontWeight: '600' },
  resumeName: { color: '#2b1d00', fontSize: font.status, fontWeight: '900' },
  resumeArrow: { color: '#2b1d00', fontSize: font.status },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 16, maxWidth: 760 },
  card: {
    width: 340,
    maxWidth: '100%',
    minHeight: 110,
    flexGrow: 1,
    padding: 14,
    borderRadius: 18,
    borderWidth: 3,
    borderColor: colors.accent,
    backgroundColor: colors.panel,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  cardSoon: { borderColor: colors.muted, borderStyle: 'dashed', opacity: 0.85 },
  pressed: { opacity: 0.8 },
  icon: { fontSize: 34 },
  cardTitle: { color: colors.text, fontSize: font.title, fontWeight: '900', textAlign: 'center' },
  cardSub: { color: colors.muted, fontSize: font.small, textAlign: 'center' },
  badge: {
    marginTop: 4,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: 1,
    borderColor: colors.muted,
  },
  badgeText: { color: colors.text, fontSize: font.small, fontWeight: '700' },
});
