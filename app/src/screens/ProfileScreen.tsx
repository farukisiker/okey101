import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from '../components/Button';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { t } from '../i18n';
import { accounts } from '../net/accounts';
import { AccountsError, type Me, validName } from '../net/accountsClient';
import { errorKey, isWaiting, photoStatusKey, reasonKeys } from '../net/photoStatus';
import { pickProfilePhoto } from '../net/photoPicker';
import { colors, font } from '../theme';

const POLL_MS = 5000;
const AVATAR = 132;
const AVATAR_COLORS = ['#c0562b', '#2b7fc0', '#7a4fb5', '#2b9a6a', '#b58a1f', '#b5457a'];

function avatarColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

type Source = 'gallery' | 'camera';

/** Own profile: name, round photo with its review status, and the photo / account actions. */
export function ProfileScreen({ onBack }: { onBack(): void }) {
  const [me, setMe] = useState<Me | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [consentFor, setConsentFor] = useState<Source | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const apply = useCallback((m: Me, keepName = false) => {
    if (!alive.current) return;
    setMe(m);
    if (!keepName) setName(m.displayName ?? '');
  }, []);

  const fail = useCallback((e: unknown) => {
    if (!alive.current) return;
    setError(t(errorKey(e instanceof AccountsError ? e.code : 'network')));
  }, []);

  // Load once on open.
  useEffect(() => {
    accounts
      .getMe()
      .then((m) => apply(m))
      .catch(fail)
      .finally(() => alive.current && setBusy(false));
  }, [apply, fail]);

  // While a photo waits for a decision, ask again every few seconds (only while this screen is open).
  const waiting = me ? isWaiting(me.photo.status) : false;
  useEffect(() => {
    if (!waiting) return;
    const id = setInterval(() => {
      accounts.getMe().then((m) => apply(m, true), () => {});
    }, POLL_MS);
    return () => clearInterval(id);
  }, [waiting, apply]);

  const run = async (job: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await job();
    } catch (e) {
      fail(e);
    } finally {
      if (alive.current) setBusy(false);
    }
  };

  const saveName = () => run(async () => apply(await accounts.setName(name)));

  const pick = (source: Source) =>
    run(async () => {
      const r = await pickProfilePhoto(source);
      if ('cancelled' in r) return;
      if ('permission' in r) {
        setError(t(errorKey('permission')));
        return;
      }
      apply(await accounts.uploadPhoto(r.uri), true);
    });

  /** First upload needs the player's consent; ask before opening the picker. */
  const start = (source: Source) => {
    if (me && !me.photoConsent) setConsentFor(source);
    else void pick(source);
  };

  const accept = () => {
    const source = consentFor;
    setConsentFor(null);
    if (!source) return;
    void run(async () => {
      apply(await accounts.giveConsent(), true);
      const r = await pickProfilePhoto(source);
      if ('cancelled' in r) return;
      if ('permission' in r) {
        setError(t(errorKey('permission')));
        return;
      }
      apply(await accounts.uploadPhoto(r.uri), true);
    });
  };

  const removePhoto = () => run(async () => apply(await accounts.deletePhoto(), true));

  const deleteAccount = () => {
    setConfirmDelete(false);
    void run(async () => {
      await accounts.deleteAccount();
      onBack();
    });
  };

  const photo = accounts.photoUrl(me);
  const status = me?.photo.status ?? 'none';
  const reasons = me && status === 'rejected' ? reasonKeys(me.photo.reasons) : [];
  const initial = ([...(me?.displayName ?? name).trim()][0] ?? '?').toUpperCase();
  const dirty = !!me && name.trim() !== (me.displayName ?? '');
  const nameBad = name.trim().length > 0 && !validName(name);
  const hasPhoto = status !== 'none';

  return (
    <View style={styles.fill}>
      <ScrollView contentContainerStyle={styles.root} keyboardShouldPersistTaps="handled">
        <Text style={styles.title} accessibilityRole="header">
          {t('profTitle')}
        </Text>

        <View style={styles.top}>
          <View style={styles.photoCol}>
            <View
              style={[styles.avatar, !photo && { backgroundColor: avatarColor(me?.accountId ?? '') }]}
              accessible
              accessibilityRole="image"
              accessibilityLabel={t('profPhotoA11y')}
            >
              {photo ? <Image source={{ uri: photo }} style={styles.avatarImg} /> : <Text style={styles.initial}>{initial}</Text>}
            </View>
            <Text style={[styles.status, status === 'approved' && { color: colors.ok }, status === 'rejected' && { color: colors.danger }]}>
              {`${status === 'approved' ? '✔ ' : status === 'rejected' ? '✖ ' : isWaiting(status) ? '◷ ' : ''}${t(photoStatusKey(status))}`}
            </Text>
            {reasons.map((k) => (
              <Text key={k} style={styles.reason}>
                {t('profPhotoRejectedWhy', { reason: t(k) })}
              </Text>
            ))}
          </View>

          <View style={styles.formCol}>
            <Text style={styles.label}>{t('profName')}</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              maxLength={16}
              autoCorrect={false}
              placeholder={t('namePlaceholder')}
              placeholderTextColor={colors.muted}
              accessibilityLabel={t('profName')}
              editable={!busy}
            />
            {nameBad && <Text style={styles.reason}>{t('profNameBad')}</Text>}
            <Button title={t('profNameSave')} onPress={saveName} disabled={busy || !dirty || nameBad || name.trim().length === 0} />
          </View>
        </View>

        {error && (
          <Text style={styles.error} accessibilityLiveRegion="polite">
            {error}
          </Text>
        )}

        <View style={styles.actions}>
          <Button title={t('profGallery')} size="large" onPress={() => start('gallery')} disabled={busy || !me} />
          <Button title={t('profCamera')} size="large" onPress={() => start('camera')} disabled={busy || !me} />
        </View>
        {me && <Text style={styles.hint}>{t('profUploadsLeft', { n: me.uploadsLeftToday })}</Text>}
        {busy && <ActivityIndicator color={colors.accent} size="large" accessibilityLabel={t('profBusy')} />}

        <View style={styles.actions}>
          {hasPhoto && <Button title={t('profRemove')} variant="secondary" onPress={removePhoto} disabled={busy} />}
          <Button title={t('profDelete')} variant="secondary" onPress={() => setConfirmDelete(true)} disabled={busy || !me} />
          <Button title={t('backToSalon')} variant="secondary" onPress={onBack} />
        </View>
      </ScrollView>

      {consentFor && (
        <View style={styles.overlay}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('profConsentTitle')}</Text>
            <ScrollView style={styles.cardScroll}>
              <Text style={styles.cardBody}>{t('profConsentBody')}</Text>
            </ScrollView>
            <View style={styles.row}>
              <Button title={t('profConsentYes')} onPress={accept} style={{ minWidth: 180 }} />
              <Button title={t('profCancel')} variant="secondary" onPress={() => setConsentFor(null)} style={{ minWidth: 160 }} />
            </View>
          </View>
        </View>
      )}
      {confirmDelete && (
        <ConfirmDialog
          message={t('profDeleteAsk')}
          confirm={t('profDeleteYes')}
          cancel={t('profCancel')}
          onConfirm={deleteAccount}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  root: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 16, gap: 14 },
  title: { color: colors.accent, fontSize: font.title + 4, fontWeight: '900' },
  top: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'flex-start', gap: 28, width: '100%', maxWidth: 760 },
  photoCol: { alignItems: 'center', gap: 6, width: 260 },
  avatar: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.accent,
  },
  avatarImg: { width: AVATAR, height: AVATAR },
  initial: { color: '#fff', fontSize: 64, fontWeight: '900' },
  status: { color: colors.text, fontSize: font.body, fontWeight: '700', textAlign: 'center' },
  reason: { color: colors.text, fontSize: font.small, textAlign: 'center' },
  formCol: { width: 300, gap: 8 },
  label: { color: colors.muted, fontSize: font.small, fontWeight: '700' },
  input: {
    minHeight: 56,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.muted,
    backgroundColor: colors.panel,
    color: colors.text,
    fontSize: font.body + 2,
    paddingHorizontal: 14,
  },
  error: { color: colors.danger, fontSize: font.body, fontWeight: '700', textAlign: 'center', maxWidth: 560 },
  hint: { color: colors.muted, fontSize: font.small, textAlign: 'center' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 14 },
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: 16,
  },
  card: { backgroundColor: colors.feltLight, borderRadius: 16, padding: 24, gap: 16, alignItems: 'center', maxWidth: 560, maxHeight: '100%' },
  cardTitle: { color: colors.accent, fontSize: font.status, fontWeight: '900', textAlign: 'center' },
  cardScroll: { flexGrow: 0 },
  cardBody: { color: colors.text, fontSize: font.body, textAlign: 'center' },
  row: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 16 },
});
