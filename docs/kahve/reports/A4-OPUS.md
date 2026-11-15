# A4-OPUS raporu: generic Room, protokol v2, çevrimdışı oyun adaptörde

DURUM: TAMAM (2026-11-15). Dal feat/kahve-a4, push yok. shared/**, types.ts, catalog src, package.json, lockfile dokunulmadı.
Mevcut testlerde diff yok: `git diff feat/kahve -- server/test/{room,server,bot,compat-v1}.test.ts` boş.

## Commit'ler
- `88251c1` plan, `69d9622` plan onaylandı, `42c0ce9` feat/kahve birleştirildi (protocol.ts yorum düzeltmesi)
- `f9a044d` `nextTurnClock` (@kahve/core) + okey'de `nextClock` ile eşdeğerlik testi
- `c9e02eb` Room her GameDefinition'ı çalıştırıyor; seed, aksiyon günlüğü, `replay`
- `b98eedd` sunucu soket başına v1/v2; salon filtresi; compat-v2 yeşil
- `845aff4` useLocalGame okey adaptörü + nextTurnClock ile
- `898402c` useOkey auth v2 + `game` + zarf açma; i18n `serverUpdating`
- `5ddadff` istek: docs/kahve/requests/opus-renameSeat.md
- (bu rapor)

## Sahiplik istisnaları (Fable onaylı, tek seferlik)
1. `packages/game-core/src/clock.ts` (yeni) + `index.ts`'e tek satır ihraç + `packages/game-core/test/clock.test.ts` (6 test).
2. `packages/catalog/test/clock-equivalence.test.ts` (yeni test dosyası; mevcut catalog dosyaları değişmedi).

## Sunucu
- `Room<S = GameState, A = Action, V = PlayerView>`: varsayılanlar okey, mevcut testlerde `room.game` okey GameState. Tanım
  `opts.definition ?? getDefinition(opts.game ?? gameOfMode(opts.mode))`; yoksa constructor fırlatır (sunucu önceden kontrol eder).
  Koltuk sayısı `def.seats(options)`, totals bu uzunlukta. `mode` = `modeOfGame(game) ?? '101'`.
- Akış: create/apply/roundOver/scoreRound/matchOver/turn; bot `def.botMove(..., 'medium', botRng)`, süresi dolan insan
  `def.quickMove`; bot hamlesi reddedilirse yedek `def.quickMove`, o da olmazsa throw.
- Saat: `nextTurnClock(prev, def.turn(state), refillsClock(action), now, {baseMs: turnTimeoutMs, firstTurnFactor})`;
  turnTimeoutMs varsayılanı `def.clock.baseMs` (okey 30 000 = TURN_MS).
- rng: `opts.rng` verilirse (eski yol) deste, bot ve bot isimleri bugünkü gibi hep ondan (seed = null). Verilmezse
  `seed` (yoksa `newSeed()`): deste `seededRng(seed)`, bot `seededRng(seed ^ 0x9e3779b9)`, isimler Math.random.
  Günlük (`actionLog()`, dışarı gönderilmez): `deal{round,names}`, `act{seat,action}`, `rename{seat,name}`. `replay(def, options, seed, log)`.
- server.ts: bağlantıda `clientProtocol(handshake.auth)`. v1 soket: çıplak PlayerView, RoomInfo/TableSummary `game` alanı
  silinmiş (server.test TableSummary'yi `toEqual` ile kontrol ediyor; plandaki "herkese game" bu yüzden v1'de kaldırıldı),
  salon yalnız okey. v1 + okey dışı create/quickPlay/join: `ERR_UPDATE_APP`. v2: `{game, view}`, `game` dolu, salon
  `{games}` filtresi (boş/yok = okey). Hatalar: 'Bilinmeyen oyun', 'Bu oyun yakında geliyor', 'Bu masa başka bir oyun'.
  `game:action`: önce `def.isAction` ('Geçersiz hamle'), sonra `act`. room:state artık odadaki her sokete kendi protokolüyle gidiyor.
- `OkeyServer.rooms` tipi `Map<string, AnyRoom>`.

## İstemci
- useLocalGame: dış dönüş aynı; içte `okey101Def`/`okeyDuzDef` (create/apply/turn/botMove/quickMove/viewFor/roundOver/
  scoreRound/matchOver) + `nextTurnClock(def.clock)`.
- useOkey: `io(url, {auth: {v: PROTOCOL_VERSION}})`, create/quickPlay'e `game` (+ `mode`), zarf ya da çıplak view kabul
  (okey dışı zarf şimdilik yok sayılıyor). Okey dışı oyun istenip dönen RoomInfo'da o `game` yoksa `room:leave` + `t('serverUpdating')`.
  Dış arayüz değişmedi, bu yüzden bu dal bugün dışarıdan tetiklenemiyor (iç `enter`'in `game` parametresi var; faz B bağlayacak).
- App.tsx değişmedi (gerek olmadı). i18n `serverUpdating`: tr + en + 11 dilde İngilizce (A5 bölümünün sonunda).

## Testler
- `server/test/room-generic.test.ts` (13): game > mode, varsayılan okey101, "Yakında" reddi, 2 kişilik stub ile koltuk/totals/bot,
  matchOver sıfırlama, genel saat (ilk tur çarpanı, timeout'ta quickMove), tur başına tek refill, 0 = saat yok, replay (okey tam el +
  ayrılma + oturma + ikinci el), aynı seed = aynı oyun, isimler deste rng'sini tüketmiyor, seed/günlük dışarı sızmıyor, stub replay.
- `server/test/server-generic.test.ts` (5): **v1 salon izleyicisi okey dışı masayı hiç görmez ve `game` alanı almaz** (A3 incelemesindeki
  boşluk; stub tanım `server.rooms`'a doğrudan konuyor), v2 filtresiz = okey, `{games:['pisti']}` = stub; v1'e ERR_UPDATE_APP (join +
  quickPlay); v2 hata metinleri; v2 stub masada RoomInfo.game + zarf + isAction önce; v1 bozuk okey aksiyonu reddi.
- `server/test/stub-game.ts`: yalnız testlerde kullanılan 2/4 kişilik toplama oyunu (id 'pisti').
- compat-v2: 5 `it.fails` → `it` (gövdeler aynı, başlık yorumu güncellendi).
- Uzun testler seed'li (Room `seed`/`seededRng`).

## Kök çıktılar (corepack pnpm + PATH shim)
`pnpm test` (çıkış 0):
```
 RUN  v5.0.5 C:/Users/mfaru/okey101/kahve-a4/packages/game-core
      Tests  41 passed (41)
 RUN  v5.0.5 C:/Users/mfaru/okey101/kahve-a4/shared
      Tests  70 passed (70)
 RUN  v5.0.5 C:/Users/mfaru/okey101/kahve-a4/packages/catalog
      Tests  50 passed (50)
 RUN  v5.0.5 C:/Users/mfaru/okey101/kahve-a4/server
      Tests  53 passed (53)
```
Toplam 214 (feat/kahve 187: core 35→41, catalog 47→50, server 30+5 beklenen hata → 53 yeşil).

`pnpm typecheck` (çıkış 0): shared, packages/catalog, server, app: Done.

Not: ilk kök çalıştırmada server işçisi bir kez Windows yerel çökmesiyle düştü (exit 3221226505 = 0xC0000409, compat-v1 sırasında,
test hatası değil). Sonraki 4 server ve 2 kök çalıştırma temiz. Makine yükü kaynaklı olduğunu düşünüyorum; tekrar ederse izlenmeli.

## Expo export
`npx expo export --platform android --output-dir <scratchpad>/expo-export` (app klasöründen): başarılı, metro ayarı gerekmedi
(`@kahve/catalog`/`@kahve/core` workspace bağlarıyla çözüldü). 1444 modül, 25,7 s; Hermes paketi
`index-….hbc` **5,4 MB**, 7 ses varlığı.

## Açık noktalar
- `server/package.json` `@kahve/core`'u bağımlılık olarak listelemiyor (yalnız `@kahve/catalog` + `@okey/shared`), ama sunucu artık
  `nextTurnClock`, `seededRng`, `newSeed`, `isGameId`'yi çalışma zamanında ondan alıyor. `.npmrc node-linker=hoisted` sayesinde
  çalışıyor; package.json bana kapalı olduğu için eklemedim. Öneri: `"@kahve/core": "workspace:*"` eklensin.
- renameSeat isteği: docs/kahve/requests/opus-renameSeat.md (okey dalı faz A için kabul edildi).
- Oda bot seviyesi 'medium' sabit (kabul edildi).
