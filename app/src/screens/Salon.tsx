import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { GameMode, TableSummary } from '@okey/shared';
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

/**
 * The salon: open tables on the left, one tap to sit down; opening a table
 * (listed for anyone, or private with a code) on the right.
 */
export function Salon({ client, name, serverUrl, onServerUrlChange, onBack }: Props) {
  const [mode, setMode] = useState<GameMode>('101');
  const [code, setCode] = useState('');
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
              <TableRow key={t.id} table={t} disabled={busy} onSit={() => run(() => client.joinRoom(name, t.id))} />
            ))
          )}
        </ScrollView>

        {/* iOS: scroll the focused code box above the keyboard instead of hiding it underneath. */}
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
            title="Özel Masa"
            subtitle="Kodla girilir"
            variant="secondary"
            onPress={() => run(() => client.createRoom(name, mode, false))}
            disabled={busy || offline}
          />
          <View style={styles.joinRow}>
            <TextInput
              style={styles.codeInput}
              value={code}
              onChangeText={(t) => setCode(t.toUpperCase())}
              placeholder="Kod"
              placeholderTextColor={colors.muted}
              autoCapitalize="characters"
              maxLength={5}
              // In landscape Android opens a full-screen keyboard that hides the table; keep the screen visible.
              disableFullscreenUI
            />
            <Button
              title="Katıl"
              onPress={() => run(() => client.joinRoom(name, code))}
              disabled={busy || offline || code.length < 5}
              style={{ flex: 1, minWidth: 0 }}
            />
          </View>
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
    </View>
  );
}

function TableRow({ table, disabled, onSit }: { table: TableSummary; disabled: boolean; onSit(): void }) {
  return (
    <View style={styles.row}>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={styles.rowTitle} numberOfLines={1}>
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
  joinRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  codeInput: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    color: colors.text,
    borderRadius: 12,
    paddingHorizontal: 8,
    fontSize: 22,
    textAlign: 'center',
    letterSpacing: 3,
    width: 120,
    minHeight: 56,
  },
  label: { color: colors.muted, fontSize: font.small },
  urlInput: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    color: colors.text,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: font.small,
  },
  warn: { color: '#ffb4a8', fontSize: font.body, textAlign: 'center', fontWeight: '600' },
});
