import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import type { OkeyClient } from '../net/useOkey';
import { colors, font } from '../theme';

export function WaitingRoom({ client }: { client: OkeyClient }) {
  const { room, session } = client;
  const [error, setError] = useState<string | null>(null);
  if (!room || !session) return null;
  const isHost = room.hostSeat === session.seat;

  return (
    <View style={styles.root}>
      <Text style={styles.label}>Oda kodu</Text>
      <Text style={styles.code}>{room.id}</Text>
      <View style={styles.seats}>
        {room.seats.map((s, i) => (
          <View key={i} style={styles.seat}>
            <Text style={styles.seatName}>{s ? s.name : 'Boş — bilgisayar oturacak'}</Text>
            {i === session.seat && <Text style={styles.you}>sen</Text>}
          </View>
        ))}
      </View>
      {isHost ? (
        <Button
          title="Başlat"
          onPress={async () => {
            const r = await client.start();
            if (!r.ok) setError(r.error);
          }}
        />
      ) : (
        <Text style={styles.label}>Oda sahibinin başlatması bekleniyor…</Text>
      )}
      <Button title="Çık" variant="secondary" onPress={client.leave} style={{ marginTop: 8 }} />
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
  label: { color: colors.muted, fontSize: font.body },
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
