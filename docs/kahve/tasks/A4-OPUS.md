GÖREV: A4-OPUS  FAZ: A
AMAÇ: Sunucu odası ve çevrimdışı oyunu `GameDefinition` üzerinden çalıştırmak; protokol v2'yi (v1 uyumlu) sunucuya ve istemciye bağlamak. Okey oynanışı birebir aynı kalır.
OKU: PROMPT_LOCAL.md §2.2–2.4, docs/kahve/MASTER_PLAN.md §2–3, packages/game-core/src/types.ts, shared/src/protocol.ts (v2 ekleri),
     packages/catalog/src/{index,okey}.ts, server/src/{room,server,bot}.ts, server/test/*.test.ts (compat-v1/v2 dahil),
     app/src/net/{useOkey,useLocalGame}.ts, app/src/App.tsx, docs/kahve/reports/A2-OPUS.md
SÖZLEŞME: types.ts ve protocol.ts @ feat/kahve HEAD (DEĞİŞTİRME; eksik varsa docs/kahve/requests/opus-<konu>.md ve dur)
WORKTREE: C:/Users/mfaru/okey101/kahve-a4 (dal feat/kahve-a4, feat/kahve'den)
SAHİP OLDUĞUN YOLLAR: server/src/**, app/src/net/**, app/src/App.tsx (sadece istemci kancası bağlama), server/test/compat-v2.test.ts (it.fails → it çevirme),
     yeni testler server/test/room-generic.test.ts vb.; i18n'e tek anahtar `serverUpdating` (tr + en + 11 dilde İngilizce yer tutucu, A5 düzeniyle)
DOKUNMA: shared/src/** (protocol.ts dahil), packages/**, mevcut test dosyaları (room/server/bot/compat-v1 testleri DEĞİŞMEDEN geçmeli), app ekranları, package.json, lockfile

SUNUCU:
- `Room` → `GameDefinition` ile (catalog `getDefinition`). `SEATS` yerine `def.seats(opts)`. Saat genel: `def.turn` + `def.clock` + `def.refillsClock`
  (okeyde bugünkü `nextClock` ile aynı süreler). Bot `def.botMove`, süresi dolan insan `def.quickMove`, puan `def.scoreRound`, maç `def.matchOver`.
- Mevcut testlerin kullandığı genel API korunur: `new Room(id, onChange, {mode, rng, botDelayMs, turnTimeoutMs, isPublic, password})`,
  `room.game` (okey odasında okey GameState), `mode`, `join/start/act/info/viewFor/summary/nextRound/leave/disconnect/seatOf/startIfFull/totals/hostSeat`.
  Yeni seçenek `game?: GameId` (`mode`'dan önceliklidir; yoksa `gameOfMode(mode)`).
- Bot isimleri ayrı rng ile (oyun rng'si sadece oyuna). Masa başına `seed` + aksiyon günlüğü tutulur (dışarı gönderilmez); `replay(seed, log)` ile aynı durum üretildiğini gösteren test.
- server.ts: soket başına `clientProtocol(socket.handshake.auth)`. v1: bugünkü davranış birebir (çıplak PlayerView, `mode`, filtresiz salon = okey).
  v1 + okey dışı `game` → `ERR_UPDATE_APP`. v2: `GameViewEnvelope`, `salon:watch(on, {games})`, `RoomInfo.game`/`TableSummary.game` dolu.
  "soon" oyun veya bilinmeyen `game` → anlaşılır hata (Türkçe, kısa). `game:action` önce `def.isAction`, sonra `apply`.
- compat-v2'deki 5 `it.fails` → `it` (yeşil). compat-v1 değişmeden yeşil.

İSTEMCİ:
- useOkey: `io(url, { auth: { v: PROTOCOL_VERSION } })`, `room:create/quickPlay`'e `game` ekle (mode da gönderilmeye devam: eski sunucu onu okur),
  `game:view` zarfını aç (çıplak PlayerView gelirse de kabul et: eski sunucu). Okey dışı oyun istenip dönen RoomInfo'da `game` yoksa → `room:leave` + `serverUpdating` hatası.
  OkeyClient'ın dış arayüzü (GameScreen/Lobby'nin kullandığı) DEĞİŞMEZ.
- useLocalGame: okeyi `okey101Def`/`okeyDuzDef` üzerinden oynatır (create/apply/turn/botMove/quickMove/viewFor + aynı saat). Dış arayüz değişmez.
- Uygulama artık `@kahve/catalog`'u çalışma zamanında import ediyor: bir kez `npx expo export --platform android --output-dir <scratchpad>/expo-export`
  (app klasöründen) çalıştırıp paketlemenin başarılı olduğunu ve paket boyutunu rapora yaz. Metro ayarı gerekiyorsa DUR ve bildir (yeni dosya `metro.config.js` Fable onayı ister).

KABUL: kökte `pnpm test` ve `pnpm typecheck` yeşil; test sayısı ≥ (o anki feat/kahve sayısı) + yeniler; mevcut test dosyalarında diff yok
(`git diff feat/kahve -- server/test/room.test.ts server/test/server.test.ts server/test/bot.test.ts server/test/compat-v1.test.ts` boş).
SÜREÇ: Önce plan (≤20 satır) → Fable onayı → kod. Küçük commit'ler feat/kahve-a4'te, push YOK. Rapor: docs/kahve/reports/A4-OPUS.md (expo export sonucu dahil).
