# B7-OC · Adım 1 raporu (kural belgeleri: Pişti + Batak)

Dal: `feat/kahve-oc` (worktree `C:/Users/mfaru/okey101/kahve-oc`). Başlangıçta `git status` temiz.
Bu turda yalnız ADIM 1 yapıldı; ADIM 2 (`tools/sim/**`, sızıntı testleri) Fable "motor birleşti"
diyene kadar başlatılmadı.

## Yapılanlar

1. `docs/oyunlar/pisti.md` — 60+ okuyucu için sade Türkçe; genel bakış, kurulum, açılışta Vale,
   oynanış, pişti yapma, puanlama, el/oyun bitişi, süre ve tam AYARLAR tablosu.
2. `docs/oyunlar/batak.md` — aynı yapı; kurulum, ihale, koz seçimi, oynanış, yasal kart kuralları,
   puanlama, el/maç bitişi, süre ve tam AYARLAR tablosu.
3. `README.md` — "Kurallar (uygulanan hali)" bölümüne `### Pişti` ve `### Batak` alt başlıkları,
   tek satır özet + iki link. Başka README değişikliği yok (+10 satır).
4. Bu rapor.

Dosya sahipliği dışına çıkılmadı: `packages/*/src`, `shared/`, `server/`, `app/`, `package.json`,
lockfile ve `docs/oyunlar/okey101.md` dokunulmadı. Yeni bağımlılık yok.

## Kaynaklar ve uygulanan kararlar

- Bağlayıcı kaynak: `PROMPT_LOCAL.md` §3 B (Pişti/Batak varsayılanları) ve §4 (`docs/oyunlar/*.md`).
- Bölgesel varsayılanlar: `docs/kahve/MASTER_PLAN.md` §4e (P1, P2, K1, K2).
- Ayrıntı ve kenar durumlar: `docs/kahve/arastirma/KURALLAR_argon.md` OYUN 3–4 + Bölüm 3.
- Çelişkide PROMPT_LOCAL kazandı; bölgesel kurallarda MASTER_PLAN §4e esas alındı.

Onaylı plandaki Fable düzeltmeleri belgelere uygulandı:

1. "kullanıcı onayı bekliyor" notlarının tamamı **"genel kabul gören varsayılan; ayarla
   değiştirilebilir"** biçimine çevrildi (Pişti `hiddenCards`, `openingJack`; Batak `voidTrump`,
   `partnerDummy`). Belgelerde eski ifade kalmadı (grep ile doğrulandı).
2. Pişti ve Batak süreleri **`turnTimeoutMs: 30000`**, **`firstTurnFactor: 2`** (okey ile aynı).
   Metinde "30 saniye, ilk tur iki katı (60 saniye)" yazıyor. Plandaki 20000/25000 değerleri
   kullanılmadı.
3. Batak'ta `mustTrumpWhenVoid` + `mustOvertrump` yerine tek ayar **`voidTrump`**:
   `'always'` (varsayılan) | `'ifCanOvertrump'` | `'never'`. Üç seçenek "Yasal Kart Kuralları"
   bölümünde tek tek anlatıldı.
4. `kozMacaOvertrickLimit` ve `'esli'` varyantı **"hazırlanıyor (ilk sürümde ihaleli tekli)"**
   notuyla yazıldı; genel bakışta da ilk sürümün ihaleli tekli olduğu belirtildi.
5. Ayar adları motorla (Codex B2/B3) birleşince son kez eşitlenecek; bu turda tablolar plandaki
   (düzeltilmiş) adlarla yazıldı.

Kapsam dışı bırakılanlar (plan §1): Gömmeli varyant, `kanliGommeli`, `seats: 3`,
`sariKirmiziKing`, Pişti `targetScore: 201`, Argon'un `firstDealPistiAllowed` /
`blindCenterVisibleOnTake` / `mustTrump` adları.

## Öz-denetim

- UTF-8 denetimi (Node ile bayt okuma): `pisti.md`, `batak.md`, `README.md` — BOM yok,
  UTF-8 → string → UTF-8 dönüşümü bayt-eşit, mojibake yok, `ğ ş ı İ ç ö ü` karakterlerinin
  hepsi dosyalarda geçiyor.
- Pişti belgesi plan §3.1 başlık sırasıyla aynı; Batak belgesi plan §3.2 başlık sırasıyla aynı.
- AYARLAR tabloları plan taslağıyla birebir (yalnız Fable düzeltmeleri işlenmiş haliyle).
- README farkı +10 satır; mevcut okey metinlerine dokunulmadı.
- `git status` yalnız sahip olunan yolları gösteriyor: `docs/oyunlar/**`, `README.md`,
  `docs/kahve/reports/B7-OC.md`. Push yapılmadı.

## Bekleyenler

- ADIM 2: `tools/sim/run.ts` (her aktif oyun için 1000 seed bot-bot, geçersiz hamle 0) ve
  `viewFor` sızıntı testleri — Fable "motor birleşti" dediğinde ayrı onayla.
- Ayar adlarının motorla son eşitlemesi (B2/B3 birleşince).
