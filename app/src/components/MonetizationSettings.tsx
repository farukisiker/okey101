import { useEffect, useRef, useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { showPrivacyOptions, usePrivacyOptionsRequired } from '../ads/consent';
import { adGate } from '../ads/interstitial';
import { PRIVACY_URL } from '../config/monetization';
import { buyRemoveAds, getRemoveAdsPackage, purchasesConfigured, restorePurchases, useAdFree } from '../purchases';
import { colors } from '../theme';

export function MonetizationSettings() {
  const adFree = useAdFree();
  const privacyRequired = usePrivacyOptionsRequired();
  const [price, setPrice] = useState('₺149,99');
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
    catch { Alert.alert('İşlem tamamlanamadı', 'Lütfen tekrar deneyin.'); }
    finally { lock.current = false; setBusy(false); }
  };
  const buy = async () => {
    const result = await buyRemoveAds();
    if (result === 'ok') Alert.alert('Teşekkürler!', 'Artık geçiş reklamları gösterilmeyecek.');
    else if (result === 'error') Alert.alert('Satın alma tamamlanamadı', 'Lütfen tekrar deneyin.');
  };
  const restore = async () => {
    const result = await restorePurchases();
    Alert.alert('Satın Alımları Geri Yükle', result === 'ok'
      ? 'Reklamsız oyun geri yüklendi.'
      : result === 'empty' ? 'Geri yüklenecek satın alım bulunamadı.' : 'Geri yüklenemedi. Lütfen tekrar deneyin.');
  };
  const item = (title: string, action: () => Promise<void>, accent = false) => (
    <Pressable accessibilityRole="button" disabled={busy} onPress={() => void run(action)} style={styles.button}>
      <Text style={[styles.text, accent && styles.accent, busy && styles.disabled]}>{title}</Text>
    </Pressable>
  );
  return (
    <View style={styles.row}>
      {purchasesConfigured() && !adFree && item(`Reklamsız Oyna – ${price}`, buy, true)}
      {purchasesConfigured() && item('Satın Alımları Geri Yükle', restore)}
      {privacyRequired && item('Gizlilik Tercihleri', async () => {
        if (!await showPrivacyOptions()) Alert.alert('Gizlilik Tercihleri', 'Tercihler açılamadı. Lütfen tekrar deneyin.');
        void adGate.preload();
      })}
      {item('Gizlilik Politikası', async () => { await Linking.openURL(PRIVACY_URL); })}
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
