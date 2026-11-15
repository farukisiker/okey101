DURUM: FABLE ONAYI BEKLİYOR
B5-OPUS planı (Opus 5.5, feat/kahve-b5 @ 4e19853). types.ts/protocol.ts değişmez; Codex B2 + Argon B4 feat/kahve'ye girince `git merge feat/kahve`, sonra kod.
1 catalog: `catalog/src/pisti.ts` = `pistiDef` + `PistiView/PistiAction/PistiOptions` tip yeniden ihracı (app package.json'a dokunmadan app tipleri buradan alır; catalog zaten @kahve/pisti'ye bağlı). DEFINITIONS'a pisti, CATALOG'da toMeta(pistiDef) → 'active'.
   Test: getDefinition('pisti'), seatChoices [2,4], normalize (bozuk → 2 kişi, partnerMode yalnız 4'te), gamesInGroup('kagit') pisti active.
2 `app/src/net/localHost.ts` (SAF, React yok): Room'un saat/bildirim/seed mantığının istemci kopyası: `hostCreate(def,opts,names,seed)`, `hostAct(h,seat,a,now)`, `hostNextRound`, `hostView(h,seat,now)`,
   `hostMatchOver`, `hostDue(h,now)` → {seat, kind:'bot'|'quick', at}. nextTurnClock + freezeClock + NOTICE_MS + matchStart + seededRng(seed)/seed^BOT_SALT aynen Room gibi. Sunucu kodu taşınmaz (Room A4 testli, riske atmam);
   eşdeğerlik testi app/test/localHost.test.ts: aynı seed + aynı hamleler → Room.replay ile aynı durum/totals, saat donması, bot zamanlaması (sahte zaman). useLocalGame (okey) DEĞİŞMEZ.
3 `app/src/net/useKahveGame.ts` → `{view, room, seat, act, nextRound, leave, matchOver, summary, busy, error}` + lobi için `quickPlay(n,opts)/createRoom/joinRoom/start/salon/connected`.
   Çevrimdışı: localHost + tek zamanlayıcı (hostDue), RoomInfo'yu yerelde üretir (game, totals, matchOver). Çevrimiçi: kendi socket'i YALNIZ kart lobisi/oyun açıkken (useOkey'e dokunmamak için; kapanınca close),
   auth v2, `room:*` `game` ile, `game:view` zarfında `game===gameId` olanı alır, `salon:watch(true,{games:[gameId]})`, yeniden bağlanınca koltuk geri alma useOkey'deki gibi.
4 fakeTypes → gerçek PistiView farkları: `turn` number|null; seats/partnerMode/targetScore → `options.*`; players'ta totalScore/connected/isBot YOK (RoomInfo seats+totals'tan ekran adaptöründe);
   lastCapture {card,pointsEarned,capturedCount} → Capture {cardId,points} (kart = lastAction.card); turnMsLeft YOK → `clock.deadline−now` (saniyelik yeniden çizim); result {scores,totals,winnerSeats,matchOver,breakdown} → yalnız {scores};
   notices/noticeMsLeft yok (pisti noticeOf tanımsız); `team` yeni; sortCards → @kahve/cards sortHand. Bağlama: PistiScreen'e `summary` + `room` prop'u, iç summary hesabı kalkar; düzen aynen. Batak tipleri B3'e kadar fakeTypes'ta kalır.
5 RoundSummary (hook'ta, saf `cardSummary(def, state/view, room)` + test): 2 kişi/4 tek: satır = koltuk, points=scoreRound, total=room.totals. Eşli: [A,B,A,B] → 2 takım satırı ("Ali & Ayşe", seat=0/1),
   kazanan = el puanı en yüksek tekil takımın her iki koltuğu; matchOver'da totals en yüksek. matchOver = room.matchOver (çevrimiçi sunucudan, çevrimdışı hostMatchOver).
6 Reklam: GameShell summary değişince zaten `adGate.onHandCompleted(gameId)` sayıyor → hook ve App SAYMAZ; summary nesnesi el başına bir kez üretilir (useMemo anahtarı room.round), yeniden render çift saymaz. App'teki okey sayacı yalnız okey client'a bakar, kart görünümü oraya girmez.
7 GameLobby.tsx: "Hemen Oyna" (botlarla; Pişti 2/4 seçimi, AsyncStorage `kahve.seats.pisti` ile hatırlanır; 4'te eşli varsayılan) + "Arkadaşlarla" → Salon (game filtreli). Salon/WaitingRoom prop tipi
   OkeyClient → dar `TableClient` arayüzü (okey client yapısal uyar) + isteğe bağlı `game?`; okey çağrıları aynen. Batak gelince aynı lobi.
8 App.tsx nav: salon → secim → `cardLobi`(gameId) → (WaitingRoom) → PistiScreen. Geri: oyun→onaylı çıkış→lobi, bekleme→leave→lobi, salon listesi→lobi, lobi→secim, secim→salon.
   `onPick` OyunSecimi'ye bağlanır; loadLastGame tüm aktif GameId'leri kabul eder, KahveSalonu onResume kart oyununda doğrudan o oyunun lobisine; saveLastGame oyun başlarken.
9 Sunucu testi server/test/cards-e2e.test.ts (gerçek socket, pistiDef): v2 create(game:'pisti',seats:2) → join → start → botlu/insan hamleleriyle tur sonu → totals → nextRound; 4 kişi eşli totals [A,B,A,B]; v1 istemci pisti masasını salonda görmez, join ERR_UPDATE_APP. A4 testleri aynen.
10 i18n: yeni anahtarlar tr/en + 11 dilde İngilizce. Risk: pisti `structuredClone` kullanıyor; Hermes'te tabletle doğrularım, yoksa Codex'e istek (docs/kahve/requests/opus-structuredclone.md), ben polyfill eklemem.
Kabul: kökte test+typecheck yeşil (≥328), `npx expo export --platform android` boyutu, rapor + tablet adımları (2 kişi botlu, 4 kişi botlu, yerel sunucuda iki cihaz).
Commit sırası: (a) catalog pisti+test (b) localHost+test (c) useKahveGame+cardSummary+test (d) server e2e test (e) TableClient + GameLobby + i18n (f) ekran bağlama (fakeTypes→gerçek) (g) App.tsx yönlendirme (h) rapor. Her adımda test+typecheck.
