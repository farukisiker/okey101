import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_MATCH_END, type MatchEnd } from './a7adapter';
import { colors } from '../theme';
import { t } from '../i18n';

const KEY = 'okey101.matchEnd';
const OPTIONS: MatchEnd[] = [
  { kind: 'none' },
  { kind: 'hands', n: 5 },
  { kind: 'hands', n: 7 },
  { kind: 'hands', n: 11 },
  { kind: 'points', limit: 501 },
  { kind: 'points', limit: 1001 },
];

const same = (a: MatchEnd, b: MatchEnd) => JSON.stringify(a) === JSON.stringify(b);

function label(m: MatchEnd): string {
  if (m.kind === 'none') return t('matchLenNone');
  if (m.kind === 'hands') return t('matchLenHands', { n: m.n });
  return t('matchLenPoints', { n: m.limit });
}

/** Last chosen 101 match length (AsyncStorage); default 5 hands. */
export function useMatchEnd(): [MatchEnd, (m: MatchEnd) => void] {
  const [value, setValue] = useState<MatchEnd>(DEFAULT_MATCH_END);
  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        if (!raw) return;
        const saved = JSON.parse(raw) as MatchEnd;
        const found = OPTIONS.find((o) => same(o, saved));
        if (found) setValue(found);
      })
      .catch(() => {});
  }, []);
  const set = (m: MatchEnd) => {
    setValue(m);
    AsyncStorage.setItem(KEY, JSON.stringify(m)).catch(() => {});
  };
  return [value, set];
}

/** Six small choices, secondary in look; wraps to a second row when the text is large. */
export function MatchEndPicker({ value, onChange }: { value: MatchEnd; onChange(m: MatchEnd): void }) {
  return (
    <View style={styles.root}>
      <Text style={styles.label}>{t('matchLen')}</Text>
      <View style={styles.row}>
        {OPTIONS.map((o) => {
          const on = same(o, value);
          return (
            <Pressable
              key={label(o)}
              onPress={() => onChange(o)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              style={[styles.chip, on && styles.chipOn]}
            >
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{label(o)}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', gap: 6 },
  label: { color: colors.muted, fontSize: 16, fontWeight: '600' },
  row: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  chip: {
    minHeight: 56,
    minWidth: 88,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { color: colors.text, fontSize: 16, fontWeight: '700' },
  chipTextOn: { color: '#1a1a1a' },
});
