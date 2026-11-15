GÖREV: B8-CLINE  FAZ: B
AMAÇ: Tüm aktif oyunlar için bağımsız doğrulama: 1000 seed'li bot-bot simülasyonu, kapsam raporu, `viewFor` gizli bilgi sızıntı testleri.
OKU: PROMPT_LOCAL.md §3 "B bitti sayılır", docs/kahve/ORKESTRA.md §1.5b §2 §3, docs/kahve/MASTER_PLAN.md §2 §4e, packages/game-core/src/types.ts,
     packages/catalog/src/{index,okey}.ts, packages/catalog/test/okey101-equivalence.test.ts (bot-bot döngü örneği)
SÖZLEŞME: types.ts @ feat/kahve HEAD (değiştirme)
WORKTREE: C:/Users/mfaru/okey101/kahve-cline (dal feat/kahve-cline). SADECE burada çalış; başka klasöre/dala dokunma, push/merge yok.
SAHİP OLDUĞUN YOLLAR: tools/sim/** (yeni), packages/*/test/leak*.test.ts (sadece yeni dosyalar), docs/kahve/reports/B8-CLINE.md
DOKUNMA: packages/*/src/**, mevcut testler, shared/**, server/**, app/**, package.json dosyaları, lockfile. Yeni bağımlılık YOK.
  (tools/sim için package.json gerekiyorsa DUR ve raporla: Fable açar.)

ADIM 1 (şimdi; motorlar henüz okey'den ibaret):
- `tools/sim/run.ts`: catalog'daki her `status: 'active'` oyun için N seed (varsayılan 1000, `--seeds` ile), tüm bot seviyeleri karışık, her adımda
  `def.isAction(a)` ve `def.apply(...).ok` doğrulanır; geçersiz hamle 0; her round biter (adım sınırı); seed, süre ve oyun başına özet. Okey ile çalışır halde başla;
  yeni oyun catalog'a girince kod değişmeden kapsar. Çalıştırma: `corepack pnpm exec tsx tools/sim/run.ts --seeds 1000` (tsx kökte mevcut; değilse rapora yaz).
- Sızıntı testi kalıbı: `packages/catalog/test/leak-okey.test.ts`: her koltuğun view'ında başka koltukların eli yok (sadece sayıları), deste/orta yığın sırası yok,
  seed/rng yok. Yapısal kontrol: view JSON'unda rakip taş/kart id'lerinin hiçbiri geçmez (el sonu açık eller hariç).
ADIM 2 (Fable "pisti/batak birleşti" deyince, ayrı kısa onay): aynı sim'i ve `leak-pisti`, `leak-batak` testlerini ekle; 1000 seed çıktısını rapora yapıştır.
KABUL: kökte `corepack pnpm test` ve `typecheck` yeşil; sim çıktısının son satırları rapora yapıştırılmış (uydurma yok).
SÜREÇ: plan modunda plan (`docs/kahve/plans/B8-CLINE.md`, ilk satır `DURUM: FABLE ONAYI BEKLİYOR`) → Fable onayı → act modunda iş → kendi dalına commit → rapor.
Not: `pnpm` PATH'te yok: `corepack pnpm`. Kök script'ler içeriden `pnpm` çağırır; PATH'e C:/Users/mfaru/AppData/Local/Temp/claude/f49cf958c1a27fde/c20dd7a9-8d24-4511-85d2-ae926769b4c2/scratchpad/bin ekle (pnpm.cmd).
