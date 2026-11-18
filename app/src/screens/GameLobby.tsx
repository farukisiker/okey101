// B5 (Claude Opus): the lobby of a non-okey game (pişti, batak, tavla): play bots now, or a table with friends.
import { useEffect, useState } from 'react';
import { BackHandler, ScrollView, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { GameId } from '@kahve/core';
import { CATALOG, gamesInGroup } from '@kahve/catalog';
import { Button } from '../components/Button';
import { loadName } from '../feedback';
import { type Key, t, tErr } from '../i18n';
import { MATCH_POINT_CHOICES, type TableSetup, normalizeSetup, setupKey, setupOptions } from '../net/tableSetup';
import type { KahveClient } from '../net/useKahveGame';
import { colors, font } from '../theme';
import { Salon } from './Salon';

interface Props {
  gameId: GameId;
  client: KahveClient;
  serverUrl: string;
  onServerUrlChange(url: string): void;
  onBack(): void;
  /** A game is about to start (for "Son oynadığın"). */
  onStart?(gameId: GameId): void;
}

export function GameLobby({ gameId, client, serverUrl, onServerUrlChange, onBack, onStart }: Props) {
  const meta = CATALOG.find((g) => g.id === gameId);
  const seatChoices = meta?.seatChoices ?? [2];
  const [name, setName] = useState<string | null>(null);
  const [setup, setSetup] = useState<TableSetup>(() => normalizeSetup(null, seatChoices));
  const [friends, setFriends] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadName().then(setName);
    AsyncStorage.getItem(setupKey(gameId))
      .then((v) => v && setSetup(normalizeSetup(JSON.parse(v), seatChoices)))
      .catch(() => {});
    // seatChoices comes from the static catalog.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId]);

  const choose = (next: TableSetup) => {
    const s = normalizeSetup(next, seatChoices);
    setSetup(s);
    AsyncStorage.setItem(setupKey(gameId), JSON.stringify(s)).catch(() => {});
  };

  // Android back: the friends list steps back to the lobby, the lobby back to the game list.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (friends) setFriends(false);
      else onBack();
      return true;
    });
    return () => sub.remove();
  }, [friends, onBack]);

  const player = name ?? t('player');
  const title = t((meta?.titleKey ?? `game.${gameId}`) as Key);
  // Tavla is alone in its group: its lobby goes back to the salon, not to a list of one game.
  const backKey: Key = meta && gamesInGroup(meta.group).length === 1 ? 'backToSalon' : 'backToGames';

  if (friends) {
    return (
      <Salon
        client={client}
        name={player}
        serverUrl={serverUrl}
        onServerUrlChange={onServerUrlChange}
        onBack={() => setFriends(false)}
        game={gameId}
        options={setupOptions(setup, gameId)}
      />
    );
  }

  const playNow = async () => {
    setBusy(true);
    setError(null);
    onStart?.(gameId);
    const res = await client.playOffline(player, setupOptions(setup, gameId));
    setBusy(false);
    if (!res.ok) setError(tErr(res.error));
  };

  return (
    <ScrollView contentContainerStyle={styles.root}>
      <Text style={styles.title}>{title}</Text>
      {seatChoices.length > 1 && (
        <View style={styles.row}>
          {seatChoices.map((n) => (
            <Button
              key={n}
              title={t('seatsN', { n })}
              variant={setup.seats === n ? 'primary' : 'secondary'}
              onPress={() => choose({ ...setup, seats: n })}
              style={styles.choice}
            />
          ))}
        </View>
      )}
      {setup.seats === 4 && gameId === 'pisti' && (
        <View style={styles.row}>
          {[false, true].map((partners) => (
            <Button
              key={String(partners)}
              title={partners ? t('playPartners') : t('playSolo')}
              variant={setup.partners === partners ? 'primary' : 'secondary'}
              onPress={() => choose({ ...setup, partners })}
              style={styles.choice}
            />
          ))}
        </View>
      )}
      {gameId === 'tavla' && (
        <>
          <Text style={styles.label}>{t('tavlaMatchLength')}</Text>
          <View style={styles.row}>
            {MATCH_POINT_CHOICES.map((n) => (
              <Button
                key={n}
                title={String(n)}
                variant={setup.matchPoints === n ? 'primary' : 'secondary'}
                onPress={() => choose({ ...setup, matchPoints: n })}
                style={styles.pointChoice}
              />
            ))}
          </View>
        </>
      )}
      <View style={styles.row}>
        <Button title={t('cardPlayNow')} subtitle={t('cardPlayNowSub')} size="large" onPress={() => void playNow()} disabled={busy} />
        <Button
          title={t('cardFriends')}
          subtitle={t('cardFriendsSub')}
          size="large"
          variant="secondary"
          onPress={() => {
            onStart?.(gameId);
            setFriends(true);
          }}
          disabled={busy}
        />
      </View>
      {error && <Text style={styles.warn}>{error}</Text>}
      <Button title={t(backKey)} variant="secondary" onPress={onBack} style={{ minWidth: 120 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 16, gap: 14 },
  title: { color: colors.accent, fontSize: 40, fontWeight: '900' },
  row: { flexDirection: 'row', gap: 16, flexWrap: 'wrap', justifyContent: 'center' },
  choice: { minWidth: 150 },
  pointChoice: { minWidth: 88 },
  label: { color: colors.text, fontSize: font.body, fontWeight: '800' },
  warn: { color: '#ffb4a8', fontSize: font.body, textAlign: 'center', fontWeight: '600' },
});
