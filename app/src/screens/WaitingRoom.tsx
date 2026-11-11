import { useEffect, useState } from 'react';
import { BackHandler, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import type { OkeyClient } from '../net/useOkey';
import { colors, font } from '../theme';
import { t, tErr } from '../i18n';

export function WaitingRoom({ client }: { client: OkeyClient }) {
  const { room, session } = client;
  const [error, setError] = useState<string | null>(null);
  // Android back leaves the room, like "‹ Çık".
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      client.leave();
      return true;
    });
    return () => sub.remove();
  }, [client]);
  if (!room || !session) return null;
  const isHost = room.hostSeat === session.seat;

  return (
    <View style={styles.root}>
      <View style={styles.back}>
        <Button title={t('leaveBack')} variant="secondary" onPress={client.leave} style={{ minWidth: 120 }} />
      </View>
      <Text style={styles.game}>{room.mode === 'duz' ? t('modeDuz') : t('mode101')}</Text>
      {room.password ? (
        <>
          <Text style={styles.label}>{t('passwordTell')}</Text>
          <Text style={styles.code}>{room.password}</Text>
        </>
      ) : room.isPublic ? (
        <Text style={styles.label}>{t('publicInfo')}</Text>
      ) : (
        <>
          <Text style={styles.label}>{t('codeTell')}</Text>
          <Text style={styles.code}>{room.id}</Text>
        </>
      )}
      <View style={styles.seats}>
        {room.seats.map((s, i) => (
          <View key={i} style={styles.seat}>
            <Text style={styles.seatName}>{s ? s.name : t('seatEmpty')}</Text>
            {i === session.seat && <Text style={styles.you}>{t('youLower')}</Text>}
          </View>
        ))}
      </View>
      {isHost ? (
        <Button
          title={t('startWithBots')}
          subtitle={t('startWithBotsSub')}
          onPress={async () => {
            const r = await client.start();
            if (!r.ok) setError(tErr(r.error));
          }}
        />
      ) : (
        <Text style={styles.label}>{t('waitStart')}</Text>
      )}
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
  back: { position: 'absolute', top: 8, left: 12 },
  label: { color: colors.muted, fontSize: font.body, textAlign: 'center', paddingHorizontal: 16 },
  game: { color: colors.text, fontSize: font.title, fontWeight: '900' },
  code: { color: colors.accent, fontSize: 40, fontWeight: '900', letterSpacing: 6 },
  seats: { flexDirection: 'row', gap: 10, marginVertical: 12 },
  seat: {
    width: 170,
    padding: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center',
  },
  seatName: { color: colors.text, fontWeight: '700', fontSize: font.body, textAlign: 'center' },
  you: { color: colors.accent, fontSize: font.small },
  error: { color: colors.danger, fontSize: font.body },
});
