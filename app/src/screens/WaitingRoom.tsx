import { useEffect, useState } from 'react';
import { BackHandler, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import type { OkeyClient } from '../net/useOkey';
import { colors, font } from '../theme';

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
        <Button title="‹ Çık" variant="secondary" onPress={client.leave} style={{ minWidth: 120 }} />
      </View>
      <Text style={styles.game}>{room.mode === 'duz' ? 'Düz Okey' : '101 Okey'}</Text>
      {room.password ? (
        <>
          <Text style={styles.label}>🔒 Masa şifresi — oturacak arkadaşlarına söyle</Text>
          <Text style={styles.code}>{room.password}</Text>
        </>
      ) : room.isPublic ? (
        <Text style={styles.label}>Masan salonda görünüyor · 4 kişi olunca oyun kendiliğinden başlar</Text>
      ) : (
        <>
          <Text style={styles.label}>Masa kodu — arkadaşlarına gönder</Text>
          <Text style={styles.code}>{room.id}</Text>
        </>
      )}
      <View style={styles.seats}>
        {room.seats.map((s, i) => (
          <View key={i} style={styles.seat}>
            <Text style={styles.seatName}>{s ? s.name : 'Boş'}</Text>
            {i === session.seat && <Text style={styles.you}>sen</Text>}
          </View>
        ))}
      </View>
      {isHost ? (
        <Button
          title="Botlarla Başlat"
          subtitle="Boş yerlere bilgisayar oturur"
          onPress={async () => {
            const r = await client.start();
            if (!r.ok) setError(r.error);
          }}
        />
      ) : (
        <Text style={styles.label}>Masa dolunca ya da masayı açan başlatınca oyun başlar…</Text>
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
