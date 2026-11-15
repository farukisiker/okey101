GÖREV: A1-CODEX  FAZ: A
AMAÇ: `@kahve/core` paketine saf, seed'li RNG ve koltuk/sıra yardımcılarını eklemek.
OKU: PROMPT_LOCAL.md §2.1–2.2, docs/kahve/ORKESTRA.md §1.3 §2 §3, docs/kahve/MASTER_PLAN.md §2–3, shared/src/tiles.ts (seededRng, shuffle), shared/src/game.ts (leftOf, nextSeat)
SÖZLEŞME: packages/game-core/src/types.ts @ 2d1c37b (DEĞİŞTİRME; tip eksikse docs/kahve/requests/codex-<konu>.md)
WORKTREE: C:/Users/mfaru/okey101/kahve-codex (dal feat/kahve-codex)
SAHİP OLDUĞUN YOLLAR: packages/game-core/src/** (types.ts HARİÇ), packages/game-core/test/**
DOKUNMA: shared/**, server/**, app/**, package.json dosyaları, pnpm-lock.yaml (vitest zaten var)

İSTENEN DIŞA AKTARIMLAR (packages/game-core/src/index.ts üzerinden):
- `seededRng(seed: number): Rng`: mulberry32, shared/src/tiles.ts'teki ile AYNI algoritma (kopyala, import etme; core bağımlılıksız kalır).
- `shuffle<T>(items: readonly T[], rng: Rng): T[]`: Fisher–Yates, tiles.ts ile aynı çağrı sırası (aynı rng → aynı sonuç). Girdiyi değiştirmez.
- `randomInt(rng, n)`: [0, n) tamsayı. `pick(rng, items)`.
- `newSeed(): number`: Math.random tabanlı 32-bit seed (sadece ev sahibi çağırır; kurallar asla).
- Koltuk: `nextSeat(seat, n)`, `prevSeat(seat, n)` (okeyde leftOf = prevSeat), `seatOrder(start, n): number[]`,
  `partnerOf(seat, n)` (4 kişide karşı koltuk; n !== 4 ise -1, fırlatma yok).
- `sumTotals(totals: number[], round: number[]): number[]` (yeni dizi döner).

KABUL:
- Test: aynı seed ile core `seededRng` ve `@okey/shared` `seededRng` ilk 10 000 sayıda birebir aynı. Test dosyası `@okey/shared`'i
  göreli yolla import edebilir (`../../../shared/src/tiles`); olmazsa beklenen ilk 20 değeri sabit gömün ve kaynağını yazın.
- shuffle: aynı seed + aynı girdi → tiles.ts shuffle ile aynı çıktı; girdi değişmiyor; sonuç bir permütasyon.
- Koltuk yardımcıları n=2 ve n=4 için tablo testleri.
- `corepack pnpm --filter @kahve/core test` ve `typecheck` yeşil; kökte `pnpm test` ve `pnpm typecheck` yeşil (test sayısı ≥ 93 + yenileri).
- Kapsam ≥ %90. `--coverage` paketi yoksa kapsamı test listesiyle gerekçeleyin; yeni paket EKLEMEYİN.
- Bu makinede `pnpm` PATH'te yok → `corepack pnpm ...`. Kök script içeriden `pnpm` çağırır; gerekirse PATH'e `@corepack pnpm %*` içeren bir `pnpm.cmd` koyun.

BİTİŞ: feat/kahve-codex dalında küçük commit(ler) + docs/kahve/reports/A1-CODEX.md
(değişen dosyalar, commit'ler, test/typecheck çıktısının son satırları yapıştırılmış, uydurma yok). Push YOK.
