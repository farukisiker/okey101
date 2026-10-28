import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from '../components/Button';
import type { OkeyClient } from '../net/useOkey';
import { colors } from '../theme';

interface Props {
  client: OkeyClient;
  serverUrl: string;
  onServerUrlChange(url: string): void;
}

export function Lobby({ client, serverUrl, onServerUrlChange }: Props) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [url, setUrl] = useState(serverUrl);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const playerName = name.trim() || 'Oyuncu';
  const run = async (fn: () => Promise<{ ok: true } | { ok: false; error: string }>) => {
    setBusy(true);
    setError(null);
    const res = await fn();
    setBusy(false);
    if (!res.ok) setError(res.error);
  };

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Okey 101</Text>
      <View style={styles.row}>
        <View style={styles.col}>
          <Text style={styles.label}>Adın</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Oyuncu"
            placeholderTextColor={colors.muted}
            maxLength={20}
          />
          <Button title="Hızlı Oyun (botlarla, internetsiz)" onPress={() => run(() => client.quickPlay(playerName))} disabled={busy} />
          <Text style={styles.hint}>Arkadaşlarla oynamak için sunucu gerekir:</Text>
          <Button title="Oda Kur" variant="secondary" onPress={() => run(() => client.createRoom(playerName))} disabled={busy} />
        </View>
        <View style={styles.col}>
          <Text style={styles.label}>Oda kodu</Text>
          <TextInput
            style={styles.input}
            value={code}
            onChangeText={(t) => setCode(t.toUpperCase())}
            placeholder="ABCDE"
            placeholderTextColor={colors.muted}
            autoCapitalize="characters"
            maxLength={5}
          />
          <Button
            title="Odaya Katıl"
            variant="secondary"
            onPress={() => run(() => client.joinRoom(playerName, code))}
            disabled={busy || code.length < 5}
          />
          <Text style={styles.label}>Sunucu</Text>
          <TextInput
            style={[styles.input, styles.small]}
            value={url}
            onChangeText={setUrl}
            onEndEditing={() => onServerUrlChange(url.trim())}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text style={[styles.status, { color: client.connected ? colors.ok : colors.danger }]}>
            {client.connected ? '● Bağlı' : '● Bağlantı yok'}
          </Text>
        </View>
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  title: { color: colors.accent, fontSize: 34, fontWeight: '900', marginBottom: 12 },
  row: { flexDirection: 'row', gap: 32 },
  col: { width: 260, gap: 8 },
  label: { color: colors.muted, fontSize: 12, marginTop: 4 },
  input: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    color: colors.text,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 16,
  },
  small: { fontSize: 12, paddingVertical: 6 },
  status: { fontSize: 12 },
  hint: { color: colors.muted, fontSize: 11, marginTop: 6 },
  error: { color: colors.danger, marginTop: 12, fontWeight: '700' },
});
