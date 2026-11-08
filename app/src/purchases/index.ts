import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import type { CustomerInfo, PurchasesPackage } from 'react-native-purchases';
import { REVENUECAT_ANDROID_KEY, REVENUECAT_IOS_KEY } from '../config/monetization';

const apiKey = Platform.OS === 'ios' ? REVENUECAT_IOS_KEY : Platform.OS === 'android' ? REVENUECAT_ANDROID_KEY : '';
export const purchasesConfigured = () => apiKey.length > 0;
let adFree = false;
let ready = false;
let initializing: Promise<void> | undefined;
let syncing: Promise<void> | undefined;
const listeners = new Set<() => void>();
export const isAdFree = () => adFree;
function update(info?: CustomerInfo) {
  adFree = !!info?.entitlements.active.no_ads;
  listeners.forEach((listener) => listener());
}
export function useAdFree() {
  return useSyncExternalStore((listener) => {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, isAdFree, () => false);
}

export function initPurchases(): Promise<void> {
  return initializing ??= (async () => {
    if (!purchasesConfigured()) return;
    try {
      const { default: Purchases } = await import('react-native-purchases');
      Purchases.configure({ apiKey });
      ready = true;
      Purchases.addCustomerInfoUpdateListener(update);
      update(await Purchases.getCustomerInfo());
    } catch { update(); }
  })();
}

export async function getRemoveAdsPackage(): Promise<PurchasesPackage | null> {
  await initPurchases();
  if (!ready) return null;
  try {
    const { default: Purchases } = await import('react-native-purchases');
    const pkg = (await Purchases.getOfferings()).all.default?.lifetime;
    return pkg?.product.identifier === 'okey101_remove_ads' ? pkg : null;
  } catch {
    update();
    return null;
  }
}

export type PurchaseResult = 'ok' | 'cancelled' | 'error';
export async function buyRemoveAds(): Promise<PurchaseResult> {
  try {
    const pkg = await getRemoveAdsPackage();
    if (!pkg) return 'error';
    const { default: Purchases } = await import('react-native-purchases');
    update((await Purchases.purchasePackage(pkg)).customerInfo);
    return adFree ? 'ok' : 'error';
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'userCancelled' in error && error.userCancelled) return 'cancelled';
    update();
    return 'error';
  }
}

export async function restorePurchases(): Promise<'ok' | 'empty' | 'error'> {
  await initPurchases();
  if (!ready) return 'error';
  try {
    const { default: Purchases } = await import('react-native-purchases');
    update(await Purchases.restorePurchases());
    return adFree ? 'ok' : 'empty';
  } catch {
    update();
    return 'error';
  }
}

/** Called in the background; only a successful sync is remembered. */
export function syncOnce(): Promise<void> {
  if (syncing) return syncing;
  syncing = (async () => {
    if (!ready) return;
    try {
      if (await AsyncStorage.getItem('purchases.synced') === '1') return;
      const { default: Purchases } = await import('react-native-purchases');
      await Purchases.syncPurchases();
      await AsyncStorage.setItem('purchases.synced', '1');
      update(await Purchases.getCustomerInfo());
    } catch { update(); }
  })().finally(() => { syncing = undefined; });
  return syncing;
}
