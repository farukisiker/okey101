import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import { useKeepAwake } from 'expo-keep-awake';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { initFeedback } from './feedback';
import { DropZoneProvider } from './game/dropZones';
import { useLocalGame } from './net/useLocalGame';
import { type OkeyClient, useOkey } from './net/useOkey';
import { GameScreen } from './screens/GameScreen';
import { Intro } from './screens/Intro';
import { Lobby } from './screens/Lobby';
import { WaitingRoom } from './screens/WaitingRoom';
import { colors } from './theme';
import { initAds } from './ads/consent';
import { adGate } from './ads/interstitial';
import { initPurchases, syncOnce } from './purchases';

// The live server runs on the Raspberry Pi behind a Cloudflare Tunnel (docs/raspberry-pi-kurulum.md).
// For local development, set EXPO_PUBLIC_SERVER_URL (e.g. http://localhost:3001).
const DEFAULT_SERVER = process.env.EXPO_PUBLIC_SERVER_URL || 'https://okey.lightsoldiergames.com';

export default function App() {
  // A slow game shouldn't let the screen go dark mid-turn.
  useKeepAwake();
  useEffect(() => {
    void initFeedback();
  }, []);
  const [intro, setIntro] = useState(true);
  const endIntro = useCallback(() => setIntro(false), []);
  useEffect(() => {
    if (intro) return;
    void initPurchases().then(syncOnce);
    void initAds().then(() => adGate.preload());
  }, [intro]);
  const [serverUrl, setServerUrl] = useState(DEFAULT_SERVER);
  const online = useOkey(serverUrl);
  const local = useLocalGame();
  // Quick play runs offline on the device; rooms go through the server.
  const client: OkeyClient = local.active
    ? { ...online, ...local, start: online.start, connected: true }
    : { ...online, quickPlay: local.begin };
  // Keep completion accounting above GameScreen so transient view loss and
  // result-screen remounts cannot count the same hand twice.
  const completedHands = useRef(new Set<number>());
  const finishedSeen = useRef(false);
  const accountingSession = useRef(client.session);
  useEffect(() => {
    if (accountingSession.current !== client.session) {
      if (!client.session || accountingSession.current?.roomId !== client.session.roomId) {
        completedHands.current.clear();
        finishedSeen.current = false;
      }
      accountingSession.current = client.session;
    }
    const round = client.room?.round;
    if (client.view?.phase === 'playing') finishedSeen.current = false;
    if (!client.session || round === undefined || client.view?.phase !== 'finished' || !client.view.result) return;
    // room:state and game:view arrive separately at a new deal. A newer room
    // number paired briefly with the old finished view is still the same hand.
    if (finishedSeen.current || completedHands.current.has(round)) return;
    finishedSeen.current = true;
    completedHands.current.add(round);
    adGate.onHandCompleted();
  }, [client.session, client.room?.round, client.view?.phase, client.view?.result]);

  let screen;
  if (intro) {
    screen = <Intro onDone={endIntro} />;
  } else if (!client.session) {
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
