import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import type { InterstitialAd } from 'react-native-google-mobile-ads';
import { ADMOB_INTERSTITIAL_ANDROID, ADMOB_INTERSTITIAL_IOS } from '../config/monetization';
import { isAdFree } from '../purchases';
import { canRequestAds, consentRevision } from './consent';
import { type AdHistory, eligibleForAd, recentShows } from './policy';

let history: AdHistory = { totalHands: 0, handsSinceAd: 0, lastAdAtMs: 0, shownAtMs: [] };
let hydrated = false;
let storageHealthy = true;
let pendingHands = 0;
let hydration: Promise<void> | undefined;
let writes = Promise.resolve();
let ad: InterstitialAd | undefined;
let loaded = false;
let loading = false;
let showing = false;
let revision = -1;
let clearAd = () => {};

function persist() {
  const entries: [string, string][] = [
    ['ads.totalHands', String(history.totalHands)],
    ['ads.handsSinceAd', String(history.handsSinceAd)],
    ['ads.lastAdAtMs', String(history.lastAdAtMs)],
    ['ads.shownAtMs', JSON.stringify(history.shownAtMs)],
  ];
  writes = writes.then(() => AsyncStorage.multiSet(entries)).catch(() => { storageHealthy = false; });
}

function hydrate(): Promise<void> {
  return hydration ??= (async () => {
    try {
      const values = Object.fromEntries(await AsyncStorage.multiGet([
        'ads.totalHands', 'ads.handsSinceAd', 'ads.lastAdAtMs', 'ads.shownAtMs',
      ]));
      const count = (key: string) => {
        const n = Number(values[key] ?? 0);
        if (!Number.isFinite(n) || n < 0) throw new Error('Invalid ad history');
        return Math.floor(n);
      };
      const shown: unknown = JSON.parse(values['ads.shownAtMs'] ?? '[]');
      if (!Array.isArray(shown) || !shown.every((at) => typeof at === 'number' && Number.isFinite(at))) {
        throw new Error('Invalid ad history');
      }
      history = {
        totalHands: count('ads.totalHands') + pendingHands,
        handsSinceAd: count('ads.handsSinceAd') + pendingHands,
        lastAdAtMs: count('ads.lastAdAtMs'),
        shownAtMs: recentShows(shown, Date.now()),
      };
      hydrated = true;
      pendingHands = 0;
      persist();
    } catch { storageHealthy = false; }
  })();
}

async function preload(): Promise<void> {
  void hydrate();
  if (showing || loading || !canRequestAds() || isAdFree()) return;
  if (ad && revision !== consentRevision()) clearAd();
  if (loaded) return;
  loading = true;
  try {
    const { InterstitialAd, TestIds, AdEventType } = await import('react-native-google-mobile-ads');
    if (!canRequestAds() || isAdFree()) { loading = false; return; }
    const unit = Platform.OS === 'ios' ? ADMOB_INTERSTITIAL_IOS : ADMOB_INTERSTITIAL_ANDROID;
    const candidate = InterstitialAd.createForAdRequest(__DEV__ || !unit ? TestIds.INTERSTITIAL : unit);
    ad = candidate;
    revision = consentRevision();
    let opened = false;
    let resolveShow: (() => void) | undefined;
    let showTimer: ReturnType<typeof setTimeout> | undefined;
    const loadTimer = setTimeout(() => { if (!showing) dispose(); }, 60_000);
    const unsubscribers: (() => void)[] = [];
    const dispose = () => {
      if (ad !== candidate) return;
      clearTimeout(loadTimer);
      clearTimeout(showTimer);
      unsubscribers.forEach((unsubscribe) => unsubscribe());
      ad = undefined;
      loaded = loading = showing = false;
      resolveShow?.();
    };
    clearAd = dispose;
    unsubscribers.push(candidate.addAdEventListener(AdEventType.LOADED, () => {
      clearTimeout(loadTimer);
      loading = false;
      loaded = true;
    }));
    unsubscribers.push(candidate.addAdEventListener(AdEventType.OPENED, () => {
      if (opened) return;
      opened = true;
      const now = Date.now();
      history.lastAdAtMs = now;
      history.shownAtMs = [...recentShows(history.shownAtMs, now), now];
      history.handsSinceAd = 0;
      persist();
    }));
    unsubscribers.push(candidate.addAdEventListener(AdEventType.CLOSED, () => {
      dispose();
      void preload();
    }));
    unsubscribers.push(candidate.addAdEventListener(AdEventType.ERROR, dispose));
    present = () => new Promise<void>((resolve) => {
      resolveShow = resolve;
      // Release navigation even if a native callback is lost. Keep the show lock
      // until CLOSED/ERROR so a second ad can never overlap the first one.
      showTimer = setTimeout(resolve, 60_000);
      try { candidate.show().catch(dispose); } catch { dispose(); }
    });
    candidate.load();
  } catch {
    clearAd();
    loading = false;
  }
}

let present: () => Promise<void> = () => Promise.resolve();

export const adGate = {
  preload,
  onHandCompleted() {
    if (!hydrated) { pendingHands++; void hydrate(); return; }
    history.totalHands++;
    history.handsSinceAd++;
    persist();
  },
  isEligible(now: number) {
    return hydrated && storageHealthy && canRequestAds() && !isAdFree() && eligibleForAd(history, now);
  },
  showIfEligible(): Promise<void> {
    // Never wait for an ad to load. A missed opportunity stays missed.
    if (showing || !loaded || !ad || revision !== consentRevision() || !this.isEligible(Date.now())) {
      void preload();
      return Promise.resolve();
    }
    showing = true;
    loaded = false;
    return present();
  },
};
