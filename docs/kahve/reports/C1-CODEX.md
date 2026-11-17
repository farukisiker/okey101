# C1-CODEX: @kahve/tavla

Yazar: Claude Opus 5.5 (Codex ekibinin yerine; kota bitti). Görev kâğıdı docs/kahve/tasks/C1-CODEX.md'ye göre yazıldı. Plan/inceleme turu yapılmadı, Astra incelemesi bekleniyor.
Sözleşme (packages/tavla/src/types.ts) değişmedi. Sözleşme isteği yok.

## Ne yapıldı

- `src/board.ts`: oynayana göre göreli dizilim (Int8Array, 0 = toplanan, 1..24 = hane, 25 = bar; rakip aynı dizide kendi göreli koordinatıyla). Tek hamle kuralları (kırık pul önceliği, kapı, kırma, toplama), make/unmake ile `maxPlayable` (en çok kaç zar oynanır) ve `sequences` (sonuç tahtasına göre tekilleştirilmiş tüm azami diziler, büyük zar kuralı). Düğüm anahtarı string değil, sayısal (`NodeSet`): oynayanın yarısı 2×52 bit ve kalan zar/kırılan haneler; çakışma yok.
- `src/dice.ts`: zar yalnız `rngState` sayacından (mulberry32, core'daki `seededRng` ile aynı karıştırma). `create`, verilen rng'den tam bir değer çeker.
- `src/rules.ts`: `create` (açılış zarı, eşitte yeniden, büyük atan iki zarı oynar), `isAction`, `apply` (fırlatmaz, girdiyi değiştirmez; step/undo/commit; Türkçe hata metinleri), mars/konçina sonucu.
- `src/view.ts`: `viewFor` (rngState yok, iki koltuğun pipleri, hamle ipuçları yalnız kendi sırasında, geçersiz koltuk -1, saat yoksa null). `moves`: önce tek zarlı adımlar, sonra aynı pulun art arda zarlarla gittiği hedefler. Aynı (from,to) bir kez, en kısa zar listesiyle.
- `src/bot.ts`: easy rastgele tam dizi (verilen rng). medium değerlendirme: pip farkı; açık pul cezası (vurulma olasılığı × kaybedilecek pip); kapı ve blok (prime) ödülü; ev kapıları; kırık rakip × ev kapısı. Değerlendirme ters simetrik, temasız yarışta yalnız pip. hard: medium'un en iyi 4 adayı için rakibin 21 zarı ve her zardaki en iyi cevabı üzerinden beklenen değer. `quickMove` deterministik.
- `src/definition.ts`: `tavlaDef` (kâğıttaki meta, saat 30 s × 1.5, renameSeat, refillsClock false, noticeOf yok). `src/scoring.ts`: scoreRound / matchOver.

## Fable'ın onaylaması gereken iki karar

1. **Kazanış anı:** son pulu toplayan `step`, oyunu commit beklemeden hemen bitirir (lastTurn yazılır, turnNumber++, phase 'finished'). Zarın biri artsa da böyle. Ayrıca azami zar kuralında son pulu toplamak "kalan zarların hepsi oynandı" sayılır. Yoksa tek pulu 3'te olan oyuncu [2,5] ile 5'i oynayıp bitiremez, önce 3→1 sonra toplamaya zorlanırdı. Kâğıttaki "Kazanma anında phase 'finished'" böyle okundu.
2. **Usta botun süre sınırı:** hard aramasına bir düğüm bütçesi kondu (`HARD_NODES = 8000` düğüm her botMove çağrısında). Bütçe süreyle değil sayıyla ölçülür, sonuç deterministik kalır. Bütçe biterse kalan adaylar elenir; o zamana kadarki en iyi aday seçilir, en kötü durumda medium seçimi. Çok dağınık pozisyonlarda (15 pul 15 hanede) rakibin 21 zarı aday başına ~10 000 yaprak veriyordu.

## Komutlar

- `corepack pnpm --filter @kahve/tavla test`: 5 dosya, **50 test geçti** (~17 s; çoğu simülasyon).
- `corepack pnpm --filter @kahve/tavla typecheck`: temiz.
- `corepack pnpm -r typecheck`: 9 proje temiz. `corepack pnpm -r --filter "./packages/*" test`: game-core 41, cards 36, pisti 46, tavla 50, batak 62, catalog 77 test geçti.

## Simülasyon (200 seed, 9 seviye eşleşmesi döngüsel)

```text
[tavla sim] 200 games, 11998 turns, 16.9s; invalid 0, quickInvalid 0, conservation 0, mutated 0, unfinished 0;
kinds {"tek":81,"mars":74,"koncina":45}; cross-level wins {"medium>easy":45,"hard>easy":44,"medium>hard":17,"hard>medium":27}
```

Her hamlede bot ve quickMove hamlesi geçerliydi, 30 pul korundu ve girdi değişmedi (her 7. hamlede kontrol edildi). 200 oyunun hepsi bitti. Usta, Orta'yı 27–17 yendi. Acemi hiç kazanamadı.
JSON: 12 seed'de her hamleden önce JSON gidiş-dönüşü yapıldı; hamle günlüğü ve son durum aynı çıktı. Aynı seed'le iki oyun bayt bayt aynı (rngState dahil).

## Süre (Node, bu PC; her çağrının 3 denemedeki en hızlısı)

3 dağınık/temaslı pozisyon × 2 koltuk × 6 zar ([1,1], [2,2], [3,3], [4,4], [6,5], [2,1]), medium ve hard ile tam tur oynandı. Dört koşuda tam dizi üretimi en çok **1.9–2.4 ms**, tek botMove çağrısı en çok **10.5–11.6 ms** sürdü. Sınır 50 ms. Bütçe yokken bu ölçüm 30–55 ms idi.

## Kapsam

`@vitest/coverage-*` kurulu değil, kurulmadı. Ölçüm yerine test–kural eşlemesi:

| Kural / test | Test (dosya › ad) |
|---|---|
| T01 dizilim, 167 pip | setup › T01 |
| Açılış zarı, eşitte yeniden, büyük başlar, turnNumber 0 | setup › opening roll |
| Aynı seed aynı zar, rng tek çekim | setup › same seed…, dice come from the counter…; simulation › same seed… |
| normalizeOptions, meta, saat, renameSeat | setup › definition…, normalizeOptions…, renameSeat… |
| T04 kapı yasağı | rules › T04 |
| T05 kırma | rules › T05 |
| T06 kırık pul önceliği | rules › T06 |
| T07 kapalı ev, Pas (0 adımla commit) | rules › T07 |
| T08 iki kırıktan biri girer | rules › T08 |
| Siyah zar hanesine girer | rules › black enters… |
| T09 zorunlu iki zar (+ ters: iki sıra da serbest) | rules › T09, either order… |
| T10 büyük zar (+ ters: yalnız küçük oynanır) | rules › T10, T10 reverse |
| T11 çiftte 4 hamle, eksikte commit reddi | rules › T11 |
| T12 çiftte kapalı ara hane, moves listesinde yok | rules › T12 |
| T13 dışarıda pul varken toplama yasağı | rules › T13 |
| T14 geride pul varken büyük zarla küçük haneden toplama yasağı | rules › T14 |
| T15 geride pul yokken büyük zarla toplama | rules › T15 |
| T16 kırık pul toplamayı durdurur | rules › T16 |
| Toplamada kırılma (siyah vurur, beyaz önce girer) | rules › a white blot hit while bearing off… |
| Son pulla anında kazanma | rules › bearing off the last checker… |
| T17 tek, T18 mars, T19 konçina 3 ve 2 (bar ve ev), siyah kazanır | rules › T17, T18, T19, black wins… |
| T25 undo; kırmayı geri alma | rules › T25, undo after a hit… |
| Sıra, commit sonrası zar, hatalı girdi, değişmezlik | rules › commit passes…, apply never mutates… |
| viewFor: rngState yok (anahtar ve değer), ipucu yalnız sırada, seat -1, saat | view › never contains…, pips for both seats… |
| moves: sıra, tekil (from,to), en kısa zar, oynanabilirlik, çiftte 4 zar | view › moves…, doubles… |
| canUndo / canCommit / bitmiş oyun görünümü, görünüm kopya | view › canUndo…, views are copies… |
| Bot: ters simetrik değerlendirme, kırma tercihi, insan adımından devam, pas, quickMove | bot › 6 test |
| 50 ms süre ölçümü | bot › timing |
| 200 oyun, JSON devamı | simulation › 3 test |

Dokunulan yollar: packages/tavla/src/** (types.ts hariç), packages/tavla/test/**, bu rapor.
