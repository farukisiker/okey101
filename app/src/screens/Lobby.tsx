import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from '../components/Button';
import { loadName, saveName } from '../feedback';
import type { OkeyClient } from '../net/useOkey';
import { colors, font } from '../theme';

interface Props {
  client: OkeyClient;
  serverUrl: string;
  onServerUrlChange(url: string): void;
}

type Result = { ok: true } | { ok: false; error: string };

/**
 * One big "OYNA" button. The name is asked once and remembered; playing with
 * friends (which needs a server) is tucked behind a second button.
 */
export function Lobby({ client, serverUrl, onServerUrlChange }: Props) {
  const [name, setName] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [draft, setDraft] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [friends, setFriends] = useState(false);
  const [code, setCode] = useState('');
  const [url, setUrl] = useState(serverUrl);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    loadName().then((n) => {
      setName(n);
      setDraft(n ?? '');
      setLoaded(true);
    });
  }, []);

  const run = async (fn: () => Promise<Result>) => {
    setBusy(true);
    setError(null);
    const res = await fn();
    setBusy(false);
    if (!res.ok) setError(res.error);
  };

  const confirmName = () => {
    const n = draft.trim();
    if (!n) return;
    saveName(n);
    setName(n);
    setEditingName(false);
  };

  if (!loaded) return <View style={styles.root} />;

  if (name === null || editingName) {
    return (
      <View style={styles.root}>
        <Text style={styles.title}>Okey 101</Text>
        <Text style={styles.question}>Adınız nedir?</Text>
        <TextInput
          style={styles.nameInput}
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={confirmName}
          placeholder="Adınızı yazın"
          placeholderTextColor={colors.muted}
          maxLength={20}
          autoFocus
          returnKeyType="done"
        />
        <Button title="Devam" onPress={confirmName} disabled={!draft.trim()} style={{ minWidth: 220 }} />
      </View>
    );
  }

  if (friends) {
    const offline = !client.connected;
    return (
      <ScrollView contentContainerStyle={styles.root}>
        <Text style={styles.heading}>Arkadaşlarla Oyna</Text>
        {offline ? (
          <Text style={styles.warn}>
            Oyun sunucusuna bağlanılamadı. Arkadaşlarla oynamak için sunucu gerekir.{'\n'}
            Bilgisayara karşı her zaman oynayabilirsin.
          </Text>
        ) : null}
        <View style={styles.friendsRow}>
          <View style={styles.col}>
            <Button title="Yeni Oda Kur" onPress={() => run(() => client.createRoom(name))} disabled={busy || offline} />
          </View>
          <View style={styles.col}>
            <TextInput
              style={styles.codeInput}
              value={code}
              onChangeText={(t) => setCode(t.toUpperCase())}
              placeholder="Oda kodu"
              placeholderTextColor={colors.muted}
              autoCapitalize="characters"
              maxLength={5}
            />
            <Button
              title="Odaya Katıl"
              onPress={() => run(() => client.joinRoom(name, code))}
              disabled={busy || offline || code.length < 5}
            />
          </View>
        </View>
        <Text style={styles.label}>Sunucu adresi</Text>
        <TextInput
          style={styles.urlInput}
          value={url}
          onChangeText={setUrl}
          onEndEditing={() => onServerUrlChange(url.trim())}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {error && <Text style={styles.warn}>{error}</Text>}
        <Button title="Geri" variant="secondary" onPress={() => setFriends(false)} />
      </ScrollView>
    );
  }

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Okey 101</Text>
      <Pressable onPress={() => setEditingName(true)} hitSlop={12}>
        <Text style={styles.welcome}>
          Hoş geldin, <Text style={{ color: colors.accent }}>{name}</Text>
          <Text style={styles.change}>   (değiştir)</Text>
        </Text>
      </Pressable>
      <Button title="OYNA" size="large" onPress={() => run(() => client.quickPlay(name))} disabled={busy} />
      <Button title="Arkadaşlarla Oyna" variant="secondary" onPress={() => setFriends(true)} />
      {error && <Text style={styles.warn}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 16, gap: 16 },
  title: { color: colors.accent, fontSize: 40, fontWeight: '900' },
  heading: { color: colors.accent, fontSize: font.title, fontWeight: '900' },
  welcome: { color: colors.text, fontSize: 24, fontWeight: '700' },
  change: { color: colors.muted, fontSize: font.small, fontWeight: '400' },
  question: { color: colors.text, fontSize: 26, fontWeight: '700' },
  label: { color: colors.muted, fontSize: font.small },
  nameInput: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    color: colors.text,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 26,
    minWidth: 320,
    textAlign: 'center',
  },
  friendsRow: { flexDirection: 'row', gap: 32, alignItems: 'flex-end' },
  col: { width: 260, gap: 10 },
  codeInput: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    color: colors.text,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 24,
    textAlign: 'center',
    letterSpacing: 4,
  },
  urlInput: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    color: colors.text,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: font.small,
    minWidth: 320,
  },
  warn: { color: '#ffb4a8', fontSize: font.body, textAlign: 'center', fontWeight: '600' },
});
