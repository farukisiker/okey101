import { useEffect, useState } from 'react';
import { BackHandler, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { GameMode } from '@okey/shared';
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
 * After the name (asked once and remembered) the player picks the game: two
 * big buttons, 101 or düz okey, each starts a table with bots right away.
 * Playing with friends (which needs a server) is tucked behind a third button.
 */
export function Lobby({ client, serverUrl, onServerUrlChange }: Props) {
  const [name, setName] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [draft, setDraft] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [friends, setFriends] = useState(false);
  /** Game for a new friends' room; set by the last game button pressed. */
  const [mode, setMode] = useState<GameMode>('101');
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

  // Android back steps back inside the lobby; on the main screen it leaves the app as usual.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (friends) setFriends(false);
      else if (editingName && name !== null) setEditingName(false);
      else return false;
      return true;
    });
    return () => sub.remove();
  }, [friends, editingName, name]);

  if (!loaded) return <View style={styles.root} />;

  if (name === null || editingName) {
    // Kept at the top of the screen: in landscape the keyboard covers the lower half.
    return (
      <View style={styles.nameRoot}>
        <Text style={styles.question}>Adınız nedir?</Text>
        <View style={styles.nameRow}>
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
          <Button title="Devam" onPress={confirmName} disabled={!draft.trim()} style={{ minWidth: 140 }} />
        </View>
      </View>
    );
  }

  if (friends) {
    const offline = !client.connected;
    return (
      <View style={{ flex: 1 }}>
        {/* Back is always in the top-left corner, never scrolled out of sight. */}
        <View style={styles.header}>
          <Button title="‹ Geri" variant="secondary" onPress={() => setFriends(false)} style={{ minWidth: 120 }} />
          <Text style={styles.heading}>Arkadaşlarla Oyna</Text>
          <View style={{ width: 120 }} />
        </View>
        <ScrollView contentContainerStyle={styles.friendsBody} keyboardShouldPersistTaps="handled">
          {offline ? (
            <Text style={styles.warn}>
              Oyun sunucusuna bağlanılamadı. Bilgisayara karşı her zaman oynayabilirsin.
            </Text>
          ) : null}
          <View style={styles.friendsRow}>
            <View style={styles.col}>
              <View style={styles.modeRow}>
                {(['101', 'duz'] as const).map((m) => (
                  <Button
                    key={m}
                    title={m === '101' ? '101 Okey' : 'Düz Okey'}
                    variant={mode === m ? 'primary' : 'secondary'}
                    onPress={() => setMode(m)}
                    style={{ minWidth: 150, paddingHorizontal: 8 }}
                  />
                ))}
              </View>
              <Button
                title="Yeni Oda Kur"
                onPress={() => run(() => client.createRoom(name, mode))}
                disabled={busy || offline}
              />
            </View>
            <View style={[styles.col, styles.joinRow]}>
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
                title="Katıl"
                onPress={() => run(() => client.joinRoom(name, code))}
                disabled={busy || offline || code.length < 5}
              />
            </View>
          </View>
          {error && <Text style={styles.warn}>{error}</Text>}
          <View style={styles.urlRow}>
            <Text style={styles.label}>Sunucu adresi</Text>
            <TextInput
              style={styles.urlInput}
              value={url}
              onChangeText={setUrl}
              onEndEditing={() => onServerUrlChange(url.trim())}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Text style={styles.title}>
        <Text style={styles.titleName}>Nurettin Işıker </Text>VIP Okey
      </Text>
      <Pressable onPress={() => setEditingName(true)} hitSlop={12}>
        <Text style={styles.welcome}>
          Hoş geldin, <Text style={{ color: colors.accent }}>{name}</Text>
          <Text style={styles.change}>   (değiştir)</Text>
        </Text>
      </Pressable>
      <Text style={styles.question}>Hangi oyunu oynayalım?</Text>
      <View style={styles.games}>
        <Button
          title="101 OKEY"
          subtitle="101 sayıyla aç, yere per indir"
          size="large"
          onPress={() => {
            setMode('101');
            void run(() => client.quickPlay(name, '101'));
          }}
          disabled={busy}
        />
        <Button
          title="DÜZ OKEY"
          subtitle="14 taşı diz, 15.'yi atıp bitir"
          size="large"
          onPress={() => {
            setMode('duz');
            void run(() => client.quickPlay(name, 'duz'));
          }}
          disabled={busy}
        />
      </View>
      <Button title="Arkadaşlarla Oyna" variant="secondary" onPress={() => setFriends(true)} />
      {error && <Text style={styles.warn}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 16, gap: 14 },
  games: { flexDirection: 'row', gap: 24 },
  modeRow: { flexDirection: 'row', gap: 8 },
  title: { color: colors.accent, fontSize: 40, fontWeight: '900' },
  titleName: { color: colors.text, fontSize: 28, fontWeight: '800' },
  heading: { color: colors.accent, fontSize: font.title, fontWeight: '900' },
  welcome: { color: colors.text, fontSize: 24, fontWeight: '700' },
  change: { color: colors.muted, fontSize: font.small, fontWeight: '400' },
  question: { color: colors.text, fontSize: 26, fontWeight: '700' },
  nameRoot: { flex: 1, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 16, gap: 12 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  label: { color: colors.muted, fontSize: font.small },
  nameInput: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    color: colors.text,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 26,
    minWidth: 340,
    minHeight: 56,
    textAlign: 'center',
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingTop: 8 },
  friendsBody: { alignItems: 'center', padding: 12, gap: 14 },
  friendsRow: { flexDirection: 'row', gap: 32, alignItems: 'center' },
  col: { gap: 10 },
  joinRow: { flexDirection: 'row', alignItems: 'center' },
  urlRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  codeInput: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    color: colors.text,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 24,
    textAlign: 'center',
    letterSpacing: 4,
    width: 170,
    minHeight: 56,
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
