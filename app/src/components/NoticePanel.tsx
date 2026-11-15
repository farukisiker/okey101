import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming } from 'react-native-reanimated';
import type { PlayerView } from '@okey/shared';
import { noticeOf, type Notice } from './a7adapter';
import { t, type Key } from '../i18n';

/** Same as game-core NOTICE_MS (user decision 15.11.2026). */
const NOTICE_MS = 5000;
const FADE_MS = 250;

/**
 * Big penalty banner every player sees for 5 s ("Ahmet işlek taş attı: +101 ceza").
 * Never blocks touches. A notice that was already on screen when this table
 * mounted (reconnect) is not shown again unless the host says it is still live.
 */
export function NoticePanel({ view }: { view: PlayerView }) {
  const current = noticeOf(view);
  const seen = useRef<number | null>(null);
  const first = useRef(true);
  const [shown, setShown] = useState<Notice | null>(null);
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.9);

  const id = current?.notice.id ?? null;
  const live = current?.msLeft ?? null;
  useEffect(() => {
    const isFirst = first.current;
    first.current = false;
    if (!current || id === seen.current) return;
    seen.current = id;
    if (isFirst && (live === null || live <= 0)) return; // old notice, not live
    const total = live !== null && live > 0 ? Math.min(live, NOTICE_MS) : NOTICE_MS;
    setShown(current.notice);
    scale.value = withTiming(1, { duration: 200 });
    opacity.value = withSequence(
      withTiming(1, { duration: 200 }),
      withDelay(Math.max(0, total - FADE_MS - 200), withTiming(0, { duration: FADE_MS })),
    );
    const timer = setTimeout(() => setShown(null), total + 50);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ scale: scale.value }] }));
  if (!shown) return null;
  const name = view.players[shown.seat]?.name ?? '';
  const text = t(`notice.${shown.reason}` as Key, { name, amount: shown.amount });
  return (
    <View style={styles.wrap} pointerEvents="none">
      <Animated.View style={[styles.panel, style]} accessibilityLiveRegion="assertive" accessible accessibilityLabel={text}>
        <Text style={styles.icon}>⚠</Text>
        <Text style={styles.text} adjustsFontSizeToFit minimumFontScale={0.8} numberOfLines={3}>
          {text}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'flex-start', paddingTop: '22%', zIndex: 50 },
  panel: {
    width: '70%',
    maxWidth: 640,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#7a1f1f',
    borderColor: '#ffe27a',
    borderWidth: 3,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 18,
  },
  icon: { color: '#ffe27a', fontSize: 34, fontWeight: '900' },
  text: { flex: 1, color: '#ffffff', fontSize: 26, fontWeight: '800' },
});
