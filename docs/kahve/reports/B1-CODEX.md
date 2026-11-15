# B1-CODEX — @kahve/cards teslim raporu

Tarih: 2026-11-16. Uygulayan: Sol. Durum: B1.1–B1.4 tamamlandı, Astra incelemesine hazır.
Değişiklikler commit'siz bırakıldı; commit veya merge denenmedi. Paket kurulmadı; manifest, lockfile ve diğer paketler değiştirilmedi.

## Değişen dosyalar

- `packages/cards/src/types.ts`: Suit, Rank, Card, HandOrder, DealResult.
- `packages/cards/src/deck.ts`: sabit kimlikli yeni deste, core shuffle ile karıştırma, doğrulamalı blok dağıtım.
- `packages/cards/src/display.ts`: kart etiketi ve takım rengi.
- `packages/cards/src/compare.ts`: koz/açılan takım önceliği ve sameRank.
- `packages/cards/src/sort.ts`: sabit S,H,D,C sırası ve takım içinde asc/desc; eşit anahtarlarda kararlı sıralama.
- `packages/cards/src/index.ts`: onaylı API dışa aktarımları.
- `packages/cards/test/deck.test.ts`
- `packages/cards/test/display.test.ts`
- `packages/cards/test/compare.test.ts`
- `packages/cards/test/sort.test.ts`
- `packages/cards/test/contract.test.ts`
- `docs/kahve/reports/B1-CODEX.md`

## Sıralı uygulama ve doğrulama

B1.1: tipler, deste, etiket/renk → 7 test geçti.
B1.2: karıştırma, dağıtım ve sınır/değişmezlik testleri → 27 test geçti.
B1.3: karşılaştırma, sameRank ve sıralama → 34 test geçti.
B1.4: dışa aktarımlar, tip imzaları ve JSON sözleşmesi → 36 test geçti; paket typecheck çıkış kodu 0.

### corepack pnpm --filter @kahve/cards test

Çıkış kodu: 0. Gerçek çıktı:

```text
$ vitest run --passWithNoTests

 RUN  v5.0.5 C:/Users/mfaru/okey101/kahve-codex/packages/cards


 Test Files  5 passed (5)
      Tests  36 passed (36)
   Start at  01:33:05
   Duration  1.10s (tests 42%, transform 29%, import 23%, worker 6%)
```

### corepack pnpm --filter @kahve/cards typecheck

Çıkış kodu: 0. Gerçek çıktı (komut başka satır üretmedi):

```text
$ tsc --noEmit
```

### Kök kontrolleri

`corepack pnpm test` çıkış kodu 1; gerçek çıktı:

```text
$ pnpm -r --filter @okey/shared --filter @okey/server --filter "./packages/*" --filter app test
'pnpm' is not recognized as an internal or external command,
operable program or batch file.
[ELIFECYCLE] Test failed. See above for more details.
```

`corepack pnpm typecheck` çıkış kodu 1; gerçek çıktı:

```text
$ pnpm -r typecheck
'pnpm' is not recognized as an internal or external command,
operable program or batch file.
[ELIFECYCLE] Command failed with exit code 1.
```

Kök betikleri çıplak `pnpm` çağırıyor; bu ortamda PATH'te bulunmuyor. Dosya veya ortam ayarı değiştirmeden, betiklerin işlemleri doğrudan corepack ile tekrar çalıştırıldı:

`corepack pnpm -r --filter @okey/shared --filter @okey/server --filter "./packages/*" --filter app test` — çıkış kodu 0. Son satırlar:

```text
server test:  Test Files  9 passed (9)
server test:       Tests  65 passed (65)
server test:    Start at  01:33:53
server test:    Duration  5.53s (tests 48%, import 38%, transform 13%, worker 1%)
server test: 
server test: Done
```

`corepack pnpm -r typecheck` — çıkış kodu 0. Son satırlar:

```text
server typecheck: Done
app typecheck: Done
```

## Test–kural eşleme tablosu

Paket coverage betiği/sağlayıcısı bulunmadığından onaylı alternatif kullanıldı; ölçülmüş kapsam yüzdesi iddia edilmiyor.

| Kural | Kanıt |
| --- | --- |
| 52 benzersiz kimlik ve takım/değer; S2=0, SA=12, C2=39, CA=51 | deck.test.ts: tüm kartların sabit kimlik eşlemesi |
| Her çağrıda yeni dizi ve kart nesneleri | deck.test.ts: fresh array/objects testi |
| Seed determinizmi, kart kaybı/tekrarı olmaması, core shuffle eşdeğerliği | deck.test.ts: 0,1,42,-1 seed karşılaştırmaları |
| Yalnız verilen RNG, tam 51 çağrı | deck.test.ts: RNG çağrı sayacı ve Math.random koruması |
| Baştan kesintisiz bloklar; kalan sıranın korunması | deck.test.ts: [4,4], [1,0,3], [13,13,13,13] |
| Boş/sıfır dağıtım, boş deste | deck.test.ts: [], [0,0], empty deck |
| Negatif, kesirli, NaN, sonsuz, aşırı adet/toplam için RangeError | deck.test.ts: invalid count ve excessive total |
| Dağıtım girdilerini değiştirmeme, yeni çıktı dizileri | deck.test.ts: dondurulmuş girdiler ve bağımsız çıktı dizileri |
| Koz → açılan takım → etkisiz kart; As üstün; eşitlik | compare.test.ts: 52×52×4×5 = 54.080 karşılaştırma |
| Etkisiz aynı/farklı takım kartları 0; lead=trump; kozsuz karşılaştırma | compare.test.ts: aynı kapsamlı tarama |
| Açılış kartından pozitif sonuçla löve kazananı seçimi | compare.test.ts: H10, HA, S2, HK örneği kozlu/kozsuz |
| sameRank yalnız değeri karşılaştırır | compare.test.ts: tüm kart çiftleri ve değiştirilmiş id |
| S,H,D,C sabit; 2→A / A→2; boş/tekli, kararlılık, girdiyi koruma | sort.test.ts: her iki yön ve eşit anahtarlar |
| Tüm 52 etiket ve dört takım rengi | display.test.ts |
| Tam dışa aktarım ve TS imzaları | contract.test.ts; paket typecheck |
| JSON gidiş-dönüş, düz nesneler ve API ile yeniden kullanım | contract.test.ts |

## Bilinen eksikler ve sınırlar

B1 davranış sözleşmesinde bilinen eksik yok. Kök betiklerinin doğrudan çağrısı yukarıdaki PATH sorunu nedeniyle başarılı olmadı; eşdeğer recursive kontroller başarılı. Coverage yüzdesi ölçülmedi. Bot-bot ve viewFor testleri B1'e uygulanmaz; B2/B3 kapsamındadır. Pişti/Batak kodu yazılmadı.

