import { useEffect, useState } from 'react';
import { BackHandler, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from '../components/Button';
import { MonetizationSettings } from '../components/MonetizationSettings';
import { loadName, saveName } from '../feedback';
import { Salon } from './Salon';
import type { OkeyClient } from '../net/useOkey';
import { colors, font } from '../theme';
import { split, t, tErr } from '../i18n';

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
    if (!res.ok) setError(tErr(res.error));
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

  const welcome = split('welcome', 'name');
  if (!loaded) return <View style={styles.root} />;

  if (name === null || editingName) {
    // Kept at the top of the screen: in landscape the keyboard covers the lower half.
    return (
      <View style={styles.nameRoot}>
        <Text style={styles.question}>{t('askName')}</Text>
        <View style={styles.nameRow}>
          <TextInput
            style={styles.nameInput}
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={confirmName}
            placeholder={t('namePlaceholder')}
            placeholderTextColor={colors.muted}
            maxLength={20}
            disableFullscreenUI
            autoFocus
            returnKeyType="done"
          />
          <Button title={t('continue')} onPress={confirmName} disabled={!draft.trim()} style={{ minWidth: 140 }} />
        </View>
      </View>
    );
  }

  if (friends) {
    return (
      <Salon
        client={client}
        name={name}
        serverUrl={serverUrl}
        onServerUrlChange={onServerUrlChange}
        onBack={() => setFriends(false)}
      />
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.root}>
      <Text style={styles.title}>
        <Text style={styles.titleName}>Demli </Text>Okey
      </Text>
      <Pressable onPress={() => setEditingName(true)} hitSlop={12}>
        <Text style={styles.welcome}>
          {welcome[0]}<Text style={{ color: colors.accent }}>{name}</Text>{welcome[1]}
          <Text style={styles.change}>{'   '}{t('change')}</Text>
        </Text>
      </Pressable>
      <Text style={styles.question}>{t('whichGame')}</Text>
      <View style={styles.games}>
        <Button
          title={t('game101')}
          subtitle={t('game101Sub')}
          size="large"
          onPress={() => {
            void run(() => client.quickPlay(name, '101'));
          }}
          disabled={busy}
        />
        <Button
          title={t('gameDuz')}
          subtitle={t('gameDuzSub')}
          size="large"
          onPress={() => {
            void run(() => client.quickPlay(name, 'duz'));
          }}
          disabled={busy}
        />
      </View>
      <Button
        title={t('salon')}
        subtitle={t('salonSub')}
        variant="secondary"
        onPress={() => setFriends(true)}
      />
      {error && <Text style={styles.warn}>{error}</Text>}
      <MonetizationSettings />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 16, gap: 14 },
  games: { flexDirection: 'row', gap: 24 },
  title: { color: colors.accent, fontSize: 40, fontWeight: '900' },
  titleName: { color: colors.text, fontSize: 28, fontWeight: '800' },
  welcome: { color: colors.text, fontSize: 24, fontWeight: '700' },
  change: { color: colors.muted, fontSize: font.small, fontWeight: '400' },
  question: { color: colors.text, fontSize: 26, fontWeight: '700' },
  nameRoot: { flex: 1, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 16, gap: 12 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
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
  warn: { color: '#ffb4a8', fontSize: font.body, textAlign: 'center', fontWeight: '600' },
});
