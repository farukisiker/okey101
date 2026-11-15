# A1-CODEX teslim raporu

Tarih: 2026-11-15. Dal: `feat/kahve-codex`. Başlangıç/teslim HEAD: `4aa04067c323955be03cc3eb5ba96dbb14c3a70d`.

## Değişen dosyalar

- `packages/game-core/src/rng.ts`: shared ile aynı mulberry32 ve Fisher–Yates, randomInt, pick, newSeed.
- `packages/game-core/src/seats.ts`: nextSeat, prevSeat, seatOrder, partnerOf.
- `packages/game-core/src/scores.ts`: girdileri koruyan sumTotals.
- `packages/game-core/src/index.ts`: mevcut tipleri koruyan yardımcı dışa aktarımları.
- `packages/game-core/test/rng.test.ts`: 23 test.
- `packages/game-core/test/seats.test.ts`: 7 test.
- `packages/game-core/test/scores.test.ts`: 3 test.
- `packages/game-core/test/exports.test.ts`: 2 test.
- `docs/kahve/reports/A1-CODEX.md`: bu rapor.

Diğer dosyalar, types.ts, manifestler ve lockfile değiştirilmedi; paket kurulmadı. Dört alt görev aynı worktree içinde sırayla uygulandı.

## Git ve plan farkları

Görev başındaki `git merge feat/kahve` sandbox tarafından engellendi:

```text
fatal: update_ref failed for ref 'ORIG_HEAD': cannot lock ref 'ORIG_HEAD': Unable to create 'C:/Users/mfaru/okey101/okey101/.git/worktrees/kahve-codex/ORIG_HEAD.lock': Permission denied
```

Bu nedenle doğrulamalar mevcut HEAD üzerinde yapıldı; feat/kahve dalındaki sonraki A5 değişiklikleri ile bütünleşme doğrulanmadı.

Her alt görev sonunda git add ve git commit denendi. Oluşturulan commit yok; değişiklikler commit edilmeden bırakıldı. Denenen mesajlar:

1. `feat(core): add deterministic random helpers`
2. `feat(core): add seat and score helpers`
3. `feat(core): export A1 helpers`
4. `docs(kahve): report A1 validation`

İlk üç denemede alınan gerçek hata (son rapor denemesi de aynı izin sınırına tabidir):

```text
fatal: Unable to create 'C:/Users/mfaru/okey101/okey101/.git/worktrees/kahve-codex/index.lock': Permission denied
```

Plandaki `../../../../shared/src/tiles` import yolu gerçek dizin yapısında bir seviye fazlaydı: ilk test ve typecheck bu nedenle başarısız oldu. Doğru `../../../shared/src/tiles` yolu ile doğrudan referans karşılaştırması geçiyor; sabit fikstür kullanılmadı. Boş/tek elemanlı tablo testinin Vitest argüman açılımı da ilk typecheck sonucuna göre nesne satırlarına çevrildi.

## Paket doğrulamaları

Her uygulama alt görevinden sonra istenen iki komut çalıştırıldı. Aşağıdaki bloklar gerçek çıktıların son satırlarıdır. `typecheck` her üç aşamada exit 0 döndü; başarılı çıktı yalnızca `$ tsc --noEmit` satırıdır.

Alt görev 1, `corepack pnpm --filter @kahve/core test`:

```text
 Test Files  1 passed (1)
      Tests  23 passed (23)
   Start at  17:31:35
   Duration  479ms (tests 39%, transform 36%, import 20%, worker 5%)
```

Alt görev 2, aynı komut:

```text
 Test Files  3 passed (3)
      Tests  33 passed (33)
   Start at  17:32:13
   Duration  421ms (transform 35%, import 29%, tests 25%, worker 10%)
```

Alt görev 3, aynı komut:

```text
 Test Files  4 passed (4)
      Tests  35 passed (35)
   Start at  17:32:37
   Duration  710ms (transform 34%, import 29%, tests 26%, worker 10%)
```

`corepack pnpm --filter @kahve/core typecheck`:

```text
$ tsc --noEmit
```

## Kök doğrulamaları

İlk kök denemeleri PATH nedeniyle başarısızdı:

```text
$ pnpm -r --filter @okey/shared --filter @okey/server --filter "./packages/*" test
'pnpm' is not recognized as an internal or external command,
operable program or batch file.
[ELIFECYCLE] Test failed. See above for more details.
$ pnpm -r typecheck
'pnpm' is not recognized as an internal or external command,
operable program or batch file.
[ELIFECYCLE] Command failed with exit code 1.
```

Depo dışında `$env:TEMP/kahve-a1-pnpm/pnpm.cmd` dosyasına `@corepack pnpm %*` yazıldı ve yalnızca doğrulama sürecinin PATH'ine eklendi. Manifest değişmedi. Sonraki `corepack pnpm test` ve `corepack pnpm typecheck` başarılı oldu (exit 0). Test toplamı 35 core + 70 shared + 23 server = **128 = 93 + 35**; catalog test içermiyor.

`corepack pnpm test` çıktısının son satırları:

```text
 RUN  v5.0.5 C:/Users/mfaru/okey101/kahve-codex/server


 Test Files  3 passed (3)
      Tests  23 passed (23)
   Start at  17:33:01
   Duration  3.69s (tests 73%, import 16%, transform 10%, worker 1%)
```

`corepack pnpm typecheck` çıktısının son satırları:

```text
packages/game-core typecheck$ tsc --noEmit
packages/game-core typecheck: Done
shared typecheck$ tsc --noEmit
shared typecheck: Done
packages/catalog typecheck$ tsc --noEmit
packages/catalog typecheck: Done
server typecheck$ tsc --noEmit
app typecheck$ tsc --noEmit
server typecheck: Done
app typecheck: Done
```

## Kapsam kanıtı

`corepack pnpm --filter @kahve/core test --coverage` exit 1; sağlayıcı eksik, yeni bağımlılık kurulmadı. Gerçek son satırlar:

```text
$ vitest run --passWithNoTests --coverage
 MISSING DEPENDENCY  Cannot find dependency '@vitest/coverage-v8'

[ELIFECYCLE] Test failed. See above for more details.
Error: ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL

  × "pnpm recursive run" failed in C:\Users\mfaru\okey101\kahve-
  │ codex\packages\game-core
```

Ölçülmüş yüzde iddia edilmiyor. Görevde izin verilen test–davranış eşlemesi:

| Davranış | Kanıt |
|---|---|
| RNG adımları, normalizasyon ve [0,1) aralığı | 0, 1, 42, -1, 0xffffffff, 0x100000000 seed'lerinin her biri için ilk 10.000 değer shared ile birebir eşit; ayrıca normalizasyon testi |
| Shuffle döngüsüne girme/girmeme | Boş, tek eleman ve 106 eleman; dört seed ile referans sonuç ve sonraki RNG değeri eşitliği |
| Shuffle değişmezlik ve permütasyon | Donmuş girdi, yeni dizi kimliği, sıralı permütasyon, tekrarlı değerler ve tam length-1 çağrı |
| randomInt uçları ve iç değer | 0, 1'e yakın değer, 0.5 ve n=1; tek RNG çağrısı |
| pick iki dalı | Boş dizide undefined ve sıfır çağrı; ilk/son/tek eleman ve dolu dizide tek çağrı |
| newSeed | Math.random 0, 0.5 ve 1'e yakın değerde 0, 2147483648, 4294967295; tek çağrı |
| Koltuk sarma, sıra, ortak | n=2 ve n=4 tüm koltuklar, n=1 ve n=3; partnerOf iki dalı |
| Toplam döngüsü ve değişmezlik | Boş, iki/dört elemanlı, negatif/sıfır skorlar; iki donmuş girdi ve yeni çıktı |
| Giriş noktası | Bütün yardımcıların kimlikleri, Rng/GameDefinition tip erişimi, mevcut GAME_IDS/isGameId dışa aktarımları |

Yeni üretim yardımcılarının tüm fonksiyonları ve koşul dalları bu testlerle çalıştırılıyor. Geçersiz koltuk/n ve farklı uzunlukta skor dizileri onaylı önkoşullar olarak JSDoc'ta belirtilmiştir. `git diff --check` başarılıdır.
