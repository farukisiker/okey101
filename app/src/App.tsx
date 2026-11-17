import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, StyleSheet } from 'react-native';
import { useKeepAwake } from 'expo-keep-awake';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { initFeedback } from './feedback';
import { DropZoneProvider } from './game/dropZones';
import { useLocalGame } from './net/useLocalGame';
import { type OkeyClient, useOkey } from './net/useOkey';
import { type HostTimes, useKahveGame } from './net/useKahveGame';
import { GameLobby } from './screens/GameLobby';
import { PistiScreen } from './screens/PistiScreen';
import { BatakScreen } from './screens/BatakScreen';
import { TavlaScreen } from './screens/TavlaScreen';
import { CATALOG, gamesInGroup } from '@kahve/catalog';
import type { BatakAction, BatakView, PistiAction, PistiView, TavlaAction, TavlaView } from '@kahve/catalog';
import { isOkeyGame } from '@okey/shared';
import { GameScreen } from './screens/GameScreen';
import { Intro } from './screens/Intro';
import { KahveSalonu } from './screens/KahveSalonu';
import { Lobby } from './screens/Lobby';
import { OyunSecimi } from './screens/OyunSecimi';
import { loadLastGame, saveLastGame } from './screens/kahveGames';
import type { GameId, TableGroup } from '@kahve/core';
import { loadName } from './feedback';
import { WaitingRoom } from './screens/WaitingRoom';
import { colors } from './theme';
import { initAds } from './ads/consent';
import { adGate } from './ads/interstitial';
import { initPurchases, syncOnce } from './purchases';

// The live server runs on the Raspberry Pi behind a Cloudflare Tunnel (docs/raspberry-pi-kurulum.md).
// For local development, set EXPO_PUBLIC_SERVER_URL (e.g. http://localhost:3001).
const DEFAULT_SERVER = process.env.EXPO_PUBLIC_SERVER_URL || 'https://okey.lightsoldiergames.com';

/** A group with a single game (Tavla Köşesi) opens that game's lobby directly, and its lobby steps back to the salon. */
function soleGame(g: TableGroup): GameId | null {
  const games = gamesInGroup(g);
  return games.length === 1 && games[0].status === 'active' ? games[0].id : null;
}

export default function App() {
  // A slow game shouldn't let the screen go dark mid-turn.
  useKeepAwake();
  useEffect(() => {
    void initFeedback();
  }, []);
  // intro -> salon -> (secim -> cardLobi | okeyLobi). A first-time player has no name yet: the
  // Lobby asks for it (and calls onNameReady), so they go there before the salon.
  const [nav, setNav] = useState<'intro' | 'salon' | 'secim' | 'okeyLobi' | 'cardLobi'>('intro');
  /** The card game whose lobby (and table) is open; its socket lives only while this is set. */
  const [cardGame, setCardGame] = useState<GameId | null>(null);
  const [group, setGroup] = useState<TableGroup>('kagit');
  const [last, setLast] = useState<GameId | null>(null);
  const intro = nav === 'intro';
  const endIntro = useCallback(() => {
    void Promise.all([loadName(), loadLastGame()]).then(([n, g]) => {
      setLast(g);
      setNav((cur) => (cur !== 'intro' ? cur : n ? 'salon' : 'okeyLobi'));
    });
  }, []);
  const toSalon = useCallback(() => setNav('salon'), []);
  const openGame = useCallback((id: GameId) => {
    if (isOkeyGame(id)) {
      setNav('okeyLobi');
      return;
    }
    setCardGame(id);
    setNav('cardLobi');
  }, []);
  const toSecim = useCallback(() => {
    const g = CATALOG.find((m) => m.id === cardGame)?.group;
    setCardGame(null);
    if (g && soleGame(g)) {
      setNav('salon');
      return;
    }
    if (g) setGroup(g);
    setNav('secim');
  }, [cardGame]);
  const onCardStart = useCallback((id: GameId) => {
    saveLastGame(id);
    setLast(id);
  }, []);
  const onPicked = useCallback((mode: '101' | 'duz') => {
    const id: GameId = mode === '101' ? 'okey101' : 'okeyDuz';
    saveLastGame(id);
    setLast(id);
  }, []);
  useEffect(() => {
    if (intro) return;
    void initPurchases().then(syncOnce);
    void initAds().then(() => adGate.preload());
  }, [intro]);
  const [serverUrl, setServerUrl] = useState(DEFAULT_SERVER);
  const online = useOkey(serverUrl);
  const local = useLocalGame();
  const kahve = useKahveGame(cardGame, serverUrl);
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

  // Android back: secim -> salon. The Lobby steps back by itself (onExit -> salon);
  // on the salon the default applies. Games and the waiting room keep their own behaviour.
  const inSecim = nav === 'secim' && !client.session;
  useEffect(() => {
    if (!inSecim) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setNav('salon');
      return true;
    });
    return () => sub.remove();
  }, [inSecim]);

  let screen;
  if (intro) {
    screen = <Intro onDone={endIntro} />;
  } else if (kahve.mode && kahve.room && !kahve.room.started) {
    screen = <WaitingRoom client={kahve} />;
  } else if (kahve.mode && kahve.view && kahve.gameId === 'pisti') {
    screen = (
      <PistiScreen
        key={kahve.room?.id}
        view={kahve.view as PistiView & HostTimes}
        viewAt={kahve.viewAt}
        room={kahve.room}
        seat={kahve.seat}
        summary={kahve.summary}
        humanCount={kahve.humanCount}
        onAction={(a: PistiAction) => kahve.act(a)}
        onNextRound={kahve.nextRound}
        onLeave={kahve.leave}
      />
    );
  } else if (kahve.mode && kahve.view && kahve.gameId === 'batak') {
    screen = (
      <BatakScreen
        key={kahve.room?.id}
        view={kahve.view as BatakView & HostTimes}
        viewAt={kahve.viewAt}
        room={kahve.room}
        seat={kahve.seat}
        summary={kahve.summary}
        humanCount={kahve.humanCount}
        onAction={(a: BatakAction) => kahve.act(a)}
        onNextRound={kahve.nextRound}
        onLeave={kahve.leave}
      />
    );
  } else if (kahve.mode && kahve.view && kahve.gameId === 'tavla') {
    screen = (
      <TavlaScreen
        key={kahve.room?.id}
        view={kahve.view as TavlaView & HostTimes}
        viewAt={kahve.viewAt}
        room={kahve.room}
        seat={kahve.seat}
        summary={kahve.summary}
        humanCount={kahve.humanCount}
        onAction={(a: TavlaAction) => kahve.act(a)}
        onNextRound={kahve.nextRound}
        onLeave={kahve.leave}
      />
    );
  } else if (kahve.mode) {
    // At a card table whose first view is still on its way.
    screen = null;
  } else if (!client.session && nav === 'cardLobi' && cardGame) {
    screen = (
      <GameLobby
        gameId={cardGame}
        client={kahve}
        serverUrl={serverUrl}
        onServerUrlChange={setServerUrl}
        onBack={toSecim}
        onStart={onCardStart}
      />
    );
  } else if (!client.session && nav === 'salon') {
    screen = (
      <KahveSalonu
        last={last}
        onOpenGroup={(g) => {
          const only = soleGame(g);
          if (g === 'okey') setNav('okeyLobi');
          else if (only) openGame(only);
          else {
            setGroup(g);
            setNav('secim');
          }
        }}
        onResume={() => (last ? openGame(last) : setNav('okeyLobi'))}
      />
    );
  } else if (!client.session && nav === 'secim') {
    screen = <OyunSecimi group={group} onBack={toSalon} onPick={openGame} />;
  } else if (!client.session) {
    screen = (
      <Lobby
        client={client}
        serverUrl={serverUrl}
        onServerUrlChange={setServerUrl}
        onNameReady={toSalon}
        onExit={toSalon}
        onPicked={onPicked}
      />
    );
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
