import { useEffect, useRef, useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { showPrivacyOptions, usePrivacyOptionsRequired } from '../ads/consent';
import { adGate } from '../ads/interstitial';
import { PRIVACY_URL, PRIVACY_URL_EN } from '../config/monetization';
import { buyRemoveAds, getRemoveAdsPackage, purchasesConfigured, restorePurchases, useAdFree } from '../purchases';
import { colors } from '../theme';
import { lang, t } from '../i18n';

export function MonetizationSettings() {
  const adFree = useAdFree();
  const privacyRequired = usePrivacyOptionsRequired();
  const [price, setPrice] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  useEffect(() => {
    if (!purchasesConfigured() || adFree) return;
    let mounted = true;
    void getRemoveAdsPackage().then((pkg) => {
      if (mounted && pkg) setPrice(pkg.product.priceString);
    });
    return () => { mounted = false; };
  }, [adFree]);

  const run = async (action: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try { await action(); }
    catch { Alert.alert(t('failTitle'), t('tryAgain')); }
    finally { lock.current = false; setBusy(false); }
  };
  const buy = async () => {
    const result = await buyRemoveAds();
    if (result === 'ok') Alert.alert(t('thanks'), t('noMoreAds'));
    else if (result === 'error') Alert.alert(t('purchaseFailed'), t('tryAgain'));
  };
  const restore = async () => {
    const result = await restorePurchases();
    Alert.alert(t('restore'), result === 'ok'
      ? t('restored')
      : result === 'empty' ? t('nothingToRestore') : t('restoreFailed'));
  };
  const item = (title: string, action: () => Promise<void>, accent = false) => (
    <Pressable accessibilityRole="button" disabled={busy} onPress={() => void run(action)} style={styles.button}>
      <Text style={[styles.text, accent && styles.accent, busy && styles.disabled]}>{title}</Text>
    </Pressable>
  );
  return (
    <View style={styles.row}>
      {purchasesConfigured() && !adFree && item(price ? t('removeAds', { price }) : t('removeAds', { price: '' }).replace(/\s*–\s*$/, ''), buy, true)}
      {purchasesConfigured() && item(t('restore'), restore)}
      {privacyRequired && item(t('privacyChoices'), async () => {
        if (!await showPrivacyOptions()) Alert.alert(t('privacyChoices'), t('privacyChoicesFailed'));
        void adGate.preload();
      })}
      {item(t('privacyPolicy'), async () => { await Linking.openURL(lang === 'tr' ? PRIVACY_URL : PRIVACY_URL_EN); })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', columnGap: 16, rowGap: 2 },
  button: { paddingVertical: 8, paddingHorizontal: 4, minHeight: 40, justifyContent: 'center' },
  text: { color: colors.muted, fontSize: 14, textAlign: 'center' },
  accent: { color: colors.accent, fontWeight: '700' },
  disabled: { opacity: 0.5 },
});
