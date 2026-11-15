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
