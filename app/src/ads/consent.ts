import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';

let allowed = false;
let required = false;
let initialized = false;
let sdkInitialization: Promise<void> | undefined;
let initializing: Promise<void> | undefined;
let revision = 0;
export const consentRevision = () => revision;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

export const canRequestAds = () => initialized && allowed;
export const privacyOptionsRequired = () => required;
export function usePrivacyOptionsRequired() {
  return useSyncExternalStore((listener) => {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, privacyOptionsRequired, () => false);
}

async function refreshConsent() {
  try {
    const { AdsConsent } = await import('react-native-google-mobile-ads');
    const info = await AdsConsent.getConsentInfo();
    allowed = info.canRequestAds;
    required = info.privacyOptionsRequirementStatus === 'REQUIRED';
  } catch {
    allowed = false;
  }
  revision++;
  notify();
}

async function initializeSdk() {
  if (!allowed || initialized) return;
  if (sdkInitialization) return sdkInitialization;
  sdkInitialization = (async () => {
    try {
      const { default: mobileAds } = await import('react-native-google-mobile-ads');
      await mobileAds().initialize();
      initialized = true;
    } catch { /* Native SDK unavailable. */ }
  })().finally(() => { sdkInitialization = undefined; });
  return sdkInitialization;
}

export function initAds(): Promise<void> {
  return initializing ??= (async () => {
    if (Platform.OS !== 'ios' && Platform.OS !== 'android') return;
    if (Platform.OS === 'ios') {
      try {
        const { requestTrackingPermissionsAsync } = await import('expo-tracking-transparency');
        await requestTrackingPermissionsAsync();
      } catch { /* ATT unavailable: continue without tracking permission. */ }
    }
    try {
      const { AdsConsent } = await import('react-native-google-mobile-ads');
      await AdsConsent.requestInfoUpdate();
    } catch { /* UMP can still use a previous session's consent. */ }
    try {
      const { AdsConsent } = await import('react-native-google-mobile-ads');
      await AdsConsent.loadAndShowConsentFormIfRequired();
    } catch { /* Consent failures must not block play. */ }
    await refreshConsent();
    await initializeSdk();
  })();
}

export async function showPrivacyOptions(): Promise<boolean> {
  if (!required) return false;
  allowed = false;
  revision++;
  try {
    const { AdsConsent } = await import('react-native-google-mobile-ads');
    await AdsConsent.showPrivacyOptionsForm();
    await refreshConsent();
    await initializeSdk();
    return true;
  } catch {
    await refreshConsent();
    return false;
  }
}
