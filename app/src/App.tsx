import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { DropZoneProvider } from './game/dropZones';
import { useOkey } from './net/useOkey';
import { GameScreen } from './screens/GameScreen';
import { Lobby } from './screens/Lobby';
import { WaitingRoom } from './screens/WaitingRoom';
import { colors } from './theme';

// On a device, point this at the machine running the server (e.g. http://192.168.1.20:3001).
const DEFAULT_SERVER = process.env.EXPO_PUBLIC_SERVER_URL || 'http://localhost:3001';

export default function App() {
  const [serverUrl, setServerUrl] = useState(DEFAULT_SERVER);
  const client = useOkey(serverUrl);

  let screen;
  if (!client.session) {
    screen = <Lobby client={client} serverUrl={serverUrl} onServerUrlChange={setServerUrl} />;
  } else if (client.room && !client.room.started) {
    screen = <WaitingRoom client={client} />;
  } else {
    screen = <GameScreen client={client} />;
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <SafeAreaView style={styles.root} edges={['left', 'right']}>
          <StatusBar hidden />
          <DropZoneProvider>{screen}</DropZoneProvider>
        </SafeAreaView>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.felt },
});
