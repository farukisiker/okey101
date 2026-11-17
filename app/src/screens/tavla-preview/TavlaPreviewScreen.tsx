import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { TavlaAction, TavlaView } from '@kahve/tavla';
import { colors, font } from '../../theme';
import {
  fakeBearOff,
  fakeCommit,
  fakeDouble,
  fakeFinished,
  fakeMidGame,
  fakeMustPass,
  fakeOnBar,
  fakeOpening,
  fakeOpponentPlay,
  fakeReduce,
} from '../../components/tavla';
import { TavlaScreen } from '../TavlaScreen';

interface Scenario {
  id: string;
  label: string;
  make(): TavlaView;
}

const SCENARIOS: Scenario[] = [
  { id: 'open0', label: 'Açılış (Beyaz)', make: () => fakeOpening(0) },
  { id: 'open1', label: 'Açılış (Siyah, koltuk 1)', make: () => fakeOpening(1) },
  { id: 'mid', label: 'Orta oyun + bar', make: () => fakeMidGame(0) },
  { id: 'bar', label: 'Barda pul', make: fakeOnBar },
  { id: 'pass', label: 'Pas', make: fakeMustPass },
  { id: 'double', label: 'Çift zar', make: fakeDouble },
  { id: 'off', label: 'Toplama', make: () => fakeBearOff() },
  { id: 'done', label: 'Mars (bitti)', make: fakeFinished },
];

/**
 * Developer preview of the Tavla screen on fake views: tap, undo and commit work against a tiny stand-in
 * (components/tavla/fakeView.ts); after Tamam the opponent plays a random turn so the animation can be seen.
 * The real engine replaces all of it.
 */
export function TavlaPreviewScreen() {
  const [scenario, setScenario] = useState(SCENARIOS[0]);
  const [view, setView] = useState<TavlaView>(() => scenario.make());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const choose = (s: Scenario) => {
    if (timer.current) clearTimeout(timer.current);
    setScenario(s);
    setView(s.make());
  };

  const onAction = (a: TavlaAction) => {
    if (a.type === 'commit') {
      const handed = fakeCommit(view);
      setView(handed);
      timer.current = setTimeout(() => setView((v) => fakeOpponentPlay(v)), 900);
      return;
    }
    setView((v) => fakeReduce(v, a));
  };

  return (
    <View style={styles.root}>
      <ScrollView horizontal style={styles.tabs} contentContainerStyle={styles.tabsContent}>
        {SCENARIOS.map((s) => (
          <Pressable key={s.id} onPress={() => choose(s)} style={[styles.tab, s.id === scenario.id && styles.tabOn]}>
            <Text style={styles.tabText}>{s.label}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <View style={styles.screen}>
        <TavlaScreen view={view} seat={view.seat} onAction={onAction} onNextRound={() => choose(scenario)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.felt },
  tabs: { flexGrow: 0, backgroundColor: colors.panel },
  tabsContent: { gap: 8, padding: 6 },
  tab: { minHeight: 44, paddingHorizontal: 14, borderRadius: 10, justifyContent: 'center', backgroundColor: colors.feltLight },
  tabOn: { backgroundColor: colors.accent },
  tabText: { color: colors.text, fontSize: font.small, fontWeight: '800' },
  screen: { flex: 1 },
});
