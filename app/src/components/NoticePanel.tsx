import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming } from 'react-native-reanimated';
import type { GameNotice, PlayerView } from '@okey/shared';
import { t, type Key } from '../i18n';

/** Same as game-core NOTICE_MS (user decision 15.11.2026). */
const NOTICE_MS = 5000;
const FADE_MS = 250;

interface Queued {
  notice: GameNotice;
  ms: number;
}

/**
 * Big penalty banner every player sees for 5 s each ("Ahmet işlek taş attı: +101 ceza").
 * One action can write several notices (view.notices, id order): they show one after another.
 * The highest id shown is remembered (reset every round, ids restart at 1), so a re-render or
 * reconnect never replays old ones. Never blocks touches.
 */
export function NoticePanel({ view, round }: { view: PlayerView; round: number }) {
  const [shown, setShown] = useState<GameNotice | null>(null);
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.9);
  const maxId = useRef(0);
  const lastRound = useRef(round);
  const first = useRef(true);
  const queue = useRef<Queued[]>([]);
  const busy = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const next = () => {
    const item = queue.current.shift();
    if (!item) {
      busy.current = false;
      setShown(null);
      return;
    }
    busy.current = true;
    setShown(item.notice);
    scale.value = 0.9;
    scale.value = withTiming(1, { duration: 200 });
    opacity.value = 0;
    opacity.value = withSequence(
      withTiming(1, { duration: 200 }),
      withDelay(Math.max(0, item.ms - FADE_MS - 200), withTiming(0, { duration: FADE_MS })),
    );
    timer.current = setTimeout(next, item.ms);
  };

  useEffect(() => {
    if (lastRound.current !== round) {
      lastRound.current = round;
      maxId.current = 0;
      queue.current = [];
    }
    const list = view.notices?.length ? view.notices : view.notice ? [view.notice] : [];
    const fresh = list.filter((n) => n.id > maxId.current);
    if (fresh.length === 0) return;
    maxId.current = Math.max(...fresh.map((n) => n.id));
    const isFirst = first.current;
    first.current = false;
    const live = view.noticeMsLeft ?? 0;
    // First view of this table with nothing live: those are old notices (reconnect), not news.
    if (isFirst && live <= 0) return;
    fresh.forEach((notice, i) => {
      // On a late join the host reports the total left; the first one gets what remains of it.
      const ms = isFirst ? Math.max(500, Math.min(NOTICE_MS, live - (fresh.length - 1 - i) * NOTICE_MS)) : NOTICE_MS;
      queue.current.push({ notice, ms });
    });
    if (!busy.current) next();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, round]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

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
