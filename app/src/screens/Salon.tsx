import { useEffect, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { type GameMode, isTablePassword, type TableSummary } from '@okey/shared';
import { Button } from '../components/Button';
import type { OkeyClient } from '../net/useOkey';
import { colors, font } from '../theme';

interface Props {
  client: OkeyClient;
  name: string;
  serverUrl: string;
  onServerUrlChange(url: string): void;
  onBack(): void;
}

type Result = { ok: true } | { ok: false; error: string };

const modeName = (m: GameMode) => (m === 'duz' ? 'Düz Okey' : '101 Okey');

/** What the password box is for: locking a new table, or sitting at a locked one. */
type PinFor = { kind: 'create' } | { kind: 'join'; table: TableSummary };

/**
 * The salon: open tables on the left, one tap to sit down (a locked table asks
 * for its 6-digit password); opening a table, open or locked, on the right.
 */
export function Salon({ client, name, serverUrl, onServerUrlChange, onBack }: Props) {
  const [mode, setMode] = useState<GameMode>('101');
  const [pinFor, setPinFor] = useState<PinFor | null>(null);
  const [url, setUrl] = useState(serverUrl);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const offline = !client.connected;
  const { watchSalon } = client;

  useEffect(() => {
    if (offline) return;
    watchSalon(true);
    return () => watchSalon(false);
  }, [offline, watchSalon]);

  const run = async (fn: () => Promise<Result>) => {
    setBusy(true);
    setError(null);
    const res = await fn();
    setBusy(false);
    if (!res.ok) setError(res.error);
    return res;
  };

  const submitPin = async (pin: string) => {
    if (!pinFor) return { ok: false as const, error: '' };
    const res =
      pinFor.kind === 'create'
        ? await run(() => client.createRoom(name, mode, true, pin))
        : await run(() => client.joinRoom(name, pinFor.table.id, pin));
    if (res.ok) setPinFor(null);
    return res;
  };

  return (
    <View style={{ flex: 1 }}>
      {/* Back is always in the top-left corner, never scrolled out of sight. */}
      <View style={styles.header}>
        <Button title="‹ Geri" variant="secondary" onPress={onBack} style={{ minWidth: 120 }} />
        <Text style={styles.heading}>Salon</Text>
        <View style={{ width: 120 }} />
      </View>

      <View style={styles.body}>
        <ScrollView style={styles.list} contentContainerStyle={{ gap: 8, paddingBottom: 12 }}>
          {offline ? (
            <Text style={styles.warn}>
              Oyun sunucusuna bağlanılamadı. Bilgisayara karşı her zaman oynayabilirsin.
            </Text>
          ) : client.salon.length === 0 ? (
            <Text style={styles.empty}>Şu an boş yeri olan masa yok.{'\n'}Sağdan bir masa aç, gelenler oturur.</Text>
          ) : (
            client.salon.map((t) => (
              <TableRow
                key={t.id}
                table={t}
                disabled={busy}
                onSit={() => (t.locked ? setPinFor({ kind: 'join', table: t }) : run(() => client.joinRoom(name, t.id)))}
              />
            ))
          )}
        </ScrollView>

        {/* iOS: scroll a focused text box above the keyboard instead of hiding it underneath. */}
        <ScrollView
          style={styles.side}
          contentContainerStyle={{ gap: 10, paddingBottom: 12 }}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
        >
          <View style={styles.modeRow}>
            {(['101', 'duz'] as const).map((m) => (
              <Button
                key={m}
                title={m === '101' ? '101' : 'Düz'}
                variant={mode === m ? 'primary' : 'secondary'}
                onPress={() => setMode(m)}
                style={{ flex: 1, minWidth: 0, paddingHorizontal: 4 }}
              />
            ))}
          </View>
          <Button
            title="Masa Aç"
            subtitle="Salonda görünür"
            variant="success"
            onPress={() => run(() => client.createRoom(name, mode, true))}
            disabled={busy || offline}
          />
          <Button
            title="Şifreli Masa"
            subtitle="6 rakamlı şifreyle girilir"
            variant="secondary"
            onPress={() => {
              setError(null);
              setPinFor({ kind: 'create' });
            }}
            disabled={busy || offline}
          />
          {error && <Text style={styles.warn}>{error}</Text>}
          {/* The live server address is built in (App.tsx); the field is only for development builds. */}
          {__DEV__ && (
            <>
              <Text style={styles.label}>Sunucu adresi</Text>
              <TextInput
                style={styles.urlInput}
                value={url}
                onChangeText={setUrl}
                onEndEditing={() => onServerUrlChange(url.trim())}
                autoCapitalize="none"
                autoCorrect={false}
                disableFullscreenUI
              />
            </>
          )}
        </ScrollView>
      </View>
      {pinFor && (
        <PinPrompt
          title={pinFor.kind === 'create' ? 'Masa şifresi belirle' : `${modeName(pinFor.table.mode)} masasının şifresi`}
          action={pinFor.kind === 'create' ? 'Masayı Aç' : 'Otur'}
          busy={busy}
          error={error}
          onSubmit={submitPin}
          onCancel={() => {
            setPinFor(null);
            setError(null);
          }}
        />
      )}
    </View>
  );
}

/**
 * Six-digit password box. It sits at the top of the screen so the phone's
 * keyboard, which covers the bottom half in landscape, never hides it.
 */
function PinPrompt(props: {
  title: string;
  action: string;
  busy: boolean;
  error: string | null;
  onSubmit(pin: string): Promise<Result>;
  onCancel(): void;
}) {
  const [pin, setPin] = useState('');
  const ready = isTablePassword(pin);
  return (
    <Modal
      transparent
      animationType="fade"
      onRequestClose={props.onCancel}
      supportedOrientations={['landscape', 'landscape-left', 'landscape-right']}
    >
      <View style={styles.backdrop}>
        <View style={styles.pinCard}>
          <Text style={styles.pinTitle}>{props.title}</Text>
          <View style={styles.pinRow}>
            <TextInput
              style={styles.pinInput}
              value={pin}
              onChangeText={(t) => setPin(t.replace(/\D/g, '').slice(0, 6))}
              placeholder="••••••"
              placeholderTextColor={colors.muted}
              keyboardType="number-pad"
              maxLength={6}
              autoFocus
              disableFullscreenUI
              onSubmitEditing={() => ready && void props.onSubmit(pin)}
            />
            <Button
              title={props.action}
              onPress={() => void props.onSubmit(pin)}
              disabled={!ready || props.busy}
              style={{ minWidth: 150 }}
            />
            <Button title="Vazgeç" variant="secondary" onPress={props.onCancel} style={{ minWidth: 130 }} />
          </View>
          {props.error ? (
            <Text style={styles.warn}>{props.error}</Text>
          ) : (
            <Text style={styles.label}>Sadece rakam, 6 hane</Text>
          )}
        </View>
      </View>
    </Modal>
  );
}

function TableRow({ table, disabled, onSit }: { table: TableSummary; disabled: boolean; onSit(): void }) {
  return (
    <View style={styles.row}>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {table.locked ? '🔒 ' : ''}
          {modeName(table.mode)}
          <Text style={styles.rowState}>
            {table.started ? '  · oyun sürüyor, bir yer boş' : `  · ${table.free} kişi bekleniyor`}
          </Text>
        </Text>
        <View style={styles.chips}>
          {table.seats.map((n, i) => (
            <View key={i} style={[styles.chip, n === null && styles.chipFree]}>
              <Text style={[styles.chipText, n === null && { color: colors.muted }]} numberOfLines={1}>
                {n ?? (table.started ? 'bot' : 'boş')}
              </Text>
            </View>
          ))}
        </View>
      </View>
      <Button title="Otur" onPress={onSit} disabled={disabled} style={{ minWidth: 110 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingTop: 8 },
  heading: { color: colors.accent, fontSize: font.title, fontWeight: '900' },
  body: { flex: 1, flexDirection: 'row', gap: 12, padding: 12 },
  list: { flex: 1 },
  side: { width: 250, flexGrow: 0 },
  empty: { color: colors.text, fontSize: font.body, textAlign: 'center', marginTop: 24, lineHeight: 26 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 12,
    backgroundColor: colors.panel,
  },
  rowTitle: { color: colors.text, fontSize: font.body, fontWeight: '800' },
  rowState: { color: colors.muted, fontSize: font.small, fontWeight: '600' },
  chips: { flexDirection: 'row', gap: 6 },
  chip: { flex: 1, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 4 },
  chipFree: { backgroundColor: 'transparent', borderWidth: 1, borderStyle: 'dashed', borderColor: colors.muted },
  chipText: { color: colors.text, fontSize: font.small, fontWeight: '700', textAlign: 'center' },
  modeRow: { flexDirection: 'row', gap: 8 },
  label: { color: colors.muted, fontSize: font.small },
  urlInput: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    color: colors.text,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: font.small,
  },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', paddingTop: 16 },
  pinCard: { backgroundColor: colors.panel, borderRadius: 16, padding: 16, gap: 10, alignItems: 'center' },
  pinTitle: { color: colors.text, fontSize: font.body, fontWeight: '800' },
  pinRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  pinInput: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    color: colors.text,
    borderRadius: 12,
    paddingHorizontal: 8,
    fontSize: 26,
    textAlign: 'center',
    letterSpacing: 6,
    width: 190,
    minHeight: 56,
  },
  warn: { color: '#ffb4a8', fontSize: font.body, textAlign: 'center', fontWeight: '600' },
});
