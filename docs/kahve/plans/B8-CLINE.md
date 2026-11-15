DURUM: ONAYLANDI 2026-11-16 (Fable). Açık sorulara cevaplar:
- Q1 kapsam %: yeni bağımlılık YOK (bu gece); test–kural eşleme tablosu + test sayıları + sim kapsamı yeterli.
- Q2: ortak sızıntı yardımcısı `packages/catalog/test/leak-harness.ts` (yeni dosya, Cline'ın) olarak izinli; oyun başına `leak-<oyun>.test.ts`.
- Q3: tools/sim typecheck şimdilik elle (`corepack pnpm exec tsc -p tools/sim/tsconfig.json --noEmit`), raporda yapıştır. Kök script'e eklemek Fable'ın işi (sonra).
- R3: tsx hoisted olarak kalsın; risk notu raporda.
- R6: sim her oyunun `seatChoices` listesindeki her koltuk sayısını dener (seçenekler `normalizeOptions({ ...defaultOptions, seats: n })` ile; alan adı oyunda farklıysa raporla).
- Uzun koşular (1000 düz seed ~9 dk) arka planda/loglu; çıktının son satırları rapora.
- Sızıntı testi varsayılan 25 seed, koltuk rotasyonu; paket test süresi ~20 sn altında kalsın.

DURUM: FABLE ONAYI BEKLİYOR

**B8-CLINE planı** (Cline: `cline-pass/deepseek-v4.1-flash`) · worktree `C:/Users/mfaru/okey101/kahve-cline`, dal `feat/kahve-cline` @ `ecfcb52` · sözleşme: `packages/game-core/src/types.ts` @ feat/kahve HEAD (değişmez) · push/merge yok, başka worktree'ye dokunulmaz.

Plan modunda doğrulanan ortam gerçekleri (tahmin değil, ölçüm):
- `corepack pnpm exec tsx --version` → **tsx v4.23.15 / node v24.15.0** (kökte `node_modules/.bin/tsx.cmd` var; `tsx` `@okey/server` devDependency'si ve `nodeLinker: hoisted` sayesinde köke asılı gelmiş).
- `corepack pnpm exec tsx -e "import('@kahve/catalog')..."` → **çalışıyor**: `ACTIVE=okey101,okeyDuz`, `SEATS=4`, `TURN={"seat":0,"key":0,"first":true}`, view anahtarları 22 alan (mode…islek).
- Ölçülen sim hızı: `okey101` **100 seed = 3,26 s** (8572 adım); `okeyDuz` **20 seed = 10,6 s** (1596 adım) → 1000 seed tahmini: 101 ≈ 35 s, düz ≈ **9 dk**.
- Kapsam sağlayıcı **yok**: `@vitest/coverage-v8`, `@vitest/coverage-istanbul`, `v8-to-istanbul`, `istanbul-lib-coverage`, `istanbul-reports`, `test-exclude` → `require.resolve` ile **MISSING** (lockfile'daki adlar vitest'in opsiyonel peer listesi). `@types/node` + `tsc` kökte var.
- `tools/` kökte **yok**; `pnpm-workspace.yaml` yalnız `app`, `server`, `shared`, `packages/*` süzüyor → `tools/sim` workspace paketi olmayacak (package.json/lockfile gerekmez). Kök `test`/`typecheck` script'leri `pnpm -r` ile yürüdüğü için `tools/sim`'i **kapsamaz**.

---

## 1) Kapsam (5 madde) ve kapsam dışı

1. `tools/sim/run.ts` (+ `tools/sim/tsconfig.json`): catalog'daki **her `status:'active'` oyun** için N seed (varsayılan 1000) bot-bot simülasyonu; karışık bot seviyeleri; her adımda `def.isAction(a)` ve `def.apply(...).ok` doğrulaması; geçersiz hamle 0; her el adım sınırı içinde biter; seed/süre/oyun bazında özet. Bugün okey101+okeyDuz ile çalışır, yeni oyun catalog'a girince **kod değişmeden** kapsar.
2. `packages/catalog/test/leak-okey.test.ts` (yeni dosya): `viewFor` gizli bilgi sızıntı testleri — rakip elleri (sadece `handCount`), deste sırası, seed/rng; yapısal id karşılaştırması + mutasyon (aynı açık masa / farklı gizli bilgi ⇒ aynı view) + pozitif kontroller.
3. **Kapsam raporu**: (a) okey kural→test eşleme tablosu + paket başına test sayıları, (b) sim kapsam özeti (oyun × seed × seviye histogramı × seçenekler), (c) `@vitest/coverage-v8` yokluğunun kanıtı ve sayısal % için Fable'a istek (bkz. §5 Q1).
4. `docs/kahve/reports/B8-CLINE.md`: değişen dosyalar, commit'ler, **çalıştırılan test/typecheck/sim çıktılarının son satırları** (uydurma yok), bilinen eksikler.
5. Plan dosyası `docs/kahve/plans/B8-CLINE.md` (act modunda, Fable onay satırıyla) ve kabul kapısı: kökte `corepack pnpm test` + `corepack pnpm typecheck` yeşil.

**Kapsam dışı:** `packages/*/src/**`, `shared/**`, mevcut testler, `server/**`, `app/**`, herhangi bir `package.json` / lockfile (bağımlılık ekleme yok), `types.ts` değişikliği, ADIM 2 (pisti/batak simülasyonu + `leak-pisti`/`leak-batak` — Fable "pisti/batak birleşti" dedikten sonra ayrı kısa onayla), i18n, dokümantasyon (B7-OC), push/merge/etiket.

## 2) Alt görevler (dosya + komut)

| # | Alt görev | İşçi | Dosyalar | Çalıştırılacak komut |
|---|---|---|---|---|
| 2.1 | Sim iskeleti: CLI ayrıştırma, `active` oyunları keşif, tek seed döngüsü, özet | Cline (tek ajan; iş bölünmüyor) | `tools/sim/run.ts`, `tools/sim/tsconfig.json` (yeni) | `corepack pnpm exec tsx tools/sim/run.ts --seeds 5` · `corepack pnpm exec tsc -p tools/sim/tsconfig.json --noEmit` |
| 2.2 | Sim doğrulamaları: adım sınırı, geçersiz hamle sayacı, JSON gidiş-dönüş, `quickMove`/`noticeOf` kontrolleri, `--json`, `--shard`, ilerleme satırı | Cline | `tools/sim/run.ts` | `corepack pnpm exec tsx tools/sim/run.ts --seeds 50 --rounds 5` |
| 2.3 | Sızıntı testi: okey probe + jenerik kontroller + mutasyon testi | Cline | `packages/catalog/test/leak-okey.test.ts` (yeni) | `corepack pnpm --filter @kahve/catalog test` · `KAHVE_LEAK_SEEDS=50 corepack pnpm --filter @kahve/catalog test` |
| 2.4 | Tam koşu kanıtı (arka planda, loglar `$env:TEMP`) | Cline | – | `corepack pnpm exec tsx tools/sim/run.ts --games okey101 --seeds 1000` sonra `--games okeyDuz --seeds 1000`; `corepack pnpm test`; `corepack pnpm typecheck` |
| 2.5 | Kapsam raporu + rapor dosyası | Cline | `docs/kahve/reports/B8-CLINE.md` (yeni) | çıktılar yapıştırılır; commit |

Tüketilen arayüzler (yeni dışa aktarım yok, `types.ts` değişmez): `@kahve/catalog` → `CATALOG`, `getDefinition`, `okey101Def`, `okeyDuzDef`, `makeOkeyDef`, `OkeyOptions`; `@kahve/core` → `AnyGameDefinition`, `BotLevel`, `seededRng`, `GameDefinition` alanları (`create/apply/isAction/botMove/quickMove/turn/roundOver/scoreRound/matchOver/viewFor/seats/normalizeOptions/refillsClock/noticeOf/clock`); testte ayrıca `@okey/shared` → `GameState`, `PlayerView`.

## 3) `tools/sim/run.ts` tasarımı

**CLI bayrakları** (hepsi opsiyonel, `--help` listeler):
`--seeds <n>` (varsayılan 1000) · `--seedStart <n>` (varsayılan 1) · `--shard <i>/<n>` (uzun koşuyu bölmek için) · `--games <id,id>` (varsayılan: `CATALOG.filter(g=>g.status==='active')` → bugün `okey101,okeyDuz`) · `--levels <easy,medium,hard>` (varsayılan üçü) · `--rounds <n>` (varsayılan 1; 5 verilince `matchOver`/maç sonu yolu da denenir) · `--stepCap <n>` (varsayılan 2000) · `--sampleImmutable <n>` (varsayılan 100: her n adımda `apply` mutasyonsuzluk kontrolü) · `--quiet` · `--json`.

**Oyun-bağımsız döngü** (yalnız `@kahve/catalog` + `@kahve/core`):
```
def = getDefinition(id);  opts = def.normalizeOptions(def.defaultOptions)
normalizeOptions(JSON.parse(JSON.stringify(opts))) ≡ opts            // JSON + idempotans
seats = def.seats(opts);  names = ['Bot1'..'BotN']
her seed için:
  botRng = seededRng(seed ^ 0x9e3779b9)                              // adım rng'si
  her round (0..rounds-1):
    state = def.create(opts, names, seededRng(seed + round*1000), round)
    while (!def.roundOver(state)):
      t = def.turn(state)
      if (t === null) -> HATA "el bitmedi ama sıra yok" (bitmeyen el)
      level = levels[(seed + round*7 + step) % levels.length]        // karışık seviye, determinist
      a = def.botMove(state, t.seat, level, botRng)
      def.isAction(a) === true  &&  def.isAction(JSON.parse(JSON.stringify(a))) === true   // şekil + aksiyon JSON'u
      r = def.apply(state, t.seat, a);  r.ok === true  ||  geçersizHamle++
      (ilk turda) q = def.quickMove(state, t.seat);  def.apply(state, t.seat, q).ok === true  // atılan sonuç, state değişmez
      state = r.state;  step++
      if (step > stepCap) -> HATA "stepCap aşıldı" (seed/round ile birlikte)
    def.turn(state) === null;  def.roundOver(state) === true
    scores = def.scoreRound(state);  scores.length === seats, hepsi sonlu tam sayı
    JSON: JSON.stringify(JSON.parse(JSON.stringify(state))) === JSON.stringify(state)
          her koltuk için viewFor(state, k, ctx) da gidiş-dönüşten sağ çıkar (Map/Set/undefined yok)
    totals += scores;  rounds>1 ise def.matchOver(totals, round+1, opts) raporlanır
```
`ctx` = `{ clock: { turnNumber: t.key, deadline: now + def.clock.baseMs * (t.first ? def.clock.firstTurnFactor : 1), refilled: false }, now }` → `turnMsLeft` yolu da egzersiz edilir; `refillsClock(a) === true` olan aksiyonda saat bir kez tazelenir gibi taklit edilir (kural değil, host saati). `noticeOf` varsa id'nin el içinde monoton artmadığı durum raporlanır.
`--sampleImmutable 100`: her 100. adımda `apply` öncesi `stringify(state)` alınır, `apply` sonrası aynı state'in stringify'ı değişmemeli (sözleşme: `apply` girdiyi mutasyona uğratmaz).

**Adım sınırı:** ölçüm ortalama ~86 adım/el (100 seed, 8572 adım); varsayılan `--stepCap 2000` (mevcut eşdeğerlik testi 3000 kullanıyor). Aşılırsa uydurma yok: seed/round ile birlikte `BITMEMIS` olarak basılır ve çıkış kodu 1 olur.

**Çıktı biçimi** (deterministik, grep'lenebilir; `--json` verilince tek JSON nesnesi):
```
B8 sim | oyun=2 seed/oyun=1000 rounds/seed=1 stepCap=2000 seviyeler=easy,medium,hard
... 100/1000 (3.2 s)
seed=1 game=okey101 round=0 steps=86 ms=31 levelMix=e31/m40/h15 gecersiz=0 sonuc=ok
ÖZET
oyun      seed el  adim   ms     gecersiz bitmeyen jsonHata seviye(e/m/h)
okey101   1000 1000 85720 32140     0        0        0     3312/3355/3333
okeyDuz   1000 1000 ...   ...       0        0        0     ...
TOPLAM: 2 oyun, 2000 el, 0 gecersiz hamle, 0 bitmeyen el, 0 jsonHatasi, <ms>
```
Çıkış kodu: geçersiz hamle / bitmeyen el / json hatası > 0 ise **1**, aksi halde 0 (ileride CI'ya takılabilir). Hiç dosya yazmaz; tam koşu logu `$env:TEMP/b8-sim-<oyun>.log`'a alınır (depoya/commit'e girmez).

**Yeni package.json olmadan nasıl çalışır (kanıtlandı):** `tools/` `pnpm-workspace.yaml`'da değil; `pnpm exec` kökteki `node_modules/.bin/tsx.cmd`'yi buluyor (tsx 4.23.15, `@okey/server` devDependency'si + `hoisted` sayesinde) ve tsx, `@kahve/catalog` workspace symlink'ini gerçek yoluyla (`packages/catalog/src/index.ts`) çözüp TS'i dönüştürüyor; `import('@kahve/catalog')` ile `ACTIVE=okey101,okeyDuz` **canlı doğrulandı**. Yani görev kâğıdındaki komut birebir çalışır: `corepack pnpm exec tsx tools/sim/run.ts --seeds 1000`. Tip kontrolü için tek yeni dosya `tools/sim/tsconfig.json` (`extends ../../tsconfig.base.json`, `noEmit`, `types:["node"]` — `@types/node` kökte kurulu): `corepack pnpm exec tsc -p tools/sim/tsconfig.json --noEmit`. `console`/`process` erişimi bu sayede tip güvenli olur (paket testlerindeki `globalThis as` hilesi gerekmez). Kök `pnpm -r typecheck` `tools/sim`'i kapsamaz → rapora bu boşluk yazılır (§5 Q3).

## 4) okey sızıntı testi tasarımı (`packages/catalog/test/leak-okey.test.ts`)

Kurgu: `okey101Def` ve `okeyDuzDef` için seed'li bot-bot oyun (§3'teki döngünün test içi kopyası, `KAHVE_LEAK_SEEDS` varsayılan 25, adım sınırı, koltuk rotasyonlu örnekleme → test < ~20 s, test başına süre verilir).

**Karşılaştırılan kümeler (her adımda, 4 koltuğun her biri için):**
- `GIZLI(state, s)` = `state.deck` id'leri ∪ `state.players[k].hand` id'leri (k ≠ s) — yani deste sırası + rakip elleri; artı skaler `state.seed`.
- `ACIK(state, s)` = tüm koltukların `discards` id'leri ∪ `table[].tiles` id'leri ∪ kendi eli ∪ `indicator.id` (bunlar gerçekten açık: atılan taşlar ve masadaki perler).

**Kontroller (hepsi `phase==='playing'` iken):**
1. **Gizli id yok:** view nesnesi özyinelemeli gezilir; `kind` alanı `'normal'|'fake'` olan her nesnenin `id`'si ve id alanları (`mustUseTileId`, `tileId`, `tileIds[]`) toplanır → `toplanan ∩ GIZLI = ∅`. Ayrıca `toplanan ⊆ ACIK` (beklenmedik id sızmadığının ters kontrolü).
2. **Sadece sayı:** her rakip koltuk için `view.players[k]` nesnesinde `hand` anahtarı **yok** ve `handCount === state.players[k].hand.length`.
3. **Deste/orta yığın sırası yok:** `view.deckCount === state.deck.length`, view'da deste dizisi yok; (1) gereği hiçbir deste taş id'si geçmediği için **sıra da** sızamaz.
4. **Seed/rng yok:** view ağacında özyinelemeli olarak `seed|rng|random|shuffle|deck|state` anahtar adı aranmaz (yapısal kontrol); ayrıca mutasyon testinde seed'in basamağı (`987654321`) hiçbir view JSON'unda geçmez.
5. **El sonu istisnası açıkça yazılır:** oyun sürerken her koltukta `revealedHands === null`; el bittiğinde `view.revealedHands[s]` gerçek ellere derin eşit (izinli istisna, test edilir).
6. **Mutasyon testi (en güçlü kontrol):** gerçek bir el-ortası durumun kopyasında (a) deste rastgele permüte edilir, (b) iki rakibin elleri kendi aralarında/permütasyonla değiştirilir, (c) `seed` büyük bir sayıyla değiştirilir → her koltuk için `stringify(viewFor(s,k)) === stringify(viewFor(s2,k))` **eşit olmalı** (aynı açık masa ⇒ aynı view), ama **kendi eli** değiştirilen koltuğun view'ı **değişmeli** (boş geçmeyi engelleyen pozitif kontrol); ayrıca `mustUseTileId` yalnız sırası olan koltuğun view'ında dolu, diğerlerinde `null` (duz'da `gosterge` benzeri koltuk bazlı alanlar dahil).
7. **Pozitif kontroller:** view'daki açık veriler state ile birebir: kendi el id'leri (sıra dahil), `table` taş id'leri, `indicator.id`, koltuk başına `discards` id'leri, `turn/turnPhase/turnNumber/reshuffles/phase`. Bu olmadan test "boş" geçebilirdi.
8. **Determinizm:** aynı `ctx` ile iki kez çağrılan `viewFor` bayt-eşit (view içinde `Date.now()`/rng sızıntısı yok).
9. **Anahtar allowlist (yapısal kapı):** `Object.keys(view)` tam olarak PlayerView alan listesine eşit olmalı (`mode, seat, phase, indicator, okey, deckCount, hand, players, table, turn, turnPhase, turnNumber, reshuffles, mustUseTileId, lastAction, result, revealedHands, gosterge, turnMsLeft, notice, notices, islek`). Faz B'de eklenecek yeni bir alan sızıntı getiriyorsa test **gürültülü** düşer (bilinçli sertlik; allowlist değişikliği Fable notuyla yapılır).

ADIM 2 hazırlığı: kontroller "probe" arkasında yazılır (`GIZLI/ACIK/kendi eli/anahtar listesi` oyun başına enjekte edilir), böylece pisti/batak için yalnız probe eklenir; harness ADIM 1'de bu dosyanın içinde kalır (sahiplik kuralı), ADIM 2'de `tools/sim/leak.ts`'e taşınması §5 Q2'ye bağlıdır.

## 5) Riskler ve açık sorular

| # | Risk / soru | Etki | Öneri |
|---|---|---|---|
| R1 | **Süre:** düz okey 20 seed = 10,6 s → 1000 seed ≈ **9 dk**; 101 ≈ 35 s. Kök `pnpm test` (server+app) da dakikalar sürer. | Uzun komutlar zaman aşımına girer | ORKESTRA §5.13 gereği arka planda, `--games`/`--shard` ile bölerek, log → `$env:TEMP`; çıktının son satırları rapora |
| R2 | **Kapsam %'si alınamıyor:** `@vitest/coverage-v8/-istanbul`, `v8-to-istanbul`, `istanbul-*` kurulu değil (`require.resolve` → MISSING); lockfile'daki adlar vitest'in opsiyonel peer'ı | "%85 kapsam" sayısal olarak kanıtlanamaz | B1'deki gibi **kural→test eşleme tablosu** + paket test sayıları + sim kapsam özeti sunulur (Q1) |
| Q1 | `@vitest/coverage-v8@5.0.5` Fable ekleyecek mi? (`packages/*/package.json` + lockfile → **Fable'ın yolu**) | Sayısal kapsam raporu | Ekleyecekse: `--coverage` ile % raporu ben koşup rapora yapıştırırım; eklemeyecekse tablo yeterli |
| R3 | `tsx` yalnız `@okey/server` devDependency'si + `hoisted` sayesinde kökte | server tsx'i bırakırsa sim komutu kırılır | Q: kök `devDependencies`'e `tsx` eklenmesi (Fable) |
| Q3 | `tools/sim` workspace dışı → kök `typecheck`/`test` kapsamıyor | "typecheck yeşil" kanıtı kısmi | Varsayılan: `tools/sim/tsconfig.json` + `tsc -p ... --noEmit` elle, çıktısı rapora; istenirse Fable workspace girdisi/root script ekler |
| Q4 | ADIM 2 harness paylaşımı: `packages/catalog/test/leak*.test.ts` glob'u `leak-harness.ts`'i kapsamıyor | Sahiplik ihlali riski | Varsayılan: tek dosyada kendi kendine yeten kod; Fable izin verirse `tools/sim/leak.ts` (bizim yolumuz) |
| R5 | Çok koltuklu oyunlar (pisti 2/4): `seats(opts)` seçeneklere bağlı; sözleşmede "n koltuk için seçenek" yardımcısı yok | Sim bugün yalnız `seats(defaultOptions)` varyantını koşar | ADIM 2'de `seatChoices` döngüsü + gerekirse `docs/kahve/requests/cline-seatvariant.md` (types.ts değişmez, sözleşme notu) |
| R6 | Adım sınırı/uzun eller (`reshuffles: 10`) | Yanlış "bitmeyen el" gürültüsü | Sınır aşılırsa gizlenmez: seed/round ile raporlanır, çıkış kodu 1; cap andırmak gerekirse Fable onayıyla artırılır |
| R7 | "Karışık bot seviyeleri" okeyde fiilen 2 konfigürasyon (adaptör `easy→medium`) | Raporun abartılı görünmesi | Özette seviye histogramı basılır, rapora not düşülür |
| R8 | Sızıntı testinde yanlış pozitif riski (id ↔ `value`/`penalties` sayı çakışması) | Kırılgan test | Sadece **taş nesnesi/id alanı** toplanır, ham string araması yapılmaz; seed kontrolü mutasyon testiyle yapılır |

## 6) Commit listesi (feat/kahve-cline, push/merge yok; her commit öncesi `corepack pnpm test` + `typecheck` yeşil)

1. `docs/kahve/plans/B8-CLINE.md` — onaylı plan (ilk satır `DURUM: ONAYLANDI <tarih> (Fable)`), `B8 plan: 1000-seed sim + viewFor leak tests (Cline)`.
2. `tools/sim/run.ts` + `tools/sim/tsconfig.json` — `B8: bot-vs-bot sim over the catalog for every active game`.
3. `packages/catalog/test/leak-okey.test.ts` — `B8: viewFor leak tests for okey (hands, deck order, seed)`.
4. (Yalnız gerekirse) sim/sızıntı testinin bulduğu gerçek hata için **ayrı** commit — sahibi olmadığımız `src` dosyalarına dokunmayız; bulgu rapora ve `docs/kahve/requests/`'e yazılır, düzeltmeyi Fable sahibine verir.
5. `docs/kahve/reports/B8-CLINE.md` — test/typecheck/sim çıktı son satırları, kapsam eşleme tablosu, bilinen eksikler, `B8 report: sim + leak test outputs (Cline)`.

Onay bekliyorum; onay gelince act moduna geçip sırayla 1→5 uygularım.
