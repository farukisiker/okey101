DURUM: ONAYLANDI 2026-11-16 (Fable), DÜZELTMELERLE:
- "kullanıcı onayı bekliyor" notlarının HEPSİ → "genel kabul gören varsayılan; ayarla değiştirilebilir" (kullanıcı: önce oyunu bitir, sorular sonra).
- Süre: Pişti ve Batak `turnTimeoutMs` 30000, `firstTurnFactor` 2 (okey ile aynı).
- Batak: `mustTrumpWhenVoid` + `mustOvertrump` yerine tek ayar `voidTrump`: 'always' (renk yoksa geçemese de koz zorunlu, varsayılan) | 'ifCanOvertrump' | 'never'.
- `kozMacaOvertrickLimit` ve 'esli' varyantı: "hazırlanıyor (ilk sürümde ihaleli tekli)" notuyla.
- Ayar adları motorla (Codex B2/B3) birleşince son kez eşitlenecek; bu turda tabloyu yukarıdaki gibi yaz.

# B7-OC · ADIM 1 Lider Planı (Kural Belgeleri: Pişti + Batak)

Kaynaklar okundu: `PROMPT_LOCAL.md` §3 B (bağlayıcı), `MASTER_PLAN.md` §4e (bölgesel varsayılanlar), `docs/kahve/arastirma/KURALLAR_argon.md` OYUN 3–4 + Bölüm 2–3, `README.md`. Çelişkide **PROMPT_LOCAL** kazanır; bölgesel kurallarda **MASTER_PLAN §4e** varsayılanları esas alınır.

## 1. Kapsam

1. `docs/oyunlar/pisti.md`: 60+ okuyucu için sade Türkçe; kurulum, oynanış, puanlama, bitiş, süre ve tam AYARLAR tablosu.
2. `docs/oyunlar/batak.md`: aynı yapı; ihale, koz, çakma/büyütme kuralları, puanlama, maç bitişi ve tam AYARLAR tablosu.
3. Bölgesel kurallar (P1, P2, K1, K2) MASTER_PLAN §4e varsayılanlarıyla yazılır ve yanına **"kullanıcı onayı bekliyor"** notu konur.
4. `README.md` → mevcut "Kurallar (uygulanan hali)" bölümüne Pişti ve Batak linkleri eklenir (başka değişiklik yok).
5. UTF-8 / Türkçe karakter denetimi + süreç raporu (`docs/kahve/reports/B7-OC.md`); her belge ayrı commit; **push yok**.

**Kapsam dışı:** ADIM 2'nin tamamı (`tools/sim/**`, sızıntı testleri — Fable "motor birleşti" deyince ayrı onay); `docs/oyunlar/okey101.md`; kod (`packages/*/src`, `shared`, `server`, `app`, `package.json`, lockfile); yeni bağımlılık; Argon'un PROMPT_LOCAL'da olmayan ekleri: Gömmeli varyant + `kanliGommeli` + `seats: 3`, `sariKirmiziKing`, Pişti `targetScore: 201` (aşağıda madde 3–5).

## 2. Alt Görevler

| Alt görev | İşçi | Dosyalar | Kontrol |
|---|---|---|---|
| 0 · Hazırlık: worktree'de `git merge feat/kahve`, mevcut `README.md` "Kurallar" bölümünü doğrula | opencode/deepseek-v4.1-flash-free | – (git) | `git status` temiz; merge çakışması yoksa lidere bildir |
| 1 · `pisti.md` yazımı (taslak §3.1) | opencode/deepseek-v4.1-flash-free | `docs/oyunlar/pisti.md` | Başlık sırası taslakla aynı; AYARLAR tablosu tablo-birebir; UTF-8 (`ğ`, `ş`, `ı` sağlam) |
| 2 · `batak.md` yazımı (taslak §3.2) | opencode/deepseek-v4.1-flash-free | `docs/oyunlar/batak.md` | Aynı kontroller; K1/K2 notları "kullanıcı onayı bekliyor" içeriyor |
| 3 · README linkleri | opencode/deepseek-v4.1-flash-free | `README.md` | "Kurallar (uygulanan hali)" altına yalnız 2 link; diff en fazla birkaç satır |
| 4 · Öz-denetim + rapor | opencode/deepseek-v4.1-flash-free | `docs/kahve/reports/B7-OC.md` | Lider (ben) tüm dosyaları okuyup onaylar; push yapılmaz |

## 3. Belge Taslakları ve AYARLAR Tabloları

### 3.1 `docs/oyunlar/pisti.md` — Başlık dizisi

- `# Pişti`
- `## Genel Bakış` — 2 veya 4 kişi, 52 kart, amaç 151 puana ilk ulaşmak.
- `## Kurulum` — yere 3 kapalı + 1 açık (4 kart), herkese 4'er; kalan kapalı destede (2 kişilikte 40, 4 kişilikte 32); dağıtıcı solda döner.
- `## Açılışta Vale Çıkarsa` — P2 kuralı: vale destenin ortasına sokulur, yerine yeni kart açılır (`openingJack: 'redraw'`; "kullanıcı onayı bekliyor" notu).
- `## Oynanış` — sırayla 1 kart atma; yerdeki en üst kartla eşleşme; Vale'nin her kartı alması ama boş yeri alamaması; ilk yerdeki 4 kartla pişti olmaz; eller bitince yeniden 4'er dağıtım.
- `## Pişti Yapmak` — yerde tek kart + aynı değer = 10 puan; vale üstüne vale = 20 puan; pişti yapılan kartların kendi değerleri de sayılır.
- `## Puanlama` — tablo: As 1, Vale 1, ♣2 2, ♦10 3, en çok kart 3 (eşitlikte kimseye yok); el toplamı sabit 16 (eşitlikte 13).
- `## El ve Oyun Bitişi` — deste bitince yerdeki kartlar son toplayana gider (pişti sayılmaz); hedef puanı geçen kazanır; tam eşitlikte 1 uzatma eli.
- `## Süre ve Zaman Aşımı` — 20 sn (ilk tur ×2); süresi bitene kalan: eşleştiren kart varsa onu, yoksa en güvenli küçük kart.
- `## Ayarlar` — aşağıdaki tablo + P1 notu.

**Pişti AYARLAR tablosu (belgeye aynen girer):**

| Ayar | Seçenekler | Varsayılan |
|---|---|---|
| `seats` | `2`, `4` | `2` |
| `partnerMode` | `false`, `true` (yalnız `seats: 4`'te etkin; 0–2 ve 1–3 ortak) | `false` |
| `targetScore` | `51`, `101`, `151` | `151` |
| `pistiPoints` | `10` | `10` |
| `jackPistiPoints` | `20` | `20` |
| `hiddenCards` *(P1 — kullanıcı onayı bekliyor)* | `'reveal'` (3 kapalı kart ilk toplayanın kart sayısına eklenir, o an herkese açık gösterilir), `'secret'` (kimse görmez, el sonunda sayılır) | `'reveal'` |
| `openingJack` *(P2 — kullanıcı onayı bekliyor)* | `'redraw'` (vale orta içine sokulur, yeni kart açılır), `'allow'` (valeyle başlanır) | `'redraw'` |
| `turnTimeoutMs` | sayı (ms) | `20000` |
| `firstTurnFactor` | sayı | `2` |
| `botLevel` | `'easy'`, `'medium'`, `'hard'` | `'medium'` |

### 3.2 `docs/oyunlar/batak.md` — Başlık dizisi

- `# Batak`
- `## Genel Bakış` — 4 kişi, 52 kart, 13'er kart; ihaleli tekli ilk sürüm.
- `## Kurulum ve Dağıtım`
- `## İhale` — 5'ten başlar; pas geçen bir daha giremez; 3 pas → kalan tek oyuncu en yüksek teklifle alır; herkes pas derse dağıtıcıya zorunlu 4.
- `## Koz Seçimi` — ihaleyi alan rengi seçer ve ilk kartı oynar.
- `## Oynanış` — 13 löve; renk uyma zorunlu; kozlu/kozsuz çözüm; löveyi kozun en büyüğü veya ilk rengin en büyüğü alır; kazanan başlatır.
- `## Yasal Kart Kuralları` — koz kırılmadan koz çıkılamaz (elde yalnız kozsa çıkılır); aynı rengi büyütme zorunluluğu (koz çakılmışsa kalkar); renk yoksa çakma zorunlu; üstüne çakma / geçemese bile alttan çakma.
- `## Puanlama` — tutturan +aldığı el sayısı; batan −ihale; diğerleri aldığı el kadar; hiç el almayan −ihale (ayar).
- `## El ve Maç Bitişi` — `targetRounds` el sonunda en çok puan; eşitlikte 1 uzatma eli.
- `## Süre ve Zaman Aşımı` — 25 sn (ilk tur ×2); quickMove: pas / en çok kozlu renk / en küçük yasal kart.
- `## Ayarlar` — aşağıdaki tablo + K1/K2 notları.

**Batak AYARLAR tablosu (belgeye aynen girer):**

| Ayar | Seçenekler | Varsayılan |
|---|---|---|
| `variant` | `'ihaleli'`, `'kozMaca'`, `'esli'` (Eşli Batak) | `'ihaleli'` |
| `targetRounds` | `5`, `7`, `9`, `11`, `13` | `9` |
| `minBid` | `4`, `5` (`'esli'`'de `8`) | `5` |
| `forcedDealerBid` | `4` (tekli), `7` (eşli) | `4` |
| `mustTrumpWhenVoid` *(K1 — kullanıcı onayı bekliyor)* | `true` (renk yoksa geçemese bile küçük koz da olsa çakmak zorunlu), `false` | `true` |
| `mustOvertrump` *(K1 — kullanıcı onayı bekliyor)* | `true`, `false` | `true` |
| `mustRaise` | `true` (masadaki en büyüğü geçebiliyorsan geçmek zorunlu), `false` | `true` |
| `trumpLeadNeedsBreak` | `true` (ilk koz düşmeden kozla başlanamaz), `false` | `true` |
| `zeroTrickPenalty` | `'bid'` (ihale kadar eksi), `'fixed5'` (−5), `'none'` | `'bid'` |
| `kozMacaOvertrickLimit` | `2`, `3`, `0` (sınırsız) | `2` |
| `partnerDummy` *(K2 — kullanıcı onayı bekliyor)* | `false` (ortağın eli kapalı, herkes kendi elini oynar), `true` (ortağın eli açık serilir, ihaleyi alan oynatır) | `false` |
| `turnTimeoutMs` | sayı (ms) | `25000` |
| `firstTurnFactor` | sayı | `2` |
| `botLevel` | `'easy'`, `'medium'`, `'hard'` | `'medium'` |

### 3.3 `README.md`

`## Kurallar (uygulanan hali)` bölümüne, okey alt başlıklarının altına:

- `### Pişti` → `[docs/oyunlar/pisti.md](docs/oyunlar/pisti.md)` (tek satır özet + link)
- `### Batak` → `[docs/oyunlar/batak.md](docs/oyunlar/batak.md)` (tek satır özet + link)

## 4. PROMPT_LOCAL (+ MASTER_PLAN §4e) ↔ KURALLAR_argon Çelişkileri

| # | Konu | Argon | PROMPT_LOCAL / MASTER_PLAN §4e | Karar (PROMPT_LOCAL kazanır) |
|---|---|---|---|---|
| 1 | Pişti açılış Vale'si | Yerde valeyle başlanır; ilk hamlede pişti olamaz; `firstDealPistiAllowed` ayarı | PROMPT_LOCAL sessiz; **P2**: vale destenin ortasına, yeni kart açılır (`openingJack: 'redraw'`) | MASTER_PLAN uygulanır → `openingJack` ayarı; Argon'un `firstDealPistiAllowed`'ı belgeye girmez |
| 2 | Pişti ilk 3 kapalı kart ayarının adı | `blindCenterVisibleOnTake: boolean` | **P1**: `hiddenCards: 'reveal' \| 'secret'` | MASTER_PLAN adı ve seçenekleri kullanılır |
| 3 | Pişti hedef puan seçenekleri | `51/101/151/201` | PROMPT_LOCAL: `51/101/151` | `201` çıkarıldı |
| 4 | Pişti `partnerMode` varsayılanı | Tabloda "`true` (4 kişide)" (belirsiz) | PROMPT_LOCAL "2 veya 4 oyuncu" + en basit kurulum çizgisi | Varsayılan `seats: 2` + `partnerMode: false` |
| 5 | Batak zorunluluk ayarlarının adları | Tek `mustTrump` + tek `mustRaise` (ikisi de büyütme/üstüne çakmayı kapsar) | **K1**: `mustTrumpWhenVoid` + `mustOvertrump` ayrı | MASTER_PLAN adları; Argon'un "aynı rengi büyütme" parçası PROMPT_LOCAL'ın tek ayarı olarak `mustRaise` adıyla ayrı tutulur (kural içeriği aynı, BAT-T09/T10 kenar durumu belgede anlatılır) |
| 6 | Eşli Batak ortağın eli | `'esli'` varsayılanı: açık el (dummy), declarer oynatır | **K2**: `partnerDummy: false` — kapalı el, herkes kendi elini oynar | MASTER_PLAN uygulanır; Argon'un eşli `minBid: 8` / `forcedDealerBid: 7` korunur |
| 7 | Gömmeli varyant | `variant: 'gommeli'`, `kanliGommeli`, `seats: 3` | PROMPT_LOCAL'da yok (yalnız Koz Maça + Eşli sayılır) | Belgeye girmez; kapsam dışı |
| 8 | `sariKirmiziKing` (11/12/13 el anında kazanma) | Ayar olarak listeli | PROMPT_LOCAL'da yok | Belgeye girmez |
| 9 | Koz Maça puan ölçeği | `B×10` veya sade `+W/−B` (iki seçenek sunar) | PROMPT_LOCAL sessiz | İhaleli ile tutarlı sade ölçek (`+W` / `−B`) yazılır; belge tek ölçek gösterir |

## 5. Commit Listesi (sırayla, push yok)

1. `docs: add pisti rules doc with settings table (B7 step 1)` — `docs/oyunlar/pisti.md`
2. `docs: add batak rules doc with settings table (B7 step 1)` — `docs/oyunlar/batak.md`
3. `docs: link pisti and batak rules from README (B7 step 1)` — `README.md`
4. `docs: add B7-OC step 1 report` — `docs/kahve/reports/B7-OC.md`

Son kontrol: `git status` temiz, yalnız sahip olunan yollar değişmiş (`docs/oyunlar/**`, `README.md`, `docs/kahve/reports/**`), UTF-8 bozulması yok.
