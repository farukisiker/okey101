# A2-OPUS raporu: okey adaptörü + @kahve/catalog

DURUM: TAMAM (2026-11-15). Dal feat/kahve-a2, push yok. types.ts, shared/**, server/**, package.json, tsconfig dokunulmadı.

## Dosyalar
- `packages/catalog/src/okey.ts`: `makeOkeyDef(mode)`, `okey101Def`, `okeyDuzDef`, `OkeyOptions`, `DEFAULT_OKEY_OPTIONS`, `normalizeOkeyOptions` (reshuffles tam sayı 0..10, aksi halde DEFAULT_RESHUFFLES; bilinmeyen anahtarlar atılır), `isOkeyAction`, `MAX_RESHUFFLES`.
- `packages/catalog/src/index.ts`: `CATALOG` (8 oyun, GAME_IDS sırasıyla), `getDefinition`, `gamesInGroup`, okey ihracı.
- `packages/catalog/test/equivalence.ts`: ortak yardımcı `playBoth` + `equivalenceSuite(mode, defaultSeeds)`.
- `packages/catalog/test/okey101-equivalence.test.ts` (200 seed), `okeyduz-equivalence.test.ts` (varsayılan 20 seed, aşağıya bakın).
- `packages/catalog/test/okey-json.test.ts`, `is-action.test.ts`, `bot-level.test.ts`, `catalog.test.ts`.

## Commit'ler
- `330e412` Kahve A2: approved plan
- `0065d63` Kahve A2: okey GameDefinition adapter and CATALOG registry
- `92b2e31` Kahve A2: catalog tests (adapter equivalence, JSON round-trip, isAction, registry)
- (bu rapor + düz seed ayarı son commit'te)

## Eşdeğerlik testi
- Her seed için iki yol, her yolun kendi aynı tohumlu iki rng'si var: `seededRng(seed)` dağıtım için, `seededRng(seed ^ 0x9e3779b9)` bot hamleleri için (botStep rng tükettiği için).
- (a) `createGame` + `botStep(viewFor)` + `applyAction`; (b) `def.create` + `def.botMove` + `def.apply`. Her adımda: `turn` eşleşmesi, aksiyonlar eşit, `isAction(aksiyon) === true`, durum JSON'u eşit. El sonunda `roundOver`, `turn === null`, `scoreRound === result.scores`.
- Başlangıç koltuğu da gezilir (`round = seed % 4`). Adım sınırı 3000; aşılırsa test düşer. Her modda kazananı olan el sayısı > seed/10 olmalı (yalnız deste bitişiyle geçmesin diye). Yerel ölçümde bot ellerinin neredeyse hepsi kazananla bitiyor.
- **Seed sayısı:** düz botu 101'den yaklaşık 10 kat yavaş (düz el başına ~0,75 s iki yol, 101 ~0,08 s). 200 düz seed tek başına ~150 s sürdüğü için varsayılan çalıştırmada düz **20 seed**, 101 **200 seed**. Tam tarama `KAHVE_EQ_SEEDS=200` ile her iki modda da çalışır; bir kez çalıştırıldı ve geçti:
  ```
   ✓ test/okey101-equivalence.test.ts > okey 101 adapter equals direct shared calls > 200 seeded bot hands match step by step 14470ms
   ✓ test/okeyduz-equivalence.test.ts > okey duz adapter equals direct shared calls > 200 seeded bot hands match step by step 149620ms
   Test Files  2 passed (2)
        Tests  2 passed (2)
  ```

## Diğer testler
- JSON gidiş-dönüş: 30 hamle sonra `JSON.parse(JSON.stringify(state))`; orijinal ve kopya aynı tohumlu yeni bot rng'leriyle sona kadar oynanır, son durum ve skor aynı (101: 20 seed, düz: 5 seed). View de saf JSON.
- isAction: 8 geçerli örnek true; null, undefined, sayı, string, dizi, `{}`, bilinmeyen tip, eksik alan, boş diziler, string id'ler, 1.5, NaN, null tileId false; fırlatan Proxy/getter false döner.
- Saat: `def.clock.baseMs === TURN_MS` ve `firstTurnFactor === 2` testi var; yorumu shared `turnBudgetMs`'e işaret ediyor.
- Ayrıca: easy == medium bot, normalizeOptions, seats/create/startingSeat, refillsClock, matchOver (101 asla, düz ≥ 20), quickMove legal, viewFor saati geçiriyor (`turnMsLeft`), view'da seed yok, CATALOG grupları, seatChoices, titleKey, getDefinition (soon → null).

## Kök çıktılar (corepack pnpm + PATH shim)
`pnpm test` (toplam süre 27,4 s):
```
 RUN  v5.0.5 C:/Users/mfaru/okey101/kahve-a2/shared
 Test Files  5 passed (5)
      Tests  70 passed (70)
 RUN  v5.0.5 C:/Users/mfaru/okey101/kahve-a2/packages/catalog
 Test Files  6 passed (6)
      Tests  47 passed (47)
   Duration  15.88s (tests 98%, import 1%, transform 1%)
 RUN  v5.0.5 C:/Users/mfaru/okey101/kahve-a2/server
 Test Files  3 passed (3)
      Tests  23 passed (23)
```
Test sayısı: 93 → 140 (shared 70, server 23 aynı; catalog +47). game-core: test dosyası yok (A1'in işi).

`pnpm typecheck` (9,3 s, çıkış 0):
```
packages/catalog typecheck: Done
server typecheck: Done
app typecheck: Done
```

## Notlar / Fable'ın kararı gerekenler
- Catalog paketinin süresi makine yüküne göre değişiyor: boşta 13–16 s, başka oturumlar CPU kullanırken 26 s'ye kadar ölçüldü (o çalıştırmada düz 30 seed'deydi; şimdi 20).
- `tsconfig`'de node tipleri yok (`types: []`); env okumak için `globalThis.process` kullanıldı, tsconfig'e dokunulmadı.
- Plan §6 (iii): sunucu Room'u bot isimleri için de aynı rng'yi kullanıyor. A4'e not olarak kaldı.
