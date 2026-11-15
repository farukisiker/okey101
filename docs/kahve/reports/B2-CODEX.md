# B2-CODEX — @kahve/pisti

Yazar: Sol. Durum: B2.1–B2.4 tamamlandı; commit denenmedi. Astra incelemesine hazır.

Onaylı B2 planı (ilk satırdaki Fable notu dahil), B1 görevindeki B2 bölümü, PROMPT_LOCAL Pişti kuralları, KURALLAR_argon OYUN 3 §9 ve cards/core kaynakları okundu. Fable notuna uygun olarak publicHistory görünümde tutulur. Maç toplamları host sorumluluğundadır; eşli scoreRound=[A,B,A,B] değerleri matchOver içinde yeniden toplanmaz.

## Dosyalar ve uygulama sırası

- B2.1: packages/pisti/src/types.ts, options.ts, setup.ts; test/setup.test.ts. Tipler, alan bazlı normalizasyon, 2/4 oyuncu, dağıtıcı/sıra dönüşü, dörder dağıtım ve ek RNG tüketmeyen ardışık Vale redraw. Ara kontrol: 4 test + typecheck geçti.
- B2.2: packages/pisti/src/rules.ts, scoring.ts; test/rules.test.ts. Değişmez hamle uygulama, retler, toplama/pişti, otomatik dağıtım, son alan, kart/bonus/çoğunluk puanları ve eşli/hedef sözleşmesi. Ara kontrol: 23 test + typecheck geçti.
- B2.3: packages/pisti/src/view.ts, bot.ts, definition.ts, index.ts; test/view.test.ts, bot.test.ts, definition.test.ts. Açık alan listesiyle kopyalanmış görünüm; reveal/secret geçmişi; görünümle çalışan üç bot seviyesi; deterministik quickMove; host saati ve renameSeat. Ara kontrol: 32 test + typecheck geçti.
- B2.4: packages/pisti/test/simulation.test.ts, contract.test.ts ve bu rapor. 200 seed, gizlilik, JSON devamı, ayarlanmış puanlar, son görünüm ve sözleşme kabulü.

Yalnız packages/pisti/src/**, packages/pisti/test/** ve bu rapor değiştirildi. Manifest, lockfile, diğer paketler değiştirilmedi; paket kurulmadı.

## Son paket komutları — çıktı sonları aynen

`corepack pnpm --filter @kahve/pisti test` — çıkış 0:

```text
 Test Files  7 passed (7)
      Tests  37 passed (37)
   Start at  01:47:52
   Duration  13.51s (tests 90%, transform 7%, import 3%)
```

`corepack pnpm --filter @kahve/pisti typecheck` — çıkış 0:

```text
$ tsc --noEmit
```

## 200 seed kabulü

Seed 0–199; her oyun 48 hamlede tamamlandı. Her hamlede 52 kart ve 52 benzersiz kimlik; bot ve quickMove geçerli; kaynak state değişmedi; her hamlede JSON gidiş-dönüş yapan ikinci oyun aynı hamleleri, state ve sonucu verdi. reveal/secret, allow/redraw ve dağıtıcı dönüşleri de dağılıma dahil edildi.

```text
200 seed: 200 tamamlandı; 0 geçersiz hamle; her adımda 52 benzersiz kart; 3 mod x 3 seviye: [[23,22,22],[23,22,22],[22,22,22]]
```

Satırlar: 2 tekli / 4 tekli / 4 eşli. Sütunlar: easy / medium / hard. Sırasıyla 67 / 67 / 66 oyun. Simülasyon testinin yerel zaman sınırı 60000 ms; ilk 5000 ms sınırı tüm oyunlar tamamlandığı halde zaman aşımı verdiği için genişletildi.

## Kök doğrulama ve ortam sınırı

`corepack pnpm test` — çıkış 1, son satırlar:

```text
'pnpm' is not recognized as an internal or external command,
operable program or batch file.
[ELIFECYCLE] Test failed. See above for more details.
```

`corepack pnpm typecheck` — çıkış 1, son satırlar:

```text
'pnpm' is not recognized as an internal or external command,
operable program or batch file.
[ELIFECYCLE] Command failed with exit code 1.
```

Kök betikler alt süreçte doğrudan pnpm çağırıyor; bu ortamda pnpm PATH içinde yok. Dosya/kurulum değiştirmeden aynı betik gövdeleri corepack üzerinden çalıştırıldı:

`corepack pnpm -r --filter @okey/shared --filter @okey/server --filter './packages/*' --filter app test` — çıkış 0. Toplam 363 test geçti (core 41, cards 36, shared 104, pisti 37, catalog 61, server 65, app 19; batak boş iskelet). Son satırlar:

```text
server test:  Test Files  9 passed (9)
server test:       Tests  65 passed (65)
server test:    Start at  01:46:59
server test:    Duration  5.06s (tests 58%, import 38%, transform 4%, worker 1%)
server test: 
server test: Done
```

`corepack pnpm -r typecheck` — çıkış 0, son satırlar:

```text
packages/catalog typecheck: Done
server typecheck$ tsc --noEmit
app typecheck$ tsc --noEmit
server typecheck: Done
app typecheck: Done
```

## Kural–test eşlemesi

Sayısal kapsam ölçülmedi; onaylı plandaki alternatif test–kural eşlemesi kullanıldı. %85 ölçülmüş kapsam iddiası yoktur.

| Kural / kabul | Test dosyası |
| --- | --- |
| PIS-T01–02 dağıtım, 52 kimlik, sıra/dealer; ardışık redraw/allow; normalizasyon | setup.test.ts |
| PIS-T03–07 ilk toplama, normal pişti, J/diğer ve J/J; T09–11 bonus ve kart puanı ayrı | rules.test.ts |
| PIS-T08 boş yere Vale | rules.test.ts |
| PIS-T12 otomatik dörder dağıtım, orta korunumu ve dağıtım sırası | rules.test.ts |
| PIS-T13–14 son alan, son tek kart pişti değil; hiç alan yoksa sıfır puan | rules.test.ts |
| PIS-T15–18 çoğunluk, eşitlik ve eşli birleşim | rules.test.ts, contract.test.ts |
| PIS-T19–20 sıra/el üyeliği retleri, bozuk action/seat; state değişmezliği | rules.test.ts |
| PIS-T21–22 hedefler, benzersiz lider, eşitlik uzatması; eşlide yalnız 0/1 temsilcileri | rules.test.ts |
| PIS-T23 görünüm alan listesi, rakip/ortak el ve deste gizliliği | view.test.ts |
| PIS-T24–25 Usta Vale piştisi ve boşta Vale saklama | bot.test.ts |
| reveal/secret, kalıcı geçmiş, lastCapture yalnız gerçek toplama ve yalnız bonus | view.test.ts, contract.test.ts |
| Gizli kart permütasyonunda aynı view ve aynı RNG ile aynı bot hamlesi | view.test.ts, contract.test.ts |
| Secret kart kimlikleri el sonunda bile açılmaz; yalnız sonuç puanı açıklanır | contract.test.ts |
| Özelleştirilmiş kart/pişti/çoğunluk puanları, takım ve koltuk sayaçları | contract.test.ts |
| Saat 30000/ilk tur 60000, key artışı, refills=false, noticeOf yok, renameSeat | definition.test.ts |
| quickMove pişti/eşleşme/Vale önceliği, deterministik risk/rank/id; bot sayımı ve Vale tasarrufu | bot.test.ts, simulation.test.ts |
| 200 seed, üç mod/seviye, sıfır geçersiz hamle, 52 kart, JSON aynı devam/sonuç | simulation.test.ts |

Botlar sezgiseldir; kazanma oranı veya optimum oyun garantisi ölçülmedi. UI/katalog/sunucu entegrasyonu onaylı kapsam dışıdır. Yeni el ve maç toplamları host tarafından yönetilir.


## Astra iadesi sonrası düzeltme — 2026-11-16

- Bot, mevcut açık ortayı boş tabandan toplama tahmin ederek yeniden kurmuyor. Gerçek `centerCount` sınırı kadar son oynanmış kartı kullanıyor; böylece açılışı toplayan ilk Vale mevcut orta değerine katılmıyor. Açılış henüz toplanmadıysa bilinen açık açılış kartı da değer hesabına dahil ediliyor; kapalı kartların değerleri tahmin edilmiyor.
- `PistiState` ve `PistiView` tiplerine geriye uyumlu, isteğe bağlı `openingCard?: Card` eklendi. Setup yalnız başlangıçta açık olan dördüncü kartın kopyasını saklıyor; view açık alan listesiyle kopyalıyor. Rules içindeki state kopyası bu bilgiyi örtülme, toplama ve el sonu boyunca koruyor. Eski state/view nesnelerinde alanın bulunması zorunlu değil; eski kayıtlarda unutulmuş kart geriye dönük çıkarılamaz.
- Botun bilinen kart sayımı `openingCard` alanını da içeriyor ve kart kimliklerini tekilleştiriyor. `secret` modundaki üç kapalı açılış kartı bu alana veya geçmişe eklenmiyor.
- Yedi regresyon/senaryo vakası eklendi: ilk Vale ile açılış toplandıktan sonra gerçek [♠2,♠3,♠4] ortası için medium/hard; örtülmüş açık açılış kartının bot sayımına etkisi ve alanı içermeyen view desteği (iki seviye); reveal/secret için örtülme ve toplama sonrasında açılış kartının kalıcılığı, kopya yalıtımı ve secret gizliliği; aynı As içeren ortada medium/hard farklı karar senaryosu. Son senaryoda medium Vale'yi saklarken hard 5–6 geride olduğu kart çoğunluğunu da değerlendirip topluyor. Vale regresyonunda medium için desteklenen `jackPoints=3`, hard için varsayılan puan kullanılıyor; eski hatalı orta hesabı her iki durumda da gereksiz Vale harcatırdı.
- Bu düzeltmede yalnız packages/pisti/src/**, packages/pisti/test/** ve bu rapor düzenlendi. Git commit denenmedi.

Son doğrulama komutları ve çıktı sonları:

`corepack pnpm --filter @kahve/pisti test` — çıkış 0:

```text
 Test Files  7 passed (7)
      Tests  44 passed (44)
   Start at  01:54:46
   Duration  13.95s (tests 94%, transform 3%, import 3%)
```

`corepack pnpm --filter @kahve/pisti typecheck` — çıkış 0:

```text
$ tsc --noEmit
```

## Claude review (Codex quota fallback)

Reviewer: Claude Opus (standing in for Astra, Codex quota exhausted). Date: 2026-11-16. Verdict: **APPROVE** (no blocking issues).

### Independent review of Sol's fixes

- **Finding 1 (opening-taking Jack stayed in the bot's center): closed.** `bot.ts` now takes the last `centerCount` plays from `publicHistory`. After any capture the pile holds only the plays since that capture, so the slice is exact; before the first capture `centerCount = 4 + plays`, so the slice returns every play and the face-up `openingCard` is added (the three hidden cards stay unknown, correctly). I checked this with a temporary invariant test (not kept): over 300 seeded rounds (2 solo / 4 solo / 4 partners, reveal/secret, allow/redraw, all bot levels), at every turn the bot's reconstructed pile equalled the non-hidden part of the real `centerPile`, with no mismatch.
- **Finding 2 (covered face-up opening card forgotten): closed.** `openingCard` is a copy of `centerPile[3]` taken after the redraw loop, so it is always the card that was face up. It is copied into every view and counted in `knownCards` (de-duplicated by id).
- **`openingCard` vs 'secret':** it never exposes the three face-down cards; only index 3 is stored. `view.test.ts` checks the serialized view for the hidden cards in secret mode. The redrawn Jacks under `openingJack: 'redraw'` are not stored anywhere in the view.
- **No regression found:** rules, scoring and view behave the same as in Astra's first pass apart from the additive optional field.

### Rules vs PROMPT_LOCAL (Pişti)

All match: a Jack takes everything but not an empty center (`!!top`); single-card same-rank capture = pişti 10, Jack on single Jack = 20, Jack on a single non-Jack = capture only; the opening 4-card capture is never a pişti (`centerPile.length === 1`); points A1, J1, ♣2=2, ♦10=3, most cards +3 and nothing on a tie; leftover center goes to the last capturer with no capture event or pişti; 4-card redeal when all hands are empty (2p: 6 deals, 4p: 3 deals), starting after the dealer; partner scores are `[A,B,A,B]` and `matchOver` reads only seats 0/1.

### Privacy and bots

`viewFor` builds the view from a whitelist: only your own hand, the top card, counts, the public history, revealed opening cards only in 'reveal' mode, and `openingCard`. No opponent or partner hand, no deck order, no `captured` ids. `pistiDef.botMove` and `quickMove` call `viewFor(s, seat)` first, so bots see only view data. The test that permutes hidden cards still gives identical views and bot moves.

### Changes made by Claude

- New `packages/pisti/src/clone.ts`: package-local JSON deep clone (`JSON.parse(JSON.stringify(v))`). `rules.ts` (`apply`) and `view.ts` (`viewFor`) now use it. All state and view data is plain JSON (no Date/Map/undefined-in-array), so the clone gives the same result. No `structuredClone` call remains in `packages/pisti/src` or `packages/pisti/test`. The tests use `clone` too, and the only mention left is `clone.test.ts`, which deletes the global on purpose.
- New `packages/pisti/test/clone.test.ts` (2 tests): the clone is deep and detached, and a full 2-player and 4-player-partner/secret round runs with `globalThis.structuredClone` deleted (simulating Hermes).
- Repaired the "Astra iadesi sonrası düzeltme" section above: it had been saved in an ANSI code page, so every Turkish letter appeared as `?`. It is rewritten as UTF-8 with the same content.
- Public types unchanged (`PistiState`, `PistiAction`, `PistiView`, `PistiOptions`, `pistiDef`). `clone` is not re-exported from `index.ts`. No other package, `package.json` or the lockfile was touched. Nothing committed.

### Non-blocking notes

- Coverage was not measured with a tool; the rule-to-test mapping above stands in for it. The 1000-seed bot simulation (PROMPT_LOCAL "B bitti") is a stage-B gate, not part of B2 (200 seeds here).
- If a round ends with no capture at all, the center stays uncaptured and both sides score zero. This is practically impossible, and the current behaviour is deliberate and tested.

### Commands (Git Bash, scratchpad `bin` prepended to PATH)

`corepack pnpm --filter @kahve/pisti test` — exit 0:

```text
 Test Files  8 passed (8)
      Tests  46 passed (46)
   Start at  02:44:28
   Duration  10.68s (tests 90%, import 6%, transform 3%, worker 1%)
```

`corepack pnpm --filter @kahve/pisti typecheck` — exit 0:

```text
$ tsc --noEmit
```

`corepack pnpm test` (root) — exit 0. Total 372 tests: core 41, cards 36, shared 104, pisti 46, catalog 61, app 19, server 65; batak is an empty scaffold.

```text
server test:  Test Files  9 passed (9)
server test:       Tests  65 passed (65)
server test:    Start at  02:45:15
server test:    Duration  3.65s (tests 62%, import 34%, transform 3%, worker 1%)
server test: 
server test: Done
```

`corepack pnpm typecheck` (root) — exit 0:

```text
packages/catalog typecheck: Done
server typecheck$ tsc --noEmit
app typecheck$ tsc --noEmit
server typecheck: Done
app typecheck: Done
```
