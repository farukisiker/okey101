import { useEffect } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { colors } from '../theme';
import { t } from '../i18n';

const SHOW_MS = 2800;

/** Opening title card; goes on by itself, or at a tap. */
export function Intro({ onDone }: { onDone(): void }) {
  useEffect(() => {
    const t = setTimeout(onDone, SHOW_MS);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <Pressable style={styles.root} onPress={onDone}>
      <Animated.Text entering={FadeIn.duration(700)} style={styles.name}>
        {t('introTagline')}
      </Animated.Text>
      <Animated.View entering={FadeInDown.delay(500).duration(800)} style={styles.badge}>
        <Text style={styles.vip}>DEMLİ</Text>
        <Text style={styles.okey}>OKEY</Text>
      </Animated.View>
      <Animated.Text entering={FadeIn.delay(1400).duration(600)} style={styles.tap}>
        {t('introTap')}
      </Animated.Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, backgroundColor: colors.felt },
  name: { color: colors.muted, fontSize: 24, fontWeight: '700', letterSpacing: 1 },
  badge: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 14,
    paddingHorizontal: 28,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 3,
    borderColor: colors.accent,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  vip: { color: colors.accent, fontSize: 56, fontWeight: '900', letterSpacing: 4 },
  okey: { color: colors.text, fontSize: 56, fontWeight: '900', letterSpacing: 4 },
  tap: { color: colors.muted, fontSize: 18 },
});
