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

---

# B8-CLINE raporu (ADIM 2 — Batak)

Yazan: Cline (branch `feat/kahve-cline`, `feat/kahve` ile senkron: `@kahve/batak` artık burada).
Kapsam: yalnız **yeni** `packages/catalog/test/leak-batak.test.ts` + bu rapor bölümü.
Mevcut hiç bir dosya, `package.json` veya lockfile değişmedi (`git status --short` commit öncesi yalnız bu iki dosyayı gösterir).

## Dosya
`packages/catalog/test/leak-batak.test.ts` — `leak-harness.ts`'deki `registerLeakSuite` + `LeakProbe` kalıbıyla **tek süit**
(`batakDef` doğrudan `@kahve/batak`'tan import edilir; `@kahve/catalog` zaten ona bağımlı) **artı bir faz-kapsam testi**
= **2 test**. Varsayılan **25 seed** (1..25, `KAHVE_LEAK_SEEDS` ile artırılabilir), `sampleEvery: 1`, `stepCap` 3000.
Her seed'de gerçek bot oyunu: her adımda `batakDef.botMove(..., 'medium', rng)` + `isAction` + `apply(...).ok` doğrulanır,
el `phase === 'finished'` olana kadar oynanır. Dağıtım `round = seed % SEATS` olduğu için hem deste hem ilk konuşan koltuk
seed'e göre döner (harness koltuk rotasyonunu ayrıca `(seed + i) % seats` ile yapar).

## Faz örneklemesi (neden `sampleEvery: 1`)
Batak turu üç fazlı: `bidding` (birkaç adım) → `selectingTrump` (**tek** adım) → `playing` (52 adım). Harness her
`sampleEvery`. adımda bütün koltukları örnekliyor; 5'te bir örnekleme yapılırsa tek adımlık **koz seçimi fazı hiç
yakalanmaz**. Bu yüzden `sampleEvery: 1`. Örneklenen kümenin gerçekten üç fazı kapsadığı ikinci testle kanıtlanır
(`viewFor leaks: batak phase coverage`): `checkView` bir faz sayacını doldurur, test `bidding > 0`, `selectingTrump > 0`,
`playing > 0`, `finished === 0` bekler (el sonu `checkView`'a hiç gelmez; onu `checkRevealed` kapsar). Vitest bir dosyanın
testlerini bildirim sırasında koştuğu için sayaç dolu olur; örnekleme bir fazı kaçırırsa test sessizce eksik kapsamak
yerine **patlar**.

## Gizli bilgi tanımı (okey/pişti'den farklı)
4 × 13 = **52 kartın tamamı dağıtılır, stok kalmaz**. Yani "deste sırası sızıntısı" diye bir şey yok; tek gizli bilgi
**diğer üç koltuğun eli** ve dağıtımın onları hangi sırayla verdiğidir. Buna göre:
- `hiddenIds` = diğer koltukların el kartları; `publicIds` = kendi eli ∪ oynanmış tüm kartlar (`tricks[].cards` +
  `currentTrick`; hepsi açık oynanır).
- `forbiddenKeys` = `seed, rng, random, shuffle, deck, remaining, hands, bids, state`. View `players[].bid` taşır,
  `bids` dizisini değil; `tricks`/`currentTrick` açıktır. `cards` bilinçli olarak listede **yok**: `CompletedTrick.cards`
  view'ın meşru, açık alanıdır (ham string araması yapılmaz, bkz. plan R8).
- Harness'ın `deckCount` kapısı: `BatakView`'da `deckCount` alanı **yok** → probe `undefined` döner, kapı `undefined`
  ↔ `undefined` karşılaştırması olur (kodda yorumlu).

## Bulgu (pişti ile aynı): `@kahve/cards` kartlarında `kind` alanı yok
`leak-harness.ts`'in yapısal id tarayıcısı okey taşlarını (`kind: 'normal' | 'fake'`) hedefliyor; batak kartı
`{ id, suit, rank }` olduğu için harness'ın kendi id kapısı batak view'ında **boş küme** bulur (test geçer ama göstermelik
geçerdi). Probe `checkView` içinde kendi tarayıcısını (`collectCardIds`: kart şekilli nesneler + `legalCardIds` + oynanan
`lastAction.cardId`) çalıştırıp iki kapı uygular:
- view'da görünen id'lerin **hiçbiri gizli kümede** olmamalı,
- view'da görünen **her** id gerçekten açık olmalı.
Ek olarak her gizli kartın **nesnesi** (`JSON.stringify(card)`, id+suit+rank) view serileştirmesinde geçmemeli.

## Permütasyon testi (harness `checkMutation`) + kendi-el kontrolü
Her seed'de 12 adım oynanır, sonra kopyada **yalnız gizli bilgi** değiştirilir ve her koltuğun view'ı **bayt-eşit**
kalmalı. `hideMore`: diğer üç el ters çevrilir (dağıtımın el içi sırası), sonra eller kendi aralarında bir kart
kaydırılarak karıştırılır — **her elin boyu korunur**, çünkü view yalnız `handCount` gösterir ve löve ortasında el boyları
12/12/13 gibi farklı olabildiği için "bütün eli takas etmek" `handCount`'u değiştirip yanlış alarm verirdi. Sonra state'e
`BIG_SEED = 987654321` yazılır (`BatakState`'te `seed` alanı yok, tip birleşimiyle eklenir; `viewFor` alanları tek tek
kopyaladığı için sızmaması gerekir) ve bu değer view'da geçmemeli. Kendi el, açık löve ve ihale dokunulmaz.
Pozitif kontroller: kendi el id'leri sıralı view'la birebir (`sortHand(..., 'desc')`), `legalCardIds` =
`legalCardsFor(state, seat)` **ve kendi elinin alt kümesi**, oynanmış her kart (açık löve + bütün bitmiş löveler) view'da
görünür, ve harness'ın `scrambleOwnHand` kontrolü. Not: `viewFor` eli sıraladığı için (S,H,D,C; rank azalan) eli ters
çevirmek view'ı **değiştirmez**; bu yüzden `scrambleOwnHand` bir kartı başka bir elin kartıyla takas eder (kendi eli
değişir → view değişmek zorunda). `checkView` ayrıca bütün açık alanları state'le birebir karşılaştırır: `options`,
`variant`, `round`, `targetRounds`, `dealer`, `seat`, `turn` (`finished` ise `null`), `turnNumber`, `phase`, `players`
(handCount/tricksWon/bid/passed/isDeclarer), `minBid`, `highestBid`, `highestBidder`, `canPass`, `declarer`, `contract`,
`forcedBid`, `trump`, `trumpBroken`, `currentTrick`, `tricks`, `lastTrick`, `lastTrickWinner`, `lastAction`, `result`.

## El sonu (`checkRevealed`)
13 löve, boş eller, boş `currentTrick`, `tricksWon` toplamı 13, `result` dolu; her koltukta `phase='finished'`, `turn=null`,
`hand=[]`, `legalCardIds=[]`, bütün `handCount` 0; ve **dağıtılan 52 kartın tamamı** view'da (bitmiş view'da 52 ayrı kart
id'si) — el sonunda gizli kalan kart yok.

## Doğrulama (gerçek çıktılar)
- `corepack pnpm --filter @kahve/catalog exec tsc --noEmit` → **çıkış 0**, çıktı yok.
- Göstermelik-geçme (vacuous) kontrolü: geçici bir `tsx` ölçümü (silindi, repoda iz bırakmadı) 3 seed üzerinde
  **171 örneklenen view**: ortalama **35,49 görünen kart id'si**, ortalama **21,6 gizli kart id'si**, **sızıntı 0**,
  **açık olmayan id 0**, 3/3 mutasyon view'ı bayt-eşit; faz dağılımı `bidding=12, selectingTrump=3, playing=156`.
  Yani kapılar boş küme üzerinde çalışmıyor.
- `corepack pnpm --filter @kahve/catalog test` (son satırlar):
```
 Test Files  12 passed (12)
      Tests  74 passed (74)
   Start at  03:05:30
   Duration  18.17s (tests 98%, transform 1%, import 1%)
```
  (aynı komutun bir önceki koşusu: 16.38 s, 12/74 — dosya sayısı ve test sayısı sabit.)
- Tek dosya koşusu `corepack pnpm --filter @kahve/catalog exec vitest run test/leak-batak.test.ts`:
```
 Test Files  1 passed (1)
      Tests  2 passed (2)
   Duration  6.94s (tests 97%, transform 2%, import 1%)
```
  → paketin bu dosya hariç hâli 11 dosya / 72 test (74 − 2). ADIM 2 pişti koşusu 10 dosya / 69 testti; aradaki fark bu
  worktree'ye `feat/kahve` birleşmesiyle gelen `pisti-catalog.test.ts` ve bu dosyadır.

## Bilinen / notlar
- `batak` catalog'da `status: 'active'`, `seatChoices: [4]`; `tools/sim` bu paketi `batakDef` üzerinden kapsar, sim kodunda
  değişiklik gerekmedi.
- `sampleEvery: 1` testi yavaşlatır (tek dosya ~7 s); 25 seed'lik kapsam korunurken paket toplamı **16–18 s** (plan hedefi
  ~20 s altı).
- İkinci test, aynı dosyadaki harness süitinden sonra koşmaya dayanır (sayaç paylaşımı); vitest bir dosya içinde testleri
  sırayla koşar, bu yüzden güvenli — ama dosya paralel/izole bir düzene geçerse gözden geçirilmeli.
- Bulunan gerçek hata yok: sızıntı, yasak anahtar, gizli kart nesnesi veya determinizm ihlali çıkmadı; `packages/batak/src/**`
  sahibinin dosyalarına dokunulmadı.
- Bu commit yalnız `packages/catalog/test/leak-batak.test.ts` + bu rapor bölümü. `packages/*/src/**`, mevcut testler,
  `shared/**`, `server/**`, `app/**`, `package.json`, lockfile: dokunulmadı. Push/merge yok.
  Commit mesajı: `B8 step 2: viewFor leak tests for batak (Cline)`.


## 1000 seed: Pişti ve Batak (Fable koşturdu, feat/kahve @ ca6e4fc)
`corepack pnpm exec tsx tools/sim/run.ts --seeds 1000 --games pisti,batak --quiet`
```
B8 sim | oyun=2 (pisti,batak) seed/oyun=1000/1000 seedStart=1 rounds/seed=1 stepCap=2000 seviyeler=easy,medium,hard sampleImmutable=100
OZET
oyun      seed   el     adim     ms       gecersiz  bitmeyen  jsonHata  seviye(e/m/h)
pisti     2000   2000   96000    64202    0         0         0         32000/32000/32000
  pisti: koltuk=2/4 saatTazeleme=0
batak     1000   1000   57403    50197    0         0         0         19112/19139/19152
  batak: koltuk=4 saatTazeleme=0
TOPLAM: 2 oyun, 3000 seed, 3000 el, 153403 adim, 0 gecersiz hamle, 0 bitmeyen el, 0 json/sozlesme hatasi, 114399 ms
TOPLAM seviye(e/m/h)=51112/51139/51152 saatTazeleme=0
```
