# C4a rapor: tavla sim + sızıntı testi (Cline yerine Claude)

Dal: `feat/kahve-cline`. Kapsam: `tools/sim/run.ts`, `packages/catalog/test/leak-tavla.test.ts`, bu rapor. Motor koduna dokunulmadı.

## Yapılanlar
- `tools/sim/run.ts`: tavla catalog'da `active` olduğu için sim'e kendiliğinden giriyor (`--games tavla`). Eklenenler:
  - Her adımdan sonra tavla değişmezi: her koltuk için tahtadaki pul + bar + toplanan = 15 (30 pul korunumu); bozulursa json/sözleşme hatası sayılır.
  - Özet satırı: `botMove` çağrı sayısı, ortalama ve en yüksek süre (ms), hard için en yüksek süre; tavla için ortalama tur/oyun.
  - `@kahve/tavla` sim bağımlılığı değil ve catalog `TavlaState` dışa aktarmıyor; invariant için yerel dar bir tip kullanıldı.
- `packages/catalog/test/leak-tavla.test.ts` (5 test): `leak-harness.ts`'in tahta-taşı odaklı kapıları (el sayısı, deste) tavlaya uymadığı için harness'ten yalnız `BIG_SEED` ve `collectKeys` kullanıldı.
  - 25 seed bot oyunu, her 3 adımda 3 bakış (koltuk 0, 1, seyirci -1): tam anahtar listesi, `rngState`/`seed`/`rng`/`turnStart` anahtarı yok, değeri yok, `viewFor` deterministik, tahta/zar/openingRoll durumla birebir, sırası olmayan koltukta `moves` boş ve düğmeler kapalı, bitişte sonuç herkese açık.
  - Yalnız `rngState` farklı iki durum (oyun ortası ve bitmiş) her koltukta (0, 1, -1, 2) bayt bayt aynı view verir; `BIG_SEED` view'a girmez.
  - Kontrol: farklı `rngState` motorun sonraki zarlarını gerçekten değiştirir (gizli durum gerçek).
  - Geçersiz koltuk (-1, 2, 5, 99): `seat = -1`, `moves` boş, `canCommit/mustPass/canUndo` false, tahta herkese açık.
  - Yalnız sırası gelen koltuk hamle listesi alır.

## Sonuçlar
`corepack pnpm --filter @kahve/catalog test`: 15 dosya, 86 test geçti. `... typecheck` ve `tsc -p tools/sim/tsconfig.json --noEmit`: çıkış 0.

`corepack pnpm exec tsx tools/sim/run.ts --seeds 1000 --games tavla --quiet` (3 dk 20 sn):

| oyun | seed | el | adım | geçersiz | bitmeyen | jsonHata | seviye e/m/h |
|---|---|---|---|---|---|---|---|
| tavla | 1000 | 1000 | 205227 | 0 | 0 | 0 | 68411/68418/68398 |

- Ortalama tur/oyun: 66.4. `botMove`: 205227 çağrı, ortalama 0.689 ms, en yüksek 854 ms (hard; tek çağrı, 1000 oyunda tekil sapma, ortalamayı etkilemiyor).
- 30 pul korunumu her adımda 205227 kez kontrol edildi, ihlal 0.

## Bilinen
- En yüksek 854 ms değeri bir uç örnek; hard botun en kötü durumu için ayrı bir süre bütçesi gerekirse Fable karar verir (istemci tarafı bot 600 ms adım gecikmesi kullanıyor).
- `tools/sim` hâlâ kök `typecheck`'e dahil değil.
