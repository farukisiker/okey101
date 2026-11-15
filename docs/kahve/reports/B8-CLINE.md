# B8-CLINE raporu (ADIM 1)

Yazan: Cline (cline-pass/deepseek-v4.1-flash). Cline'ın çalışması son adımda (rapor + commit) yarıda kaldı (bozuk araç çağrısı);
doğrulama komutlarını ve bu raporu Fable çalıştırdı/yazdı, kodu değiştirmedi. Cline'ın bıraktığı boş çöp dosya (`console.log(...`) silindi.

## Dosyalar
- `tools/sim/run.ts`, `tools/sim/tsconfig.json`: catalog'daki her aktif oyun için seed'li bot-bot simülasyonu (isAction + apply.ok her adımda,
  adım sınırı, JSON gidiş-dönüş, örneklemeli değişmezlik kontrolü, seviye histogramı).
- `packages/catalog/test/leak-harness.ts`: oyundan bağımsız sızıntı test yardımcısı.
- `packages/catalog/test/leak-okey.test.ts`: 101 ve düz, 25'er seed. Gizli kümeyi (deste + rakip elleri + seed) permüte edip her koltuğun
  view'ının bayt-eşit kaldığını, yasak anahtar olmadığını, el sonu dışında açık el olmadığını, deckCount/handCount'un doğru olduğunu doğrular.

## Doğrulama (gerçek çıktılar)
`corepack pnpm exec tsc -p tools/sim/tsconfig.json --noEmit` → çıkış 0, çıktı yok.

`corepack pnpm --filter @kahve/catalog test`:
```
 Test Files  9 passed (9)
      Tests  63 passed (63)
```
`corepack pnpm exec tsx tools/sim/run.ts --seeds 1000 --quiet`:
```
B8 sim | oyun=2 (okey101,okeyDuz) seed/oyun=1000/1000 seedStart=1 rounds/seed=1 stepCap=2000 seviyeler=easy,medium,hard sampleImmutable=100
OZET
oyun      seed   el     adim     ms       gecersiz  bitmeyen  jsonHata  seviye(e/m/h)
okey101   1000   1000   91102    91794    0         0         0         30376/30388/30338
  okey101: koltuk=4 saatTazeleme=16687
okeyDuz   1000   1000   77440    258917   0         0         0         25792/25848/25800
  okeyDuz: koltuk=4 saatTazeleme=0
TOPLAM: 2 oyun, 2000 seed, 2000 el, 168542 adim, 0 gecersiz hamle, 0 bitmeyen el, 0 json/sozlesme hatasi, 350711 ms
TOPLAM seviye(e/m/h)=56168/56236/56138 saatTazeleme=16687
```
## Bilinen
- tools/sim kök `pnpm typecheck`'e dahil değil (elle çalıştırılıyor); kök script'e eklemek Fable'ın işi.
- Kapsam yüzdesi ölçülmedi (coverage paketi yok, bilerek eklenmedi).
- ADIM 2: Pişti/Batak catalog'a girince sim kod değişmeden kapsar; leak-pisti/leak-batak testleri eklenecek.

---

# B8-CLINE raporu (ADIM 2 — Pişti)

Yazan: Cline (branch `feat/kahve-cline`). Kapsam: yalnız **yeni** `packages/catalog/test/leak-pisti.test.ts` + bu rapor bölümü.
Mevcut hiç bir dosya, `package.json` veya lockfile değişmedi (`git status --short` commit öncesi yalnız iki dosyayı gösteriyor).

## Dosya
`packages/catalog/test/leak-pisti.test.ts` — `leak-harness.ts`'deki `registerLeakSuite` + `LeakProbe` kalıbıyla **6 süit**:
2 koltuk, 4 koltuk (solo), 4 koltuk (partner) × `hiddenCards` `reveal`/`secret`. Süit adları
`pisti-2p/reveal`, `pisti-2p/secret`, `pisti-4p/reveal`, `pisti-4p/secret`, `pisti-4p/partner/reveal`, `pisti-4p/partner/secret`.
Her süit varsayılan **25 seed** (seeds 1..25, dağıtım `round = seed % seats`; `KAHVE_LEAK_SEEDS` ile artırılabilir → harness). Her seed'de gerçek bot
oyunu: her adımda `botMove(..., 'medium', rng)` + `isAction` + `apply(...).ok` doğrulanır; el `roundOver`/`result` ile kapanır, sonra el sonu kapısı çalışır.
Yani 6 × 25 = **150 el**, el başına 48 hamle, her 5 adımda bir tüm koltuklar örneklenir (+ seed başına mutasyon testi).

## Bulgu: `@kahve/cards` kartlarında `kind` alanı yok
`leak-harness.ts`'in yapısal id tarayıcısı `collectViewIds()` okey taşlarını (`kind: 'normal' | 'fake'`) hedefliyor; pişti kartı `{ id, suit, rank }`
olduğu için harness'ın kendi id kapısı bir pişti view'ında **boş küme** bulur (test geçer ama göstermelik geçerdi). Bu yüzden probe, `checkView`
içinde kendi kart-id tarayıcısını (`collectCardIds`) çalıştırıp iki kapıyı uygular:
- view'da görünen kart id'lerinin **hiçbiri gizli kümede** olmamalı,
- view'da görünen **her** kart id'si gerçekten açık olmalı.

Gizli küme = `deck` (deste: hem kartlar hem sıra) ∪ diğer koltukların elleri ∪ `hiddenOpeningCardIds` (kapalı üç açılış kartı). Motor kaptırmada bu
listeyi boşalttığı için **tek tanım iki modu** kapsar (`reveal`da kaptırma anında açılırlar, `secret`ta hiç açılmazlar).
Açık küme = kendi eli ∪ `publicHistory` (oynanan kartlar + `reveal`da açılan açılış kartları) ∪ `openingCard` ∪ deste üstü (`topCard`) ∪ `lastCapture.cardId`.
Ek olarak üç kapalı açılış kartının **hem id'si hem nesnesi** (JSON) view'da geçmemeli; `secret` modunda el sonunda bile `publicHistory[].revealedCards` boş
kalmalı (motorun `reveal`/`secret` ayrımı). `forbiddenKeys`: `seed, rng, random, shuffle, deck, cards, state, hiddenOpeningCardIds, captured, pistis,
lastCapturer, centerPile`. `deckCount`/`centerCount`/`capturedCount` sayı olarak kalır (kural gereği açık; sıra/dizilim view'da hiç yok).

## Permütasyon testi (harness `checkMutation`)
Her seed'de 12 adım oynanır, sonra kopyada **yalnız gizli bilgi** değiştirilir ve her koltuğun view'ı **bayt-eşit** kalmalı. `hideMore`:
deste ters çevrilir (sıra), rakiplerin elleri ters çevrilir, eşit uzunlukta iki rakip eli bütün olarak takas edilir, üç kapalı açılış kartı kendi aralarında
permüte edilir **ve** biri desteyle kimlik takası yapar (`hiddenOpeningCardIds` yenilenir); sonra state'e `BIG_SEED = 987654321` yazılır (`PistiState`'te `seed`
alanı yok, tip birleşimiyle eklenir) ve bu değer view'da geçmemeli. `centerPile.at(-1)` (açık üst kart) bilerek dokunulmaz.
Pozitif kontrol: `view.hand` her örnekte state eliyle birebir aynı (kendi el id'leri view'da). Harness'ın kendi `scrambleOwnHand` kontrolü 2 kişide 12. adımda
çalışır (el 2/2), 4 kişide el 1'er kart kaldığı için atlanır — bu yüzden kendi-el kontrolü `checkView` içinde her örnekte ayrıca yapılır.

## Doğrulama (gerçek çıktılar)
- `corepack pnpm --filter @kahve/catalog exec tsc --noEmit` → **çıkış 0**, çıktı yok.
- Göstermelik-geçme (vacuous) kontrolü: geçici bir `tsx` probe'u (silindi, repoda iz bırakmadı) ile ölçüm — 2p/reveal seed=7, adım 0: view'da 10 kart id,
  gizli küme 47 id, kapalı açılış kartı 3/3, sızıntı **0**; adım 10/12: view'da 22 kart id, gizli 34–35, sızıntı **0**; mutasyon view'ı bayt-eşit, kapalı kart
  nesnesi view'da yok. Yani kapılar boş küme üzerinde çalışmıyor.
- `corepack pnpm --filter @kahve/catalog test` (son satırlar):
```
 Test Files  10 passed (10)
      Tests  69 passed (69)
   Start at  02:51:21
   Duration  14.92s (tests 98%, import 1%, transform 1%)
```
  (ADIM 1'de 9 dosya / 63 testti → **+1 dosya, +6 test**.)
- Tek dosya koşusu `corepack pnpm --filter @kahve/catalog exec vitest run test/leak-pisti.test.ts`:
```
 Test Files  1 passed (1)
      Tests  6 passed (6)
   Duration  5.23s (tests 96%, transform 3%, import 1%)
```

## Bilinen / notlar
- `leak-batak` ADIM 2'nin diğer yarısı; bu commit yalnız pişti.
- `pisti` catalog `DEFINITIONS`'a henüz kayıtlı değil (`src/index.ts`: `meta('pisti','kagit',[2,4])`, `status: 'soon'`), bu yüzden `tools/sim` pişti'yi
  kapsamıyor — kayıt işi sahibinin. Bu test `pistiDef`'i doğrudan `@kahve/pisti`'den import eder (catalog zaten bağımlı).
- `packages/*/src/**`, mevcut testler, `shared/**`, `server/**`, `app/**`, `package.json`, lockfile: dokunulmadı. Push/merge yok.

